import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchMyPreferences,
  resetPreferencesFixture,
  saveMyPreferences,
} from '@/shared/api/clinic/preferences-api.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { Picker } from './Picker.tsx';
import type { PickerOption, PickerSingleProps } from './picker.types.ts';

const tier = vi.hoisted(() => ({ current: 'desktop' as 'phone' | 'tablet' | 'desktop' }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => tier.current,
}));

const STATUSES: PickerOption[] = [
  { key: 'scheduled', label: 'Scheduled', tone: 'butter' },
  { key: 'confirmed', label: 'Confirmed', tone: 'sky' },
  { key: 'completed', label: 'Completed', tone: 'sage', disabled: true },
  { key: 'cancelled', label: 'Cancelled', tone: 'stone' },
];

function numbered(count: number, prefix = 'Option'): PickerOption[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `o${index}`,
    label: `${prefix} ${String(index).padStart(2, '0')}`,
  }));
}

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const user = userEvent.setup();
  const view = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return {
    user,
    ...view,
    rerender: (next: ReactElement) =>
      view.rerender(<QueryClientProvider client={client}>{next}</QueryClientProvider>),
  };
}

type SingleProps = Omit<PickerSingleProps<unknown>, 'value' | 'onChange'>;

/** A single-select picker that keeps its own value, reporting each change. */
function Single({
  initial = null,
  onPick = () => {},
  ...props
}: SingleProps & { initial?: string | null; onPick?: (key: string | null) => void }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <Picker
      {...props}
      value={value}
      onChange={(key) => {
        setValue(key);
        onPick(key);
      }}
    />
  );
}

function activeRow(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]');
}

function optionRows(): HTMLElement[] {
  return screen.queryAllByRole('option');
}

beforeEach(() => {
  tier.current = 'desktop';
  resetPreferencesFixture();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Picker — surfaces', () => {
  it('opens a popover listbox from md up, named by the field label', async () => {
    tier.current = 'tablet';
    const { user } = renderWithClient(
      <Single label="Status" options={STATUSES} testId="status" />,
    );
    const trigger = screen.getByTestId('status');
    expect(trigger).toHaveTextContent('Select…');
    expect(trigger).toHaveAttribute('aria-label', 'Status');
    expect(trigger.className).toContain('min-h-9');

    await user.click(trigger);
    const panel = await screen.findByTestId('status-panel');
    expect(panel).toHaveAttribute('data-picker-surface', 'popover');
    expect(panel).toHaveAttribute('aria-label', 'Status');
    expect(within(panel).getByRole('listbox', { name: 'Status' })).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the 72% dimmed bottom sheet below md', async () => {
    tier.current = 'phone';
    const { user } = renderWithClient(
      <Single label="Status" options={STATUSES} testId="status" />,
    );
    await user.click(screen.getByTestId('status'));
    const sheet = await screen.findByTestId('status-panel');
    expect(sheet).toHaveAttribute('data-picker-surface', 'sheet');
    expect(sheet.className).toContain('data-[vaul-drawer-direction=bottom]:max-h-[72%]');
    expect(sheet.className).toContain(
      'data-[vaul-drawer-direction=bottom]:rounded-t-2xl',
    );
    expect(sheet.className).toContain('animate-sheet-up');
    expect(sheet.className).toContain('pb-[env(safe-area-inset-bottom)]');
    const title = within(sheet).getByText('Status', {
      selector: '[data-slot="drawer-title"]',
    });
    expect(title).toHaveClass('sr-only');
    const overlay = document.querySelector('[data-slot="drawer-overlay"]');
    expect(overlay?.className).toContain('bg-overlay/40');
  });

  it('has no accessibility violations while open (popover and sheet)', async () => {
    const { user, baseElement, unmount } = renderWithClient(
      <Single label="Status" options={STATUSES} initial="confirmed" testId="status" />,
    );
    await user.click(screen.getByTestId('status'));
    await screen.findByTestId('status-panel');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
    unmount();

    tier.current = 'phone';
    const phone = renderWithClient(
      <Single label="Status" options={numbered(12)} testId="status" />,
    );
    await phone.user.click(screen.getByTestId('status'));
    await screen.findByTestId('status-panel');
    expect(await axeForDialog(phone.baseElement)).toHaveNoViolations();
  });
});

