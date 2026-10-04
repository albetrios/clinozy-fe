import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  OFFERS_URL,
  renderOfferingsRoutes,
  resetOfferingsRoutes,
} from '../../../__tests__/integration/offerings-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

/** 10:00 on the seed day, clinic time: Navratri glow and LHR launch run, Monsoon has ended. */
const NOW = new Date('2026-09-27T04:30:00Z');
const D = 'offer-drawer';

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

const drawer = () => screen.findByTestId(D);
const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const stepOf = (id: string) => screen.getByTestId(`${D}-step-${id}`);
const rows = () => screen.getAllByTestId('offers-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

/** The Offers tab with the offers loaded. */
async function openList(role?: 'admin' | 'counsellor', url = OFFERS_URL) {
  const view = renderOfferingsRoutes(url, { role });
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return view;
}

/** Pick offerings by their seq in the Offerings picker, then close its list. */
async function pickOfferings(user: ReturnType<typeof setUser>, seqs: readonly number[]) {
  await user.click(part('offerings'));
  await screen.findByTestId(`${D}-offerings-panel`);
  for (const seq of seqs) {
    await user.click(screen.getByTestId(`${D}-offerings-option-${ref.offering(seq)}`));
  }
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByTestId(`${D}-offerings-panel`)).not.toBeInTheDocument(),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  useLocaleStore.setState({ formatLocale: 'en-IN' });
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  useLocaleStore.setState({ formatLocale: 'en-US' });
  resetOfferingsRoutes();
  resetClinicFixtures();
});

