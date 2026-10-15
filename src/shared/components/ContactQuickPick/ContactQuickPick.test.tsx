import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import * as ContactsApiModule from '@/shared/api/app/contacts-api.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import { notify } from '@/shared/notify/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';
import { EMPTY_CONTACT_PROFILE } from '@/tests/utils/contact-doubles.ts';

import { CONTACT_QUICK_PICK_TEST_IDS as IDS } from './contact-quick-pick.constants.ts';
import { ContactQuickPick, type ContactQuickPickProps } from './ContactQuickPick.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ContactsApiModule>()),
  searchContacts: vi.fn(),
  fetchRecentContacts: vi.fn(),
}));

const { fetchRecentContacts, searchContacts } = ContactsApiModule;

/** A person as the contact list answers. */
function person(overrides: Partial<ContactSummary>): ContactSummary {
  return {
    ...EMPTY_CONTACT_PROFILE,
    id: 'con_asha00000000000000000',
    contactNumber: 10234,
    firstName: 'Asha',
    lastName: 'Patel',
    name: 'Asha Patel',
    primaryPhone: '+919825011241',
    email: null,
    instagramHandles: [],
    defaultChannel: 'whatsapp',
    preferenceTags: [],
    patientId: null,
    openLeadId: null,
    lastActivityAt: '2026-10-12T04:30:00.000Z',
    lastReceivedAt: null,
    isAwaitingReply: false,
    updatedAt: '2026-10-12T04:30:00.000Z',
    ...overrides,
  };
}

const ASHA = person({});
const ASHWIN = person({
  id: 'con_ashwin000000000000000',
  contactNumber: 10235,
  firstName: 'Ashwin',
  lastName: 'Rao',
  name: 'Ashwin Rao',
  primaryPhone: '+919825011242',
  patientId: 'pat_ashwin000000000000000',
});
const KAVYA = person({
  id: 'con_kavya0000000000000000',
  contactNumber: 10236,
  firstName: 'Kavya',
  lastName: 'Shah',
  name: 'Kavya Shah',
  primaryPhone: '+919825011243',
});

const ROOT = 'who';
const testIds = {
  search: 'who-search',
  hit: (hit: ContactSummary) => `who-hit-${hit.contactNumber}`,
  add: 'who-add',
  noMatch: 'who-no-match',
};
const callbacks = {
  onPick: vi.fn(),
  onQuickAdd: vi.fn(),
  onMoreDetails: vi.fn(),
};

function renderPick(props: Partial<ContactQuickPickProps> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <ContactQuickPick
        searchPlaceholder="Search by name or mobile"
        searchLabel="Search person"
        describe={(hit) => ({
          line: hit.patientId ? 'Patient' : hit.primaryPhone,
          tone: hit.patientId ? 'sage' : 'lav',
        })}
        testId={ROOT}
        testIds={testIds}
        {...callbacks}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup() };
}

const search = () => screen.getByTestId('who-search');

beforeEach(() => {
  signInTestMember();
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  for (const fn of Object.values(callbacks)) fn.mockReset();
  vi.mocked(fetchRecentContacts).mockReset();
  vi.mocked(fetchRecentContacts).mockResolvedValue([KAVYA, ASHA]);
  vi.mocked(searchContacts).mockReset();
  vi.mocked(searchContacts).mockImplementation(async (typed) =>
    [ASHA, ASHWIN, KAVYA].filter((hit) =>
      hit.name.toLowerCase().includes(typed.trim().toLowerCase()),
    ),
  );
});

