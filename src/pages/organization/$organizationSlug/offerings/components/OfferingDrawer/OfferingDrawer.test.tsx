import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  OFFERINGS_URL,
  renderOfferingsRoutes,
  resetOfferingsRoutes,
} from '../../__tests__/integration/offerings-test-router.tsx';

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

/** The next create fails with this, once. */
const api = vi.hoisted(() => ({ createError: null as unknown }));
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof OfferingsApiModule>();
  return {
    ...actual,
    createOffering: async (input: Parameters<typeof actual.createOffering>[0]) => {
      const error = api.createError;
      if (error) {
        api.createError = null;
        throw error;
      }
      return actual.createOffering(input);
    },
  };
});

/** 10:00 on 3 Oct, clinic time — the seed day is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const D = 'offering-drawer';

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

const drawer = () => screen.findByTestId(D);
const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const stepOf = (id: string) => screen.getByTestId(`${D}-step-${id}`);
const rows = () => screen.getAllByTestId('offerings-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

/** The Offerings tab with the catalogue loaded. */
async function openList(role?: 'admin' | 'counsellor', url = OFFERINGS_URL) {
  const view = renderOfferingsRoutes(url, { role });
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return view;
}

/** Fill Name and Price, the two required fields. */
async function fillRequired(
  user: ReturnType<typeof setUser>,
  { name = 'Hydra facial', price = '1500' } = {},
) {
  await user.type(part('name'), name);
  await user.type(part('price'), price);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  api.createError = null;
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetOfferingsRoutes();
  resetClinicFixtures();
});