describe('Picker — keys', () => {
  it('↓ / ↑ skip disabled rows and wrap; ↵ picks, closes and returns focus', async () => {
    const onPick = vi.fn();
    const { user } = renderWithClient(
      <Single label="Status" options={STATUSES} onPick={onPick} testId="status" />,
    );
    const trigger = screen.getByTestId('status');
    await user.click(trigger);
    await screen.findByTestId('status-panel');
    await waitFor(() => expect(activeRow()).toHaveTextContent('Scheduled'));

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeRow()).toHaveTextContent('Cancelled');
    await user.keyboard('{ArrowDown}');
    expect(activeRow()).toHaveTextContent('Scheduled');
    await user.keyboard('{ArrowUp}');
    expect(activeRow()).toHaveTextContent('Cancelled');

    await user.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('cancelled');
    await waitFor(() =>
      expect(screen.queryByTestId('status-panel')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-label', 'Status · Cancelled');
  });

  it('opens on the current pick, from ↓ on the trigger', async () => {
    const { user } = renderWithClient(
      <Single label="Status" options={STATUSES} initial="confirmed" testId="status" />,
    );
    screen.getByTestId('status').focus();
    await user.keyboard('{ArrowDown}');
    await screen.findByTestId('status-panel');
    await waitFor(() => expect(activeRow()).toHaveTextContent('Confirmed'));
    expect(activeRow()).toHaveAttribute('aria-checked', 'true');
  });

  it('PgDn / PgUp move ±8 rows and Home / End jump to the ends', async () => {
    const { user } = renderWithClient(
      <Single label="Room" options={numbered(12)} searchable={false} testId="room" />,
    );
    await user.click(screen.getByTestId('room'));
    await screen.findByTestId('room-panel');
    await waitFor(() => expect(activeRow()).toHaveTextContent('Option 00'));

    await user.keyboard('{PageDown}');
    expect(activeRow()).toHaveTextContent('Option 08');
    await user.keyboard('{PageDown}');
    expect(activeRow()).toHaveTextContent('Option 11');
    await user.keyboard('{PageUp}');
    expect(activeRow()).toHaveTextContent('Option 03');
    await user.keyboard('{End}');
    expect(activeRow()).toHaveTextContent('Option 11');
    await user.keyboard('{Home}');
    expect(activeRow()).toHaveTextContent('Option 00');
  });

  it('type-ahead jumps to the next row that starts with the letter (no search row)', async () => {
    const options: PickerOption[] = [
      { key: 'botox', label: 'Botox' },
      { key: 'consult', label: 'Consultation' },
      { key: 'peel', label: 'Chemical peel' },
    ];
    const { user } = renderWithClient(
      <Single label="Service" options={options} testId="svc" />,
    );
    await user.click(screen.getByTestId('svc'));
    await screen.findByTestId('svc-panel');
    expect(screen.queryByTestId('svc-search')).not.toBeInTheDocument();

    await user.keyboard('c');
    expect(activeRow()).toHaveTextContent('Consultation');
    await user.keyboard('c');
    expect(activeRow()).toHaveTextContent('Chemical peel');
    await user.keyboard('b');
    expect(activeRow()).toHaveTextContent('Botox');
  });

  it('Esc closes without picking and returns focus; Tab closes too', async () => {
    const onPick = vi.fn();
    const { user } = renderWithClient(
      <Single label="Status" options={STATUSES} onPick={onPick} testId="status" />,
    );
    const trigger = screen.getByTestId('status');
    await user.click(trigger);
    await screen.findByTestId('status-panel');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByTestId('status-panel')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await screen.findByTestId('status-panel');
    await user.keyboard('{Tab}');
    await waitFor(() =>
      expect(screen.queryByTestId('status-panel')).not.toBeInTheDocument(),
    );
    expect(onPick).not.toHaveBeenCalled();
  });

  it('Home / End in the search field move the caret, not the active row', async () => {
    const { user } = renderWithClient(
      <Single label="Room" options={numbered(12)} testId="room" />,
    );
    await user.click(screen.getByTestId('room'));
    const search = await screen.findByTestId('room-search');
    await waitFor(() => expect(search).toHaveFocus());
    await user.keyboard('{End}');
    expect(activeRow()).toHaveTextContent('Option 00');
  });
});

describe('Picker — search and states', () => {
  it('filters as you type and highlights the match', async () => {
    const { user } = renderWithClient(
      <Single label="Room" options={numbered(12)} testId="room" />,
    );
    await user.click(screen.getByTestId('room'));
    const search = await screen.findByTestId('room-search');
    expect(search).toHaveAttribute('placeholder', 'Search room');
    await user.type(search, '1');
    const rows = optionRows();
    expect(rows.map((row) => row.textContent)).toEqual([
      'Option 01',
      'Option 10',
      'Option 11',
    ]);
    expect(rows[0]?.querySelector('mark')).toHaveTextContent('1');
  });

  it('says "No results" with the spelling hint for an unmatched search', async () => {
    const { user } = renderWithClient(
      <Single label="Room" options={numbered(12)} testId="room" />,
    );
    await user.click(screen.getByTestId('room'));
    await user.type(await screen.findByTestId('room-search'), 'zzz');
    const empty = screen.getByTestId('room-empty');
    expect(empty).toHaveTextContent('No results for “zzz”');
    expect(empty).toHaveTextContent('Check the spelling or try fewer letters');
  });

  it('says "Nothing to pick yet" (or the field\'s text) for an empty list', async () => {
    const { user, unmount } = renderWithClient(
      <Single label="Room" options={[]} testId="room" />,
    );
    await user.click(screen.getByTestId('room'));
    expect(await screen.findByTestId('room-empty')).toHaveTextContent(
      'Nothing to pick yet',
    );
    unmount();

    const custom = renderWithClient(
      <Single label="Room" options={[]} emptyText="No rooms yet" testId="room" />,
    );
    await custom.user.click(screen.getByTestId('room'));
    expect(await screen.findByTestId('room-empty')).toHaveTextContent('No rooms yet');
  });

  it('paints destructive options after a separator and dims disabled ones', async () => {
    const options: PickerOption[] = [
      ...STATUSES,
      { key: 'delete', label: 'Delete', destructive: true, leading: { kind: 'none' } },
    ];
    const { user } = renderWithClient(
      <Single label="Status" options={options} testId="status" />,
    );
    await user.click(screen.getByTestId('status'));
    const panel = await screen.findByTestId('status-panel');
    expect(within(panel).getAllByRole('separator')).toHaveLength(1);
    expect(screen.getByTestId('status-option-delete').className).toContain(
      'text-destructive',
    );
    expect(screen.getByTestId('status-option-completed')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('Picker — multi-select', () => {
  function Multi({
    initial,
    onPick,
    options,
  }: {
    initial: string[];
    onPick: (keys: string[]) => void;
    options: PickerOption[];
  }) {
    const [value, setValue] = useState(initial);
    return (
      <Picker
        multiple
        label="Branches"
        options={options}
        value={value}
        clearable
        onChange={(keys) => {
          setValue(keys);
          onPick(keys);
        }}
        testId="branches"
      />
    );
  }

  it('toggles picks with checkboxes and stays open', async () => {
    const onPick = vi.fn();
    const { user } = renderWithClient(
      <Multi initial={['o0']} onPick={onPick} options={numbered(4, 'Branch')} />,
    );
    await user.click(screen.getByTestId('branches'));
    await screen.findByTestId('branches-panel');
    expect(screen.getByTestId('branches-option-o0')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(screen.getByTestId('branches-option-o2'));
    expect(onPick).toHaveBeenLastCalledWith(['o0', 'o2']);
    expect(screen.getByTestId('branches-panel')).toBeInTheDocument();
    expect(screen.getByTestId('branches-option-o2')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(screen.getByTestId('branches-option-o0'));
    expect(onPick).toHaveBeenLastCalledWith(['o2']);
  });

  it('shows up to 3 picks as chips, then "+N", and clears them all', async () => {
    const onPick = vi.fn();
    const { user } = renderWithClient(
      <Multi
        initial={['o0', 'o1', 'o2', 'o3', 'o4']}
        onPick={onPick}
        options={numbered(6, 'Branch')}
      />,
    );
    const trigger = screen.getByTestId('branches');
    expect(within(trigger).getByText('Branch 00')).toBeInTheDocument();
    expect(within(trigger).getByText('Branch 02')).toBeInTheDocument();
    expect(within(trigger).queryByText('Branch 03')).not.toBeInTheDocument();
    expect(within(trigger).getByText('+2')).toBeInTheDocument();

    await user.click(screen.getByTestId('branches-clear'));
    expect(onPick).toHaveBeenLastCalledWith([]);
    expect(screen.queryByTestId('branches-clear')).not.toBeInTheDocument();
  });
});

describe('Picker — create', () => {
  it('offers "Create “<query>”" for an unmatched search; ↵ creates it', async () => {
    const onCreate = vi.fn();
    const { user } = renderWithClient(
      <Single
        label="Supplier"
        options={[{ key: 'cipla', label: 'Cipla' }]}
        onCreate={onCreate}
        testId="supplier"
      />,
    );
    await user.click(screen.getByTestId('supplier'));
    const search = await screen.findByTestId('supplier-search');
    await user.type(search, 'Cipla');
    expect(screen.queryByTestId('supplier-create')).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'Medisafe');
    expect(screen.getByTestId('supplier-create')).toHaveTextContent('Create “Medisafe”');

    await user.keyboard('{Enter}');
    expect(onCreate).toHaveBeenCalledWith('Medisafe');
    await waitFor(() =>
      expect(screen.queryByTestId('supplier-panel')).not.toBeInTheDocument(),
    );
  });

  it('names the create row and the "full details" footer after the field', async () => {
    const onCreateFull = vi.fn();
    const { user } = renderWithClient(
      <Single
        label="Supplier"
        options={[{ key: 'cipla', label: 'Cipla' }]}
        onCreate={() => {}}
        createLabel="Add supplier"
        onCreateFull={onCreateFull}
        createFullLabel="New supplier"
        testId="supplier"
      />,
    );
    await user.click(screen.getByTestId('supplier'));
    expect(await screen.findByTestId('supplier-create-full')).toHaveTextContent(
      'New supplierfull details',
    );
    await user.type(screen.getByTestId('supplier-search'), 'Medisafe');
    expect(screen.getByTestId('supplier-create')).toHaveTextContent(
      'Add supplier “Medisafe”',
    );
    expect(screen.getByTestId('supplier-create-full')).toHaveTextContent(
      'New supplier · “Medisafe”',
    );

    await user.click(screen.getByTestId('supplier-create-full'));
    expect(onCreateFull).toHaveBeenCalledWith('Medisafe');
    await waitFor(() =>
      expect(screen.queryByTestId('supplier-panel')).not.toBeInTheDocument(),
    );
  });

  it('auto-creates on dismiss with an unmatched search — not on Esc', async () => {
    const onCreate = vi.fn();
    const { user } = renderWithClient(
      <Single
        label="Medicine"
        options={[{ key: 'pcm', label: 'Paracetamol' }]}
        onCreate={onCreate}
        autoCreate
        testId="medicine"
      />,
    );
    const trigger = screen.getByTestId('medicine');
    await user.click(trigger);
    await user.type(await screen.findByTestId('medicine-search'), 'Zinc');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByTestId('medicine-panel')).not.toBeInTheDocument(),
    );
    expect(onCreate).not.toHaveBeenCalled();

    await user.click(trigger);
    await user.type(await screen.findByTestId('medicine-search'), 'Zinc');
    await user.keyboard('{Tab}');
    expect(onCreate).toHaveBeenCalledWith('Zinc');
  });
});

describe('Picker — Recent', () => {
  it('opens a single-select list of more than 7 on Recent, newest first, then All', async () => {
    await saveMyPreferences({
      recentPicks: ['appointments:room:o5', 'leads:room:o1', 'appointments:room:o2'],
    });
    const { user } = renderWithClient(
      <Single
        label="Room"
        options={numbered(10)}
        recentKey="appointments:room"
        testId="room"
      />,
    );
    await user.click(screen.getByTestId('room'));
    const panel = await screen.findByTestId('room-panel');
    await waitFor(() =>
      expect(within(panel).getByRole('group', { name: 'Recent' })).toBeInTheDocument(),
    );
    const recent = within(
      within(panel).getByRole('group', { name: 'Recent' }),
    ).getAllByRole('option');
    expect(recent.map((row) => row.textContent)).toEqual(['Option 05', 'Option 02']);
    expect(within(panel).getByRole('group', { name: 'All' })).toBeInTheDocument();
  });

  it('records a pick on the preferences as an id, newest first', async () => {
    await saveMyPreferences({ recentPicks: ['appointments:room:o2'] });
    const { user } = renderWithClient(
      <Single
        label="Room"
        options={numbered(10)}
        recentKey="appointments:room"
        testId="room"
      />,
    );
    await user.click(screen.getByTestId('room'));
    await screen.findByTestId('room-panel');
    await user.click(await screen.findByTestId('room-option-o7'));

    await waitFor(async () =>
      expect((await fetchMyPreferences()).recentPicks).toEqual([
        'appointments:room:o7',
        'appointments:room:o2',
      ]),
    );
  });

  it('keeps no Recent group for short lists, searches, multi-selects or menus', async () => {
    await saveMyPreferences({ recentPicks: ['appointments:room:o1'] });
    const { user } = renderWithClient(
      <Single
        label="Room"
        options={numbered(5)}
        recentKey="appointments:room"
        testId="room"
      />,
    );
    await user.click(screen.getByTestId('room'));
    const panel = await screen.findByTestId('room-panel');
    expect(
      within(panel).queryByRole('group', { name: 'Recent' }),
    ).not.toBeInTheDocument();
  });
});

describe('Picker — paging', () => {
  it('renders 30 rows, then the next 30 when scrolled near the end', async () => {
    const { user } = renderWithClient(
      <Single label="Room" options={numbered(70)} testId="room" />,
    );
    await user.click(screen.getByTestId('room'));
    const panel = await screen.findByTestId('room-panel');
    expect(optionRows()).toHaveLength(30);
    const scroller = panel.querySelector<HTMLElement>('[data-picker-scroll]');
    if (!scroller) throw new Error('no scroller');
    fireEvent.scroll(scroller);
    await waitFor(() => expect(optionRows()).toHaveLength(60));
  });

  it('loads the next page when ↓ reaches the last 3 rows', async () => {
    const { user } = renderWithClient(
      <Single label="Room" options={numbered(40)} searchable={false} testId="room" />,
    );
    await user.click(screen.getByTestId('room'));
    await screen.findByTestId('room-panel');
    await user.keyboard('{End}');
    await waitFor(() => expect(optionRows()).toHaveLength(40));
  });

  it('pages remote options: skeleton first, then rows, then the next cursor', async () => {
    const all = numbered(45, 'Patient');
    // Each page waits for the test to release it, so the loading states can be seen.
    const gates: (() => void)[] = [];
    const loadOptions = vi.fn(async (query: string, cursor: string | undefined) => {
      await new Promise<void>((release) => gates.push(release));
      const start = Number(cursor ?? 0);
      const hits = all.filter((option) => option.label.toLowerCase().includes(query));
      const more = start + 30 < hits.length;
      return {
        rows: hits.slice(start, start + 30),
        next: more ? String(start + 30) : null,
        hasMore: more,
      };
    });
    const { user } = renderWithClient(
      <Single
        label="Patient"
        loadOptions={loadOptions}
        loadOptionsKey={['test', 'patients']}
        testId="patient"
      />,
    );
    await user.click(screen.getByTestId('patient'));
    const panel = await screen.findByTestId('patient-panel');
    expect(await screen.findByTestId('patient-loading')).toHaveTextContent('Loading');
    expect(panel.querySelector('.animate-spinner')).not.toBeNull();
    expect(screen.getByTestId('patient-search')).toHaveAttribute(
      'placeholder',
      'Search patient',
    );
    await waitFor(() => expect(gates).toHaveLength(1));
    gates[0]?.();
    await waitFor(() => expect(optionRows()).toHaveLength(30));
    expect(screen.queryByTestId('patient-loading')).not.toBeInTheDocument();
    expect(loadOptions).toHaveBeenCalledWith('', undefined);

    const scroller = panel.querySelector<HTMLElement>('[data-picker-scroll]');
    if (!scroller) throw new Error('no scroller');
    fireEvent.scroll(scroller);
    await waitFor(() => expect(loadOptions).toHaveBeenCalledWith('', '30'));
    expect(await screen.findByTestId('patient-loading-more')).toHaveAttribute(
      'aria-label',
      'Loading more',
    );
    await waitFor(() => expect(gates).toHaveLength(2));
    gates[1]?.();
    await waitFor(() => expect(optionRows()).toHaveLength(45));
    expect(screen.queryByTestId('patient-loading-more')).not.toBeInTheDocument();
  });

  it('searches remote options after the debounce and hints at names, phones and ids', async () => {
    const loadOptions = vi.fn((query: string) =>
      Promise.resolve({
        rows: query ? [] : numbered(3, 'Patient'),
        next: null,
        hasMore: false,
      }),
    );
    const { user } = renderWithClient(
      <Single
        label="Patient"
        loadOptions={loadOptions}
        loadOptionsKey={['test', 'patients', 'search']}
        testId="patient"
      />,
    );
    await user.click(screen.getByTestId('patient'));
    await waitFor(() => expect(optionRows()).toHaveLength(3));
    await user.type(screen.getByTestId('patient-search'), 'zz');
    await waitFor(() => expect(loadOptions).toHaveBeenCalledWith('zz', undefined));
    const empty = await screen.findByTestId('patient-empty');
    expect(empty).toHaveTextContent('No results for “zz”');
    expect(empty).toHaveTextContent('Try a name, phone number or ID');
  });
});

describe('Picker — custom trigger and menus', () => {
  it('renders a caller trigger with the open state', async () => {
    const onChange = vi.fn();
    const { user } = renderWithClient(
      <Picker
        label="More pinned sections"
        options={numbered(3, 'Room')}
        value={null}
        onChange={onChange}
        menu
        testId="more"
        renderTrigger={({ open }) => (
          <button type="button" data-testid="more-trigger">
            {open ? 'Less' : 'More'}
          </button>
        )}
      />,
    );
    await user.click(screen.getByTestId('more-trigger'));
    await screen.findByTestId('more-panel');
    expect(screen.getByTestId('more-trigger')).toHaveTextContent('Less');
    expect(screen.getByTestId('more-option-o1')).not.toHaveAttribute('aria-checked');
    await user.click(screen.getByTestId('more-option-o1'));
    expect(onChange).toHaveBeenCalledWith('o1', expect.objectContaining({ key: 'o1' }));
  });
});
