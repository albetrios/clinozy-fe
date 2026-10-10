import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import {
  createOffer,
  deleteOffer,
  fetchOffer,
  updateOffer,
} from '@/shared/api/clinic/offerings-api.ts';
import type { OfferRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  apiRefusal,
  codeInUseRefusal,
  DEFAULT_GST_ID,
  GLOW_OFFER_ID,
  inactiveOfferingRefusal,
  type OffersWorld,
  PEEL_ID,
  PROBE_ID,
  PROBE_OFFER_ID,
  seededOffersWorld,
} from '../../__tests__/integration/offers-test-data.ts';
import {
  COUNSELLOR_CODES,
  OFFERS_URL,
  renderOffersRoutes,
  resetOffersRoutes,
} from '../../__tests__/integration/offers-test-router.tsx';

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

const world = vi.hoisted(() => ({}) as OffersWorld);
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => {
  const { offersApiDouble } =
    await import('../../__tests__/integration/offers-test-data.ts');
  return {
    ...(await importOriginal<typeof OfferingsApiModule>()),
    ...offersApiDouble(world),
  };
});

/** 10 Oct 2026, clinic time. */
const NOW = new Date('2026-10-10T06:30:00Z');
const D = 'offer-drawer';

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

const drawer = () => screen.findByTestId(D);
const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const stepOf = (id: string) => screen.getByTestId(`${D}-step-${id}`);
const rows = () => screen.getAllByTestId('offers-table-row');

/** The Offers tab at `url` with its offers loaded. */
async function openAt(url: string, options?: Parameters<typeof renderOffersRoutes>[1]) {
  const view = renderOffersRoutes(url, options);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return view;
}

/** New offer, its Save in place — the member's access resolved. */
async function openCreate() {
  const view = await openAt(`${OFFERS_URL}/create`);
  await drawer();
  await waitFor(() => expect(part('save')).toBeInTheDocument());
  return view;
}

/** An offer's Edit drawer, its Save in place. */
async function openEdit(
  offerId: string,
  options?: Parameters<typeof renderOffersRoutes>[1],
) {
  const view = await openAt(`${OFFERS_URL}/${offerId}/edit`, options);
  await drawer();
  return view;
}

/** Pick offerings by id in the Offerings picker, then close its list. */
async function pickOfferings(user: ReturnType<typeof setUser>, ids: readonly string[]) {
  await user.click(part('offerings'));
  await screen.findByTestId(`${D}-offerings-panel`);
  for (const id of ids) {
    await user.click(screen.getByTestId(`${D}-offerings-option-${id}`));
  }
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByTestId(`${D}-offerings-panel`)).not.toBeInTheDocument(),
  );
}

/** The last refusal toast's "Reload" — a stale save's. */
function reloadAction(): () => void {
  const call = notifyMock.error.mock.lastCall as
    [string, { action?: { label: string; onClick: () => void } }] | undefined;
  const action = call?.[1]?.action;
  if (action?.label !== 'Reload') throw new Error('no Reload on the last toast');
  return action.onClick;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  useLocaleStore.setState({ formatLocale: 'en-IN' });
  Object.assign(world, seededOffersWorld());
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(createOffer).mockClear();
  vi.mocked(updateOffer).mockClear();
  vi.mocked(deleteOffer).mockClear();
  vi.mocked(fetchOffer).mockReset();
  vi.mocked(fetchOffer).mockImplementation(async (offerId: string) => {
    const offer = world.offers.find((candidate) => candidate.id === offerId);
    if (!offer) throw apiRefusal(404, { code: 'not_found', detail: 'Offer not found' });
    return structuredClone(offer);
  });
});
afterEach(() => {
  vi.useRealTimers();
  useLocaleStore.setState({ formatLocale: 'en-US' });
  resetOffersRoutes();
});