describe('OfferingDrawer — New offering (KICKOFF §6.11)', () => {
  it('opens from "New offering" with the design’s header, Quick fill, steps and footer', async () => {
    const user = setUser();
    const { router } = await openList();
    await user.click(screen.getByTestId('offerings-new-button'));
    const panel = await drawer();
    expect(router.state.location.pathname).toBe(`${OFFERINGS_URL}/create`);
    expect(part('title')).toHaveTextContent('New offering');
    expect(
      within(panel).getByText('Used in bookings, invoices and packages'),
    ).toBeVisible();
    expect(part('badges')).toHaveTextContent('Treatment');
    expect(
      within(part('quick-fill'))
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['Single session', '6-session pack', 'LHR 10-pack', 'Consultation']);
    expect(
      within(stepOf('offering')).getByText('Offering, price & sessions'),
    ).toBeVisible();
    expect(stepOf('offering')).toHaveTextContent('Treatment · All branches · 1 · 0%');
    expect(within(stepOf('time')).getByText('Time, validity & details')).toBeVisible();
    expect(part('summary')).toHaveTextContent('Untitled · Treatment');
    expect(part('save')).toHaveTextContent('Create offering');
    expect(part('save-and-add')).toHaveTextContent('Create & add another');
    expect(screen.queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('prefills the name from ?name= and starts every field at its default', async () => {
    await openList('admin', `${OFFERINGS_URL}/create?name=Hydra%20facial`);
    await drawer();
    expect(part('name')).toHaveValue('Hydra facial');
    expect(part('category-treatment')).toHaveAttribute('aria-pressed', 'true');
    expect(part('colour-sage')).toHaveAttribute('aria-checked', 'true');
    expect(part('branches-all')).toHaveAttribute('aria-pressed', 'true');
    expect(part('sessions')).toHaveValue('1');
    expect(part('gst')).toHaveAttribute('aria-checked', 'false');
    expect(part('gst')).toHaveTextContent('Exclusive');
    expect(part('floor-toggle')).toHaveTextContent('Hidden · tap to set');
  });

  it('never disables Save: an empty Name, then Price, opens step 1 with its toast', async () => {
    const user = setUser();
    await openList('admin', `${OFFERINGS_URL}/create`);
    await drawer();
    await user.click(part('step-time-trigger'));
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add a name');
    expect(stepOf('offering')).toHaveAttribute('data-status', 'open');
    await user.type(part('name'), 'Hydra facial');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add a price');
    expect(notifyMock.success).not.toHaveBeenCalled();
  });

  it('marks a closed step that has a gap with "!" and "Missing: Name, Price"', async () => {
    const user = setUser();
    await openList('admin', `${OFFERINGS_URL}/create`);
    await drawer();
    await user.click(part('step-time-trigger'));
    expect(stepOf('offering')).toHaveAttribute('data-status', 'missing');
    expect(stepOf('offering')).toHaveTextContent('Missing: Name, Price');
  });

  it('prices the draft live: the Offer price hint, Billed today, the badges and the footer', async () => {
    const user = setUser();
    await openList('admin', `${OFFERINGS_URL}/create`);
    await drawer();
    await fillRequired(user);
    expect(screen.getByText('what you bill · leave empty = list price')).toBeVisible();
    await user.type(part('offer-price'), '1200');
    expect(screen.getByText('what you bill · 20% below list')).toBeVisible();
    expect(part('billed-today')).toHaveTextContent('₹1,200 · 20% below list');
    expect(part('badges')).toHaveTextContent('Treatment₹1,200');
    expect(part('summary')).toHaveTextContent('Hydra facial · Treatment · ₹1,200');
  });

  it('fills a Quick fill preset without saving it', async () => {
    const user = setUser();
    await openList('admin', `${OFFERINGS_URL}/create`);
    await drawer();
    await user.click(part('quick-fill-pack'));
    expect(part('category-package')).toHaveAttribute('aria-pressed', 'true');
    expect(part('sessions')).toHaveValue('6');
    expect(part('badges')).toHaveTextContent('6 sessions');
    expect(part('summary')).toHaveTextContent('Untitled · Package · 6 sessions');
    await user.click(part('quick-fill-lhr'));
    expect(part('colour-blush')).toHaveAttribute('aria-checked', 'true');
    expect(notifyMock.success).not.toHaveBeenCalled();
  });

  it('checks the price rules before the write (H:5507)', async () => {
    const user = setUser();
    await openList('admin', `${OFFERINGS_URL}/create`);
    await drawer();
    await fillRequired(user, { price: '1000' });
    await user.type(part('offer-price'), '1200');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith(
      'Offer price can’t be above the price',
    );
    expect(part('offer-price')).toHaveAttribute('aria-invalid', 'true');

    await user.clear(part('offer-price'));
    await user.type(part('offer-price'), '800');
    await user.click(part('floor-toggle'));
    expect(part('floor-toggle')).toHaveTextContent('Shown · only you can see it');
    await user.type(part('floor'), '900');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith(
      'Lowest price can’t be above the offer price',
    );
    expect(notifyMock.success).not.toHaveBeenCalled();
  });

  it('creates the offering, closes onto the list and puts it first (D28)', async () => {
    const user = setUser();
    const { router } = await openList('admin', `${OFFERINGS_URL}/create?q=peel`);
    await drawer();
    await fillRequired(user);
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Offering #275 created'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS_URL));
    expect(router.state.location.search).toMatchObject({ q: 'peel' });
    const created = clinicFixtures.offerings.snapshot(
      (offering) => offering.name === 'Hydra facial',
    );
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ price: 150_000, offerPrice: null, minPrice: 0 });
  });

  it('"Create & add another" saves, then starts again blank', async () => {
    const user = setUser();
    const { router } = await openList('admin', `${OFFERINGS_URL}/create?name=Hydra`);
    await drawer();
    await user.type(part('price'), '900');
    await user.click(part('save-and-add'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Offering #275 created'),
    );
    await waitFor(() => expect(part('name')).toHaveValue(''));
    expect(part('price')).toHaveValue('');
    expect(router.state.location.pathname).toBe(`${OFFERINGS_URL}/create`);
  });

  it('keeps the draft when the server refuses the name, and outlines it (S:1739)', async () => {
    const user = setUser();
    await openList('admin', `${OFFERINGS_URL}/create`);
    await drawer();
    await fillRequired(user, { name: 'Back Peeling' });
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'An offering with this name already exists',
      ),
    );
    expect(part('name')).toHaveAttribute('aria-invalid', 'true');
    expect(part('name')).toHaveValue('Back Peeling');
  });

  it('keeps the draft when the connection drops: "Not saved", "Retry save"', async () => {
    const user = setUser();
    api.createError = new TypeError('Failed to fetch');
    await openList('admin', `${OFFERINGS_URL}/create`);
    await drawer();
    await fillRequired(user);
    await user.click(part('save'));
    await waitFor(() => expect(part('save')).toHaveTextContent('Retry save'));
    expect(part('not-saved')).toHaveTextContent('Not saved · your changes are kept');
    expect(notifyMock.error).toHaveBeenCalledWith(
      'Couldn’t save · connection dropped. Everything you entered is still here.',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }),
    );
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Offering #275 created'),
    );
  });

  it('sends a create link back to the list for a role without Create', async () => {
    const { router } = renderOfferingsRoutes(`${OFFERINGS_URL}/create`, {
      role: 'counsellor',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS_URL));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(D)).not.toBeInTheDocument();
  });
});