describe('ContactQuickPick — select faster', () => {
  it('shows the Recent people before anything is typed, shimmering while they load', async () => {
    let release: (people: ContactSummary[]) => void = () => {};
    vi.mocked(fetchRecentContacts).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderPick();

    const loading = await screen.findByTestId(IDS.loading(ROOT));
    expect(loading.querySelectorAll('.skeleton-sheen').length).toBeGreaterThan(0);
    // Recent loads silently: no spinner, no "Searching…".
    expect(screen.queryByTestId(IDS.progress(ROOT))).toBeNull();
    expect(screen.getByTestId(IDS.status(ROOT))).toHaveTextContent('');

    await act(async () => release([KAVYA, ASHA]));
    const recent = await screen.findByTestId(IDS.recent(ROOT));
    expect(within(recent).getByText('Recent')).toBeInTheDocument();
    expect(within(recent).getByTestId('who-hit-10236')).toHaveTextContent('Kavya Shah');
    expect(screen.queryByTestId(IDS.loading(ROOT))).toBeNull();
    expect(screen.getByTestId('who-add')).toHaveTextContent('New contact');
  });

  it('picks a Recent person by ↵ — the first is highlighted', async () => {
    const { user } = renderPick();
    await screen.findByTestId('who-hit-10236');
    await user.click(search());
    await user.keyboard('{Enter}');
    expect(callbacks.onPick).toHaveBeenCalledWith(KAVYA);
  });

  it('asks the desk to keep typing under 3 letters', async () => {
    const { user } = renderPick();
    await user.type(search(), 'as');
    expect(screen.getByTestId(IDS.hint(ROOT))).toHaveTextContent(
      'Keep typing — 3 letters or 4 digits',
    );
    expect(screen.queryByTestId(IDS.recent(ROOT))).toBeNull();
    expect(searchContacts).not.toHaveBeenCalled();
  });

  it('searches with a spinner, a progress line and shimmer rows, then marks the typed words', async () => {
    const { user } = renderPick();
    await user.type(search(), 'ash');

    expect(screen.getByRole('progressbar', { name: 'Searching…' })).toBeInTheDocument();
    expect(screen.getByTestId(IDS.loading(ROOT))).toBeInTheDocument();
    expect(screen.getByTestId(IDS.status(ROOT))).toHaveTextContent('Searching…');

    const asha = await screen.findByTestId('who-hit-10234');
    expect(within(asha).getByText('Ash', { selector: 'mark' })).toBeInTheDocument();
    expect(asha).toHaveTextContent('Asha Patel+919825011241');
    expect(screen.getByTestId('who-hit-10235')).toHaveTextContent('Patient');
    await waitFor(() =>
      expect(screen.getByTestId(IDS.status(ROOT))).toHaveTextContent('2 people found'),
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByTestId(IDS.loading(ROOT))).toBeNull();
  });

  it('keeps the last rows, dimmed, while the next answer loads', async () => {
    const { user } = renderPick();
    await user.type(search(), 'ash');
    await screen.findByTestId('who-hit-10234');
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());

    await user.type(search(), 'w');
    expect(screen.getByTestId(IDS.results(ROOT))).toHaveClass('opacity-60');
    expect(screen.getByRole('listbox', { name: 'Search person' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByTestId(IDS.loading(ROOT))).toBeNull();
    await waitFor(() => expect(screen.queryByTestId('who-hit-10234')).toBeNull());
    expect(screen.getByTestId(IDS.results(ROOT))).not.toHaveClass('opacity-60');
    expect(screen.getByRole('listbox', { name: 'Search person' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
  });

  it('moves the highlight with ↓ and picks with ↵, clearing the search', async () => {
    const { user } = renderPick();
    await user.type(search(), 'ash');
    await screen.findByTestId('who-hit-10235');
    await waitFor(() =>
      expect(screen.getByTestId('who-hit-10234')).toHaveAttribute(
        'data-selected',
        'true',
      ),
    );
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('who-hit-10235')).toHaveAttribute('data-selected', 'true');
    await user.keyboard('{Enter}');
    expect(callbacks.onPick).toHaveBeenCalledWith(ASHWIN);
    expect(search()).toHaveValue('');
  });

  it('highlights the first person who arrives after a slow answer — never the add row', async () => {
    let release: (people: ContactSummary[]) => void = () => {};
    vi.mocked(searchContacts).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const { user } = renderPick();
    await user.type(search(), 'ash');
    // ↵ waits for the answer, so the lone add row offers no ↵.
    expect(within(screen.getByTestId('who-add')).queryByText('↵')).toBeNull();
    await user.keyboard('{Enter}');
    expect(screen.queryByTestId(IDS.quickAdd(ROOT))).toBeNull();

    await act(async () => release([ASHA, ASHWIN]));
    const asha = await screen.findByTestId('who-hit-10234');
    await waitFor(() => expect(asha).toHaveAttribute('data-selected', 'true'));
    expect(screen.getByTestId('who-add')).toHaveAttribute('data-selected', 'false');
    await user.keyboard('{Enter}');
    expect(callbacks.onPick).toHaveBeenCalledWith(ASHA);
  });

  it('picks on a press as before', async () => {
    const { user } = renderPick();
    await user.type(search(), 'kav');
    await user.click(await screen.findByTestId('who-hit-10236'));
    expect(callbacks.onPick).toHaveBeenCalledWith(KAVYA);
  });

  it('clears the search with ×', async () => {
    const { user } = renderPick();
    await user.type(search(), 'kav');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search()).toHaveValue('');
    expect(search()).toHaveFocus();
  });

  it('keeps a toolbar’s own keys', async () => {
    const onChip = vi.fn();
    const { user } = renderPick({
      toolbar: (
        <button type="button" onClick={onChip}>
          Walk-in
        </button>
      ),
    });
    await screen.findByTestId('who-hit-10236');
    screen.getByRole('button', { name: 'Walk-in' }).focus();
    await user.keyboard('{Enter}');
    expect(onChip).toHaveBeenCalledTimes(1);
    expect(callbacks.onPick).not.toHaveBeenCalled();
  });
});

describe('ContactQuickPick — add faster', () => {
  it('says "No existing match" and opens the quick add on ↵, prefilled with the name', async () => {
    const { user } = renderPick();
    await user.type(search(), 'Meera Iyer');
    expect(await screen.findByTestId('who-no-match')).toHaveTextContent(
      'No existing match',
    );
    expect(screen.getByTestId(IDS.status(ROOT))).toHaveTextContent('No existing match');
    expect(withoutBidiMarks(screen.getByTestId('who-add').textContent)).toBe(
      'New contact Meera Iyer↵',
    );

    await user.keyboard('{Enter}');
    expect(screen.getByTestId(IDS.quickAddName(ROOT))).toHaveValue('Meera Iyer');
    await waitFor(() =>
      expect(screen.getByTestId(IDS.quickAddMobile(ROOT))).toHaveFocus(),
    );

    await user.keyboard('9825011299{Enter}');
    expect(callbacks.onQuickAdd).toHaveBeenCalledWith({
      name: 'Meera Iyer',
      phone: '9825011299',
      instagram: '',
    });
    expect(screen.queryByTestId(IDS.quickAdd(ROOT))).toBeNull();
    expect(search()).toHaveValue('');
  });

  it('reads a typed number into the mobile and focuses the name', async () => {
    vi.mocked(searchContacts).mockResolvedValue([]);
    const { user } = renderPick();
    await user.type(search(), '98250 11299');
    expect(withoutBidiMarks(screen.getByTestId('who-add').textContent)).toContain(
      'New contact +91 98250 11299',
    );
    await user.click(screen.getByTestId('who-add'));
    expect(screen.getByTestId(IDS.quickAddMobile(ROOT))).toHaveValue('98250 11299');
    await waitFor(() => expect(screen.getByTestId(IDS.quickAddName(ROOT))).toHaveFocus());
  });

  it('never opens the quick add on ↵ while the first answer is on its way', async () => {
    vi.mocked(searchContacts).mockReturnValue(new Promise(() => {}));
    const { user } = renderPick();
    await user.type(search(), 'ash{Enter}');
    expect(screen.queryByTestId(IDS.quickAdd(ROOT))).toBeNull();
    expect(screen.getByTestId(IDS.loading(ROOT))).toBeInTheDocument();
  });

  it('checks the name, and the mobile when one is required', async () => {
    const { user } = renderPick({ requirePhone: true });
    await screen.findByTestId('who-hit-10236');
    await user.click(screen.getByTestId('who-add'));
    await user.click(screen.getByTestId(IDS.quickAddSubmit(ROOT)));
    expect(notify.warning).toHaveBeenLastCalledWith('Add a name');
    expect(screen.getByTestId(IDS.quickAddName(ROOT))).toHaveFocus();

    await user.type(screen.getByTestId(IDS.quickAddName(ROOT)), 'Meera');
    await user.click(screen.getByTestId(IDS.quickAddSubmit(ROOT)));
    expect(notify.warning).toHaveBeenLastCalledWith('Add a 10-digit mobile');
    expect(callbacks.onQuickAdd).not.toHaveBeenCalled();
  });

  it('takes no mobile when none is required, but never a short one', async () => {
    const { user } = renderPick();
    await user.type(search(), 'Meera');
    await user.click(screen.getByTestId('who-add'));
    await user.type(screen.getByTestId(IDS.quickAddMobile(ROOT)), '98250');
    await user.click(screen.getByTestId(IDS.quickAddSubmit(ROOT)));
    expect(notify.warning).toHaveBeenLastCalledWith('Mobile needs 10 digits');

    await user.clear(screen.getByTestId(IDS.quickAddMobile(ROOT)));
    await user.click(screen.getByTestId(IDS.quickAddSubmit(ROOT)));
    expect(callbacks.onQuickAdd).toHaveBeenCalledWith({
      name: 'Meera',
      phone: '',
      instagram: '',
    });
  });

  it('"More details" hands the values on; "Back to search" keeps the search', async () => {
    const { user } = renderPick();
    await user.type(search(), 'Meera 9825011299');
    await user.click(screen.getByTestId('who-add'));
    await user.click(screen.getByTestId(IDS.quickAddBack(ROOT)));
    expect(search()).toHaveValue('Meera 9825011299');

    await user.click(screen.getByTestId('who-add'));
    await user.click(screen.getByTestId(IDS.quickAddMore(ROOT)));
    expect(callbacks.onMoreDetails).toHaveBeenCalledWith({
      name: 'Meera',
      phone: '9825011299',
      instagram: '',
    });
    expect(callbacks.onQuickAdd).not.toHaveBeenCalled();
  });

  it('offers no "More details" without a host for it', async () => {
    const { user } = renderPick({ onMoreDetails: undefined });
    await user.type(search(), 'Meera');
    await user.click(screen.getByTestId('who-add'));
    expect(screen.queryByTestId(IDS.quickAddMore(ROOT))).toBeNull();
  });
});

describe('ContactQuickPick — states', () => {
  it('shows only the search, disabled, when the form is read-only', () => {
    renderPick({ disabled: true });
    expect(search()).toBeDisabled();
    expect(screen.queryByTestId('who-add')).toBeNull();
    expect(fetchRecentContacts).not.toHaveBeenCalled();
  });

  it('shows nothing for Recent when it fails, and the add row still works', async () => {
    vi.mocked(fetchRecentContacts).mockRejectedValue(new Error('offline'));
    const { user } = renderPick();
    await waitFor(() => expect(screen.queryByTestId(IDS.loading(ROOT))).toBeNull());
    expect(screen.queryByTestId(IDS.recent(ROOT))).toBeNull();
    expect(notify.error).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('who-add'));
    expect(screen.getByTestId(IDS.quickAdd(ROOT))).toBeInTheDocument();
  });

  it('has no accessibility violations — Recent, results, a refresh, the quick add', async () => {
    const { container, user } = renderPick();
    await screen.findByTestId('who-hit-10236');
    expect(await axe(container)).toHaveNoViolations();
    await user.type(search(), 'ash');
    await screen.findByTestId('who-hit-10234');
    await user.type(search(), 'w');
    expect(screen.getByTestId(IDS.results(ROOT))).toHaveClass('opacity-60');
    expect(await axe(container)).toHaveNoViolations();
    await user.clear(search());
    await user.click(screen.getByTestId('who-add'));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ContactQuickPick — a short picker (change-compact-contact-picker)', () => {
  it('draws Recent as one line of chips: a short name to see, the whole person to hear', async () => {
    vi.mocked(fetchRecentContacts).mockResolvedValue([KAVYA, ASHWIN]);
    renderPick();
    const kavya = await screen.findByTestId('who-hit-10236');
    const recent = screen.getByTestId(IDS.recent(ROOT));
    expect(within(recent).getAllByRole('option')).toHaveLength(2);
    expect(kavya).toHaveAttribute('data-slot', 'pill');
    expect(kavya).toHaveAttribute('title', 'Kavya Shah');
    // The short name is seen, not heard; the whole name, line and action are heard.
    const short = within(kavya).getByText('Kavya S.');
    expect(short).toHaveAttribute('aria-hidden', 'true');
    expect(kavya).toHaveAccessibleName('Kavya Shah +919825011243');
    expect(screen.getByTestId('who-hit-10235')).toHaveAccessibleName(
      'Ashwin Rao Patient',
    );
  });

  it('shimmers chip-shaped bars on Recent’s line while it loads', async () => {
    vi.mocked(fetchRecentContacts).mockReturnValue(new Promise(() => {}));
    renderPick();
    const loading = await screen.findByTestId(IDS.loading(ROOT));
    expect(loading).toHaveTextContent('Recent');
    const bars = loading.querySelectorAll('.skeleton-sheen');
    expect(bars).toHaveLength(3);
    for (const bar of bars) expect(bar).toHaveClass('h-8', 'rounded-full');
  });

  it('moves along the rail with ← / →, held at the ends, and ↵ picks the chip', async () => {
    vi.mocked(fetchRecentContacts).mockResolvedValue([KAVYA, ASHA, ASHWIN]);
    const { user } = renderPick();
    const kavya = await screen.findByTestId('who-hit-10236');
    await user.click(search());
    expect(kavya).toHaveAttribute('data-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(kavya).toHaveAttribute('data-selected', 'true');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByTestId('who-hit-10235')).toHaveAttribute('data-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('who-hit-10235')).toHaveAttribute('data-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('who-hit-10234')).toHaveAttribute('data-selected', 'true');
    await user.keyboard('{Enter}');
    expect(callbacks.onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: ASHA.id }),
    );
  });

  it('mirrors the rail’s keys on a right-to-left page: ← is forward', async () => {
    vi.mocked(fetchRecentContacts).mockResolvedValue([KAVYA, ASHA]);
    const computed = window.getComputedStyle;
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((element) =>
        Object.assign(computed(element), { direction: 'rtl' }),
      );
    try {
      const { user } = renderPick();
      await screen.findByTestId('who-hit-10236');
      await user.click(search());
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByTestId('who-hit-10234')).toHaveAttribute(
        'data-selected',
        'true',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('leaves ← / → to the caret once something is typed', async () => {
    const { user } = renderPick();
    await screen.findByTestId('who-hit-10236');
    await user.type(search(), 'ash');
    const asha = await screen.findByTestId('who-hit-10234');
    await waitFor(() => expect(asha).toHaveAttribute('data-selected', 'true'));
    await user.keyboard('{ArrowRight}');
    expect(asha).toHaveAttribute('data-selected', 'true');
    expect(screen.queryByTestId(IDS.recent(ROOT))).toBeNull();
  });

  it('keeps the results to a short window above a 36px add row', async () => {
    const { user } = renderPick();
    await user.type(search(), 'ash');
    await screen.findByTestId('who-hit-10234');
    expect(screen.getByRole('listbox')).toHaveClass('max-h-50');
    expect(screen.getByTestId('who-add')).toHaveClass('h-9');
  });
});

describe('ContactQuickPick — what was typed becomes the contact (change-natural-contact-search)', () => {
  it('shows each value the add row would use, and fills the quick add with them', async () => {
    vi.mocked(searchContacts).mockResolvedValue([]);
    const { user } = renderPick();
    await user.type(search(), 'Meera Iyer 98250 11241 @meera.iyer');
    const add = screen.getByTestId('who-add');
    await waitFor(() =>
      expect(withoutBidiMarks(add.textContent)).toBe(
        'New contact Meera Iyer +91 98250 11241 @meera.iyer',
      ),
    );
    expect(screen.getByTestId(IDS.addValue('who-add', 'phone'))).toHaveAttribute(
      'dir',
      'ltr',
    );
    await user.click(add);
    expect(screen.getByTestId(IDS.quickAddName(ROOT))).toHaveValue('Meera Iyer');
    expect(screen.getByTestId(IDS.quickAddMobile(ROOT))).toHaveValue('98250 11241');
    expect(screen.getByTestId(IDS.quickAddInstagram(ROOT))).toHaveValue('@meera.iyer');
    await user.click(screen.getByTestId(IDS.quickAddSubmit(ROOT)));
    expect(callbacks.onQuickAdd).toHaveBeenCalledWith({
      name: 'Meera Iyer',
      phone: '9825011241',
      instagram: '@meera.iyer',
    });
  });

  it('opens no Instagram field without a handle, and takes none where the host keeps none', async () => {
    vi.mocked(searchContacts).mockResolvedValue([]);
    const { user } = renderPick({ takesInstagram: false });
    await user.type(search(), 'Meera @meera.iyer');
    const add = screen.getByTestId('who-add');
    await waitFor(() =>
      expect(withoutBidiMarks(add.textContent)).toBe('New contact Meera'),
    );
    await user.click(add);
    expect(screen.queryByTestId(IDS.quickAddInstagram(ROOT))).toBeNull();
    await user.click(screen.getByTestId(IDS.quickAddSubmit(ROOT)));
    expect(callbacks.onQuickAdd).toHaveBeenCalledWith({
      name: 'Meera',
      phone: '',
      instagram: '',
    });
  });

  it('marks every typed word of a hit, in any order', async () => {
    const { user } = renderPick();
    await user.type(search(), 'patel asha');
    vi.mocked(searchContacts).mockResolvedValue([ASHA]);
    await user.type(search(), ' ');
    const asha = await screen.findByTestId('who-hit-10234');
    expect([...asha.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual([
      'Asha',
      'Patel',
    ]);
  });

  it('says what a pick does only when it does more than take the person', async () => {
    const { user } = renderPick({
      describe: (hit) => ({
        line: hit.primaryPhone ?? '',
        action: hit.patientId ? 'Re-create lead' : undefined,
        tone: 'lav',
      }),
    });
    await user.type(search(), 'ash');
    expect(await screen.findByTestId('who-hit-10235')).toHaveTextContent(
      'Re-create lead',
    );
    expect(screen.getByTestId('who-hit-10234')).toHaveTextContent(
      'Asha Patel+919825011241',
    );
    expect(screen.getByTestId('who-hit-10234')).not.toHaveTextContent('lead');
  });
});