describe('OfferDrawer — New offer (KICKOFF §6.11)', () => {
  it('opens from "New offer" with its header, three steps and footer', async () => {
    const user = setUser();
    const { router } = await openList();
    await user.click(screen.getByTestId('offers-new-button'));
    const panel = await drawer();
    expect(router.state.location.pathname).toBe(`${OFFERS_URL}/create`);
    expect(part('title')).toHaveTextContent('New offer');
    expect(
      within(panel).getByText(
        'A limited-time price on one or more offerings · applies by itself',
      ),
    ).toBeVisible();
    expect(part('badges')).toHaveTextContent('New offer10% off');
    expect(within(stepOf('offer')).getByText('Offer')).toBeVisible();
    expect(within(stepOf('where')).getByText('Where it applies')).toBeVisible();
    expect(within(stepOf('notes')).getByText('Notes')).toBeVisible();
    expect(stepOf('where')).toHaveTextContent('Missing: Offerings');
    expect(part('summary')).toHaveTextContent('New offer · 10% off');
    expect(part('save')).toHaveTextContent('Create offer');
    expect(screen.queryByTestId(`${D}-save-and-add`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-quick-fill`)).not.toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('names what is missing first: the name, then the offerings', async () => {
    const user = setUser();
    await openList('admin', `${OFFERS_URL}/create`);
    await drawer();
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Name the offer');
    expect(stepOf('offer')).toHaveAttribute('data-status', 'open');
    await user.type(part('name'), 'Diwali glow');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick at least one offering');
    expect(stepOf('where')).toHaveAttribute('data-status', 'open');
  });

  it('upper-cases the code and strips its spaces as typed', async () => {
    const user = setUser();
    await openList('admin', `${OFFERS_URL}/create`);
    await drawer();
    await user.type(part('code'), 'glow 20');
    expect(part('code')).toHaveValue('GLOW20');
  });

  it('resets the value when the Type changes, and asks for one before saving', async () => {
    const user = setUser();
    await openList('admin', `${OFFERS_URL}/create`);
    await drawer();
    expect(part('value')).toHaveValue('10');
    await user.click(part('value-quick-25'));
    expect(part('value')).toHaveValue('25');
    expect(part('badges')).toHaveTextContent('25% off');

    await user.click(part('kind-amount'));
    expect(part('value')).toHaveValue('500');
    expect(stepOf('offer')).toHaveTextContent('Amount off');
    await user.click(part('kind-extra'));
    expect(part('value')).toHaveValue('1');
    expect(stepOf('offer')).toHaveTextContent('Free sessions');
    await user.click(part('kind-fixed'));
    expect(part('value')).toHaveValue('');
    expect(stepOf('offer')).toHaveTextContent('Offer price');

    await user.type(part('name'), 'Festive price');
    await user.click(part('step-where-trigger'));
    await pickOfferings(user, [271]);
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Set the amount');
    expect(stepOf('offer')).toHaveAttribute('data-status', 'open');
    expect(notifyMock.success).not.toHaveBeenCalled();
  });

  it('previews the offer on each picked offering, never below its lowest price', async () => {
    const user = setUser();
    await openList('admin', `${OFFERS_URL}/create`);
    await drawer();
    await user.click(part('step-where-trigger'));
    await pickOfferings(user, [274, 273]);
    expect(part(`preview-${ref.offering(274)}`)).toHaveTextContent('₹1,200 → ₹1,150');
    expect(part(`preview-${ref.offering(273)}`)).toHaveTextContent('₹7,500 → ₹6,750');
    expect(part('summary')).toHaveTextContent('New offer · 10% off · 2 offerings');
  });

  it('creates the offer, closes onto the list and names it in the toast', async () => {
    const user = setUser();
    const { router } = await openList('admin', `${OFFERS_URL}/create?status=live`);
    await drawer();
    await user.type(part('name'), 'Diwali glow');
    await user.click(part('step-where-trigger'));
    await pickOfferings(user, [270]);
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Diwali glow created · applies automatically',
      ),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
    expect(router.state.location.search).toMatchObject({ status: ['live'] });
    const created = clinicFixtures.offers.snapshot(
      (offer) => offer.name === 'Diwali glow',
    );
    expect(created[0]).toMatchObject({
      kind: 'percent',
      value: 10,
      offeringIds: [ref.offering(270)],
      paused: false,
      tone: 'blush',
    });
  });

  it('keeps a create link from a role that cannot price offers (Q-U8)', async () => {
    const { router } = renderOfferingsRoutes(`${OFFERS_URL}/create`, {
      role: 'counsellor',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(D)).not.toBeInTheDocument();
  });
});

describe('OfferDrawer — Edit offer', () => {
  it('opens a row with its name as the tag and its values in place', async () => {
    const user = setUser();
    const { router } = await openList();
    await user.click(within(rowOf('GLOW20')).getByText('Navratri glow'));
    const panel = await drawer();
    expect(router.state.location.pathname).toBe(`${OFFERS_URL}/${ref.offer(31)}/edit`);
    expect(part('title')).toHaveTextContent('Edit offer');
    expect(part('tag')).toHaveTextContent('Navratri glow');
    expect(part('name')).toHaveValue('Navratri glow');
    expect(part('code')).toHaveValue('GLOW20');
    expect(part('value')).toHaveValue('20');
    expect(part('summary')).toHaveTextContent('Navratri glow · 20% off · 3 offerings');
    expect(part('save')).toHaveTextContent('Save offer');
    expect(part('delete')).toBeVisible();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('saves its changes and closes onto the list', async () => {
    const user = setUser();
    const { router } = await openList();
    await user.click(within(rowOf('GLOW20')).getByText('Navratri glow'));
    await drawer();
    await user.clear(part('code'));
    await user.type(part('code'), 'glow25');
    await user.click(part('value-quick-25'));
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Navratri glow saved'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
    const [saved] = clinicFixtures.offers.snapshot((offer) => offer.id === ref.offer(31));
    expect(saved).toMatchObject({ code: 'GLOW25', value: 25 });
  });

  it('is view only for a role without Edit: no Save, no Delete', async () => {
    const user = setUser();
    await openList('counsellor');
    expect(screen.queryByTestId('offers-new-button')).not.toBeInTheDocument();
    await user.click(within(rowOf('GLOW20')).getByText('Navratri glow'));
    await drawer();
    expect(screen.queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    expect(part('footer')).toHaveTextContent('View only · your role can’t change this');
    expect(part('name')).toBeDisabled();
  });

  it('sends an unknown offer back to the list with "Offer not found" (S:115)', async () => {
    const { router } = renderOfferingsRoutes(`${OFFERS_URL}/${ref.offer(1)}/edit`);
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Offer not found · it may have been deleted',
    );
  });

  it('closes with Escape (§7.3)', async () => {
    const { router } = await openList('admin', `${OFFERS_URL}/${ref.offer(30)}/edit`);
    await drawer();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
  });
});

describe('the Offers tab’s row actions (H:5483)', () => {
  it('pauses a running offer and resumes it, never an ended one', async () => {
    const user = setUser();
    await openList();
    const glow = rowOf('GLOW20');
    expect(within(rowOf('RAIN500')).queryByTestId('offers-row-action-pause')).toBeNull();
    expect(within(rowOf('RAIN500')).queryByTestId('offers-row-action-resume')).toBeNull();
    await user.click(within(glow).getByTestId('offers-row-action-pause'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Navratri glow paused',
        expect.objectContaining({ id: 'clinic-offer-paused' }),
      ),
    );
    await waitFor(() =>
      expect(
        within(rowOf('GLOW20')).getByTestId('offers-row-action-resume'),
      ).toBeVisible(),
    );
    await user.click(within(rowOf('GLOW20')).getByTestId('offers-row-action-resume'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Navratri glow running again',
        expect.objectContaining({ id: 'clinic-offer-paused' }),
      ),
    );
  });

  it('gives a viewer no Edit, Pause or Delete', async () => {
    await openList('counsellor');
    const glow = rowOf('GLOW20');
    expect(within(glow).queryByTestId('offers-row-action-edit')).toBeNull();
    expect(within(glow).queryByTestId('offers-row-action-pause')).toBeNull();
    expect(within(glow).queryByTestId('offers-row-action-delete')).toBeNull();
  });
});