describe('OfferingDrawer — Edit offering', () => {
  it('opens a row with its id, its values and three steps while an offer runs on it', async () => {
    const user = setUser();
    // "Peel pack + 1 free" starts four days after the seed day: open its start.
    await clinicFixtures.offers.update(ref.offer(29), { startsOn: null });
    const { router } = await openList();
    await user.click(within(rowOf('#273')).getByText('Underarm Peel · 6 sessions'));
    const panel = await drawer();
    expect(router.state.location.pathname).toBe(
      `${OFFERINGS_URL}/${ref.offering(273)}/edit`,
    );
    expect(part('title')).toHaveTextContent('Edit offering');
    expect(part('tag')).toHaveTextContent('#273');
    expect(part('name')).toHaveValue('Underarm Peel · 6 sessions');
    expect(part('billed-today')).toHaveTextContent(
      '₹7,500 · +1 free session · 17% below list',
    );
    expect(part('summary')).toHaveTextContent(
      'Underarm Peel · 6 sessions · Package · ₹7,500 · 6 sessions',
    );
    expect(
      within(stepOf('time')).getByText('Offers on this, time & validity'),
    ).toBeVisible();
    expect(within(stepOf('details')).getByText('Details')).toBeVisible();
    await user.click(part('step-offering-next'));
    expect(within(panel).getByTestId(`${D}-offer-${ref.offer(29)}`)).toHaveTextContent(
      /^\+1 session · Running · till \S/,
    );
    expect(part('save')).toHaveTextContent('Save changes');
    expect(part('delete')).toBeVisible();
    expect(screen.queryByTestId(`${D}-quick-fill`)).not.toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('keeps two steps for an offering with no offer that has not ended', async () => {
    const user = setUser();
    await openList();
    await user.click(within(rowOf('#270')).getByText('Corn Removal'));
    await drawer();
    expect(within(stepOf('time')).getByText('Time, validity & details')).toBeVisible();
    expect(screen.queryByTestId(`${D}-step-details`)).not.toBeInTheDocument();
  });

  it('saves its changes and closes onto the list', async () => {
    const user = setUser();
    const { router } = await openList();
    await user.click(within(rowOf('#270')).getByText('Corn Removal'));
    await drawer();
    await user.clear(part('name'));
    await user.type(part('name'), 'Corn removal · laser');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Offering #270 saved'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS_URL));
    await waitFor(() => expect(rowOf('#270')).toHaveTextContent('Corn removal · laser'));
  });

  it('opens on the step it had open last for the same record', async () => {
    const user = setUser();
    await openList();
    await user.click(within(rowOf('#270')).getByText('Corn Removal'));
    await drawer();
    await user.click(part('step-time-trigger'));
    await user.click(part('dismiss'));
    await waitFor(() => expect(screen.queryByTestId(D)).not.toBeInTheDocument());

    await user.click(within(rowOf('#270')).getByText('Corn Removal'));
    await drawer();
    expect(stepOf('time')).toHaveAttribute('data-status', 'open');
    await user.click(part('dismiss'));
    await waitFor(() => expect(screen.queryByTestId(D)).not.toBeInTheDocument());

    await user.click(within(rowOf('#272')).getByText('Underarm Peel'));
    await drawer();
    expect(stepOf('offering')).toHaveAttribute('data-status', 'open');
  });

  it('deletes from the drawer through the reason confirm, and closes', async () => {
    const user = setUser();
    const { router } = await openList();
    await user.click(within(rowOf('#270')).getByText('Corn Removal'));
    await drawer();
    await user.click(part('delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this offering?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Corn Removal',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS_URL));
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Offering #270 removed',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
  });

  it('is view only for a role without Edit: no Save, no Delete, every field locked', async () => {
    const user = setUser();
    await openList('counsellor');
    expect(screen.queryByTestId('offerings-new-button')).not.toBeInTheDocument();
    await user.click(within(rowOf('#270')).getByText('Corn Removal'));
    await drawer();
    expect(screen.queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    expect(part('footer')).toHaveTextContent('View only · your role can’t change this');
    expect(part('name')).toBeDisabled();
    expect(part('price')).toBeDisabled();
  });

  it('sends an unknown offering back to the list with "Offering not found" (S:115)', async () => {
    const { router } = renderOfferingsRoutes(
      `${OFFERINGS_URL}/${ref.offering(1)}/edit?q=peel`,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS_URL));
    expect(router.state.location.search).toMatchObject({ q: 'peel' });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Offering not found · it may have been deleted',
    );
  });

  it('closes with Escape back to the list', async () => {
    const { router } = await openList(
      'admin',
      `${OFFERINGS_URL}/${ref.offering(270)}/edit`,
    );
    await drawer();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS_URL));
  });
});