describe('OfferDrawer — New offer (POST /app/offers)', () => {
  it('opens from "New offer" with its header, three steps and footer', async () => {
    const user = setUser();
    const { router } = await openAt(OFFERS_URL);
    await user.click(await screen.findByTestId('offers-new-button'));
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
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('names what is missing first: the name, then the offerings', async () => {
    const user = setUser();
    await openCreate();
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Name the offer');
    expect(stepOf('offer')).toHaveAttribute('data-status', 'open');
    await user.type(part('name'), 'Diwali glow');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick at least one offering');
    expect(stepOf('where')).toHaveAttribute('data-status', 'open');
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('keeps the code to letters and digits, upper case, as the API takes it', async () => {
    const user = setUser();
    await openCreate();
    await user.type(part('code'), 'glow-20 x!');
    expect(part('code')).toHaveValue('GLOW20X');
  });

  it('resets the value when the Type changes, and asks for one before saving', async () => {
    const user = setUser();
    await openCreate();
    expect(part('value')).toHaveValue('10');
    await user.click(part('value-quick-25'));
    expect(part('badges')).toHaveTextContent('25% off');
    await user.click(part('kind-amount'));
    expect(part('value')).toHaveValue('500');
    await user.click(part('kind-extra'));
    expect(part('value')).toHaveValue('1');
    await user.click(part('kind-fixed'));
    expect(part('value')).toHaveValue('');
    await user.type(part('name'), 'Festive price');
    await user.click(part('step-where-trigger'));
    await pickOfferings(user, [PEEL_ID]);
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Set the amount');
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('previews the offer in rupees on each picked offering, never below its floor', async () => {
    const user = setUser();
    await openCreate();
    await user.click(part('kind-amount'));
    await user.clear(part('value'));
    await user.type(part('value'), '450.50');
    await user.click(part('step-where-trigger'));
    await pickOfferings(user, [PEEL_ID, PROBE_ID]);
    // Research Peel bills ₹1,800 and floors at ₹1,500; the Probe ₹1,400 floors at ₹1,000.
    expect(part(`preview-${PEEL_ID}`)).toHaveTextContent('₹1,800 → ₹1,500');
    expect(part(`preview-${PROBE_ID}`)).toHaveTextContent('₹1,400 → ₹1,000');
    expect(part('summary')).toHaveTextContent('New offer · ₹450.50 off · 2 offerings');
  });

  it('creates the offer — rupees as typed — and closes onto the list', async () => {
    const user = setUser();
    const { router } = await openAt(`${OFFERS_URL}/create?q=glow`);
    await drawer();
    await waitFor(() => expect(part('save')).toBeInTheDocument());
    await user.type(part('name'), 'Diwali glow');
    await user.type(part('code'), 'glow25');
    await user.click(part('kind-amount'));
    await user.clear(part('value'));
    await user.type(part('value'), '99.5');
    await user.click(part('step-where-trigger'));
    await pickOfferings(user, [PEEL_ID]);
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Diwali glow created · applies automatically',
      ),
    );
    expect(createOffer).toHaveBeenCalledWith({
      fields: {
        name: 'Diwali glow',
        code: 'GLOW25',
        kind: 'amount',
        value: 99.5,
        tone: 'blush',
        offeringIds: [PEEL_ID],
        branchIds: [],
        startsOn: null,
        endsOn: null,
        isActive: true,
        note: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(world.created[0]).toMatchObject({ code: 'GLOW25', value: 99.5 });
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
    expect(router.state.location.search).toMatchObject({ q: 'glow' });
  });

  it('outlines the code another live offer uses (409 offer_code_in_use)', async () => {
    const user = setUser();
    await openCreate();
    await user.type(part('name'), 'Copy');
    await user.type(part('code'), 'p0probe');
    await user.click(part('step-where-trigger'));
    await pickOfferings(user, [PEEL_ID]);
    world.refuseNext = codeInUseRefusal();
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Another live offer already uses this code',
        expect.anything(),
      ),
    );
    expect(part('code')).toHaveAttribute('aria-invalid', 'true');
    expect(stepOf('offer')).toHaveAttribute('data-status', 'open');
    expect(screen.getByTestId(D)).toBeInTheDocument();
  });

  it('shows the server’s field errors on their fields', async () => {
    const user = setUser();
    await openCreate();
    await user.type(part('name'), 'Too long a note');
    await user.click(part('step-where-trigger'));
    await pickOfferings(user, [PEEL_ID]);
    world.refuseNext = apiRefusal(400, {
      type: 'validation_error',
      code: 'invalid_field',
      detail: 'Invalid values for fields in request',
      errors: [{ field: 'body.note', message: 'Too big: at most 280 characters' }],
    });
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Too big: at most 280 characters'),
    );
    expect(part('note')).toHaveAttribute('aria-invalid', 'true');
    expect(stepOf('notes')).toHaveAttribute('data-status', 'open');
  });

  it('takes a note of up to 280 characters, the API’s', async () => {
    const user = setUser();
    await openCreate();
    await user.click(part('step-notes-trigger'));
    expect(part('note')).toHaveAttribute('maxLength', '280');
  });

  it('turns a create link away without `offering:create`', async () => {
    const { router } = renderOffersRoutes(`${OFFERS_URL}/create`, { codes: [] });
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    expect(screen.queryByTestId(D)).not.toBeInTheDocument();
  });
});

describe('OfferDrawer — Edit offer (PATCH /app/offers/:offer_id)', () => {
  it('opens a row with its values — a rupee value as typed', async () => {
    const user = setUser();
    const { router } = await openAt(OFFERS_URL);
    await user.click(within(rows()[0] as HTMLElement).getByText('P0 Probe offer'));
    const panel = await drawer();
    expect(router.state.location.pathname).toBe(`${OFFERS_URL}/${PROBE_OFFER_ID}/edit`);
    expect(part('title')).toHaveTextContent('Edit offer');
    expect(part('tag')).toHaveTextContent('P0 Probe offer');
    expect(part('name')).toHaveValue('P0 Probe offer');
    expect(part('code')).toHaveValue('P0PROBE');
    expect(part('value')).toHaveValue('100.5');
    expect(part('summary')).toHaveTextContent(
      'P0 Probe offer · ₹100.50 off · 1 offering',
    );
    await waitFor(() => expect(part('save')).toHaveTextContent('Save offer'));
    expect(part('delete')).toBeVisible();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('sends only what changed — never the offerings unless their set did (OFFERINGS-M5)', async () => {
    const user = setUser();
    const { router } = await openEdit(GLOW_OFFER_ID);
    await waitFor(() => expect(part('save')).toBeInTheDocument());
    await user.clear(part('name'));
    await user.type(part('name'), 'Research Diwali glow two');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Research Diwali glow two saved'),
    );
    expect(updateOffer).toHaveBeenCalledWith({
      record: expect.objectContaining({
        id: GLOW_OFFER_ID,
        updatedAt: '2026-10-10T04:51:04.269Z',
      }),
      fields: expect.objectContaining({ offeringIds: [DEFAULT_GST_ID, PEEL_ID] }),
      idempotencyKey: expect.any(String),
    });
    expect(world.changes).toEqual([
      { offerId: GLOW_OFFER_ID, body: { name: 'Research Diwali glow two' } },
    ]);
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
  });

  it('names an offering no longer active by its name, on the picker (O12)', async () => {
    const user = setUser();
    await openEdit(GLOW_OFFER_ID);
    await waitFor(() => expect(part('save')).toBeInTheDocument());
    await user.click(part('step-where-trigger'));
    await pickOfferings(user, [PROBE_ID]);
    world.refuseNext = inactiveOfferingRefusal(DEFAULT_GST_ID);
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Research Default GST is no longer active — remove it or pick another',
      ),
    );
    expect(world.changes[0]?.body).toEqual({
      offering_ids: [DEFAULT_GST_ID, PEEL_ID, PROBE_ID],
    });
    expect(stepOf('where')).toHaveAttribute('data-status', 'open');
    expect(part('offerings')).toHaveAttribute('aria-invalid', 'true');
  });

  it('says a stale save was refused, and Reload reads the offer again (409 record_changed)', async () => {
    const user = setUser();
    await openEdit(GLOW_OFFER_ID);
    await waitFor(() => expect(part('save')).toBeInTheDocument());
    // Someone else renamed it meanwhile.
    world.offers = world.offers.map((offer) =>
      offer.id === GLOW_OFFER_ID
        ? { ...offer, name: 'Renamed elsewhere', updatedAt: '2026-10-10T06:20:00.000Z' }
        : offer,
    );
    await user.clear(part('name'));
    await user.type(part('name'), 'Mine');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'This record was changed by someone else — reload and try again',
        expect.objectContaining({ id: 'offer-save-failed' }),
      ),
    );
    vi.mocked(fetchOffer).mockClear();
    reloadAction()();
    await waitFor(() => expect(part('name')).toHaveValue('Renamed elsewhere'));
    expect(fetchOffer).toHaveBeenCalledWith(GLOW_OFFER_ID);
    // The next save carries the fresh read's `updated_at`.
    await user.clear(part('name'));
    await user.type(part('name'), 'Mine again');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Mine again saved'),
    );
    expect(vi.mocked(updateOffer).mock.lastCall?.[0].record.updatedAt).toBe(
      '2026-10-10T06:20:00.000Z',
    );
  });

  it('is view only without `offering:update`: no Save, no Delete', async () => {
    await openEdit(PROBE_OFFER_ID, { codes: [] });
    await waitFor(() =>
      expect(part('footer')).toHaveTextContent('View only · your role can’t change this'),
    );
    expect(screen.queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    expect(part('name')).toBeDisabled();
  });

  it('lets a Counsellor save but not delete', async () => {
    await openEdit(PROBE_OFFER_ID, { codes: COUNSELLOR_CODES });
    await waitFor(() => expect(part('save')).toBeInTheDocument());
    expect(screen.queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
  });

  it('deletes from the drawer through the reason confirm and closes', async () => {
    const user = setUser();
    const { router } = await openEdit(PROBE_OFFER_ID);
    await waitFor(() => expect(part('delete')).toBeInTheDocument());
    await user.click(part('delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-mistake'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(deleteOffer).toHaveBeenCalledWith({
        offerId: PROBE_OFFER_ID,
        reason: 'mistake',
        note: null,
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
  });

  it('sends a deleted offer back to the list with "Offer not found" (S:115)', async () => {
    const { router } = renderOffersRoutes(
      `${OFFERS_URL}/ofr_gonegonegonegonegone00/edit`,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Offer not found · it may have been deleted',
    );
  });

  it('offers Retry in the drawer when a deep link’s own read fails', async () => {
    const user = setUser();
    // An offer the list does not hold yet, and its read dropping.
    const [probe] = world.offers;
    world.offers = world.offers.slice(1);
    vi.mocked(fetchOffer).mockRejectedValue(
      new HttpError('HTTP 503', 503, '/api/v1/app/offers', 'GET'),
    );
    renderOffersRoutes(`${OFFERS_URL}/${PROBE_OFFER_ID}/edit`);
    await drawer();
    // The read is tried three times before it fails (`useDialogRouteRecord`).
    const retry = await screen.findByTestId('retry-button', {}, { timeout: 6000 });
    expect(within(await drawer()).getByTestId('retry-error')).toBeInTheDocument();
    vi.mocked(fetchOffer).mockResolvedValue(structuredClone(probe as OfferRecord));
    await user.click(retry);
    await waitFor(() => expect(part('name')).toHaveValue('P0 Probe offer'));
  }, 10_000);

  it('closes with Escape (§7.3)', async () => {
    const { router } = await openEdit(PROBE_OFFER_ID);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS_URL));
  });
});
