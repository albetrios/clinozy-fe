import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { resolveAccessFromCodes } from '@/shared/api/clinic/access-api.ts';
import type { BranchOption } from '@/shared/api/clinic/branches-api.ts';
import {
  createOffering,
  deleteOffering,
  fetchOffering,
  updateOffering,
} from '@/shared/api/clinic/offerings-api.ts';
import {
  offeringChangeOf,
  type OfferingFields,
  type OfferingRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  offeringRecord,
  offerRecord,
  TEST_OFFERING_BRANCH_ID,
  TEST_OFFERING_ID,
} from '@/tests/utils/offering-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

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

vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createOffering: vi.fn(),
  updateOffering: vi.fn(),
  fetchOffering: vi.fn(),
  deleteOffering: vi.fn(),
  restoreOffering: vi.fn(),
}));

/** The member's clinozy-be codes — the room answers from them once it is on the API. */
const member = vi.hoisted(() => ({ codes: [] as string[] }));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useClinicAccess: (): ClinicAccess => ({
    roles: [],
    previewRole: null,
    isResolved: true,
    ...resolveAccessFromCodes(member.codes),
    canCode: (code) => member.codes.includes(code),
  }),
}));

import { OfferingDrawer, type OfferingDrawerCatalogue } from './OfferingDrawer.tsx';

/** An Owner or Admin: every offering code, the lowest price included. */
const OWNER_CODES: OrganizationPermission[] = [
  'organization:read',
  'offering:create',
  'offering:update',
  'offering:delete',
  'offering:lower_price:read',
];
/** A Counsellor: creates and edits offerings, prices included, but never sees the floor. */
const COUNSELLOR_CODES: OrganizationPermission[] = [
  'organization:read',
  'offering:create',
  'offering:update',
];
/** An Accountant: reads offerings and their floor, changes nothing. */
const ACCOUNTANT_CODES: OrganizationPermission[] = [
  'organization:read',
  'offering:lower_price:read',
];

const D = 'offering-drawer';
const NEW_OFFERING_ID = 'off_hydrafacial000000000';

const branch = (id: string, name: string, isMain: boolean): BranchOption => ({
  id,
  name,
  tone: 'sage',
  isMain,
  opensAt: '09:00',
  closesAt: '21:00',
  workingDays: [],
});

/** Two open branches and a live 15% offer on Research Peel (#5). */
const CATALOGUE: OfferingDrawerCatalogue = {
  offers: [offerRecord()],
  branches: [
    branch(TEST_OFFERING_BRANCH_ID, 'Vesu', true),
    branch('brn_53jadajan00000000000', 'Adajan', false),
  ],
  pricingBranchId: null,
};

/** The offerings clinozy-be holds, by id — a write lands here, a read answers from it. */
let saved = new Map<string, OfferingRecord>();

/** A record with the drawer's fields written over it, as the server answers the save. */
function recordWith(base: OfferingRecord, fields: OfferingFields): OfferingRecord {
  return {
    ...base,
    name: fields.name,
    category: fields.category,
    tone: fields.tone,
    branchIds: fields.branchIds,
    price: fields.price,
    offerPrice: fields.offerPrice,
    minPrice: fields.minPrice ?? base.minPrice,
    sessions: fields.sessions,
    gstPercent: fields.gstPercent ?? base.gstPercent,
    isGstInclusive: fields.isGstInclusive,
    durationMin: fields.durationMin,
    validityDays: fields.validityDays,
    searchTerms: fields.searchTerms,
    description: fields.description,
    isActive: fields.isActive,
    updatedAt: new Date().toISOString(),
  };
}

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

function signIn(codes: OrganizationPermission[]) {
  member.codes = codes;
  useOrganizationStore.getState().setPermissions(codes);
}

function renderCreate(prefill?: { name?: string }) {
  const onClose = vi.fn();
  renderWithProviders(
    <OfferingDrawer
      mode="create"
      open
      prefill={prefill}
      onClose={onClose}
      catalogue={CATALOGUE}
    />,
  );
  return { onClose };
}

function renderEdit(offering: OfferingRecord | undefined) {
  const onClose = vi.fn();
  renderWithProviders(
    <OfferingDrawer
      mode="edit"
      open
      offering={offering}
      onClose={onClose}
      catalogue={CATALOGUE}
    />,
  );
  return { onClose };
}

const drawer = () => screen.findByTestId(D);
const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const stepOf = (id: string) => screen.getByTestId(`${D}-step-${id}`);

/** Fill Name and Price, the two required fields. */
async function fillRequired(
  user: ReturnType<typeof setUser>,
  { name = 'Hydra facial', price = '1500' } = {},
) {
  await user.type(part('name'), name);
  await user.type(part('price'), price);
}

/** The vars of the last create / update. */
function lastCreate() {
  const call = vi.mocked(createOffering).mock.lastCall?.[0];
  if (!call) throw new Error('nothing was created');
  return call;
}
function lastUpdate() {
  const call = vi.mocked(updateOffering).mock.lastCall?.[0];
  if (!call) throw new Error('nothing was saved');
  return call;
}

/** clinozy-be's refusal of an offering save, as the live stack answers it. */
function refusal(status: number, error: Record<string, unknown>) {
  return new HttpError('Refused', status, '/api/v1/app/offerings', 'PATCH', { error });
}

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  saved = new Map([[TEST_OFFERING_ID, offeringRecord()]]);
  vi.mocked(createOffering).mockReset();
  vi.mocked(createOffering).mockImplementation(async ({ fields }) => {
    const created = recordWith(
      offeringRecord({
        id: NEW_OFFERING_ID,
        offeringNumber: 8,
        minPrice: 0,
        gstPercent: 18,
      }),
      fields,
    );
    saved.set(created.id, created);
    return structuredClone(created);
  });
  vi.mocked(updateOffering).mockReset();
  vi.mocked(updateOffering).mockImplementation(async ({ record, fields }) => {
    const next = recordWith(record, fields);
    saved.set(next.id, next);
    return structuredClone(next);
  });
  vi.mocked(fetchOffering).mockReset();
  vi.mocked(fetchOffering).mockImplementation(async (offeringId) => {
    const record = saved.get(offeringId);
    if (!record)
      throw new HttpError('Not found', 404, `/app/offerings/${offeringId}`, 'GET');
    return structuredClone(record);
  });
  vi.mocked(deleteOffering).mockReset();
  vi.mocked(deleteOffering).mockResolvedValue(undefined);
  signInTestMember();
  signIn(OWNER_CODES);
});
afterEach(() => {
  member.codes = [];
  useOrganizationStore.getState().clearOrganization();
});

describe('OfferingDrawer — New offering (KICKOFF §6.11)', () => {
  it('opens with the design’s header, Quick fill, steps, GST chips and footer', async () => {
    renderCreate();
    const panel = await drawer();
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
    // No GST rate is picked: the server applies the category's until one is.
    expect(withoutBidiMarks(stepOf('offering').textContent)).toContain(
      'Treatment · All branches · 1 · Exclusive',
    );
    for (const rate of [0, 5, 12, 18, 28]) {
      expect(part(`gst-rate-${rate}`)).toHaveAttribute('aria-pressed', 'false');
    }
    expect(
      within(panel).getByText(
        '0% for a consultation, 18% otherwise — until you pick one',
      ),
    ).toBeInTheDocument();
    expect(within(stepOf('time')).getByText('Time, validity & details')).toBeVisible();
    expect(part('summary')).toHaveTextContent('Untitled · Treatment');
    expect(part('save')).toHaveTextContent('Create offering');
    expect(part('save-and-add')).toHaveTextContent('Create & add another');
    expect(screen.queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('prefills the name and starts every field at its default', async () => {
    renderCreate({ name: 'Hydra facial' });
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
    renderCreate();
    await drawer();
    await user.click(part('step-time-trigger'));
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add a name');
    expect(stepOf('offering')).toHaveAttribute('data-status', 'open');
    await user.type(part('name'), 'Hydra facial');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Add a price');
    expect(createOffering).not.toHaveBeenCalled();
  });

  it('prices the draft live in rupees: the Offer price hint, Billed today, the badges and the footer', async () => {
    const user = setUser();
    renderCreate();
    await drawer();
    await fillRequired(user);
    expect(screen.getByText('what you bill · leave empty = list price')).toBeVisible();
    await user.type(part('offer-price'), '1200.5');
    expect(screen.getByText('what you bill · 20% below list')).toBeVisible();
    expect(part('billed-today')).toHaveTextContent('₹1,200.50 · 20% below list');
    expect(part('badges')).toHaveTextContent('Treatment₹1,200.50');
    expect(part('summary')).toHaveTextContent('Hydra facial · Treatment · ₹1,200.50');
  });

  it('fills a Quick fill preset without saving it', async () => {
    const user = setUser();
    renderCreate();
    await drawer();
    await user.click(part('quick-fill-pack'));
    expect(part('category-package')).toHaveAttribute('aria-pressed', 'true');
    expect(part('sessions')).toHaveValue('6');
    expect(part('badges')).toHaveTextContent('6 sessions');
    expect(part('summary')).toHaveTextContent('Untitled · Package · 6 sessions');
    await user.click(part('quick-fill-lhr'));
    expect(part('colour-blush')).toHaveAttribute('aria-checked', 'true');
    expect(createOffering).not.toHaveBeenCalled();
  });

  it('checks the price rules before the write (H:5507)', async () => {
    const user = setUser();
    renderCreate();
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

    await user.clear(part('offer-price'));
    await user.clear(part('floor'));
    await user.type(part('floor'), '1100');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith(
      'Lowest price can’t be above the price',
    );
    expect(createOffering).not.toHaveBeenCalled();
  });

  it('keeps the duration within the API’s 5–480 minutes', async () => {
    const user = setUser();
    renderCreate();
    await drawer();
    await user.click(part('step-time-trigger'));
    await user.click(part('duration-quick-15'));
    for (let step = 0; step < 12; step += 1) {
      if (!(part('duration-decrease') as HTMLButtonElement).disabled) {
        await user.click(part('duration-decrease'));
      }
    }
    expect(part('duration')).toHaveValue('5');
    expect(part('duration-decrease')).toBeDisabled();
  });

  it('creates the offering in rupees with the picked GST rate and the floor, then closes (D28)', async () => {
    const user = setUser();
    const { onClose } = renderCreate();
    await drawer();
    await fillRequired(user, { price: '1500.5' });
    await user.click(part('gst-rate-5'));
    expect(part('gst-rate-5')).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByText('0% for a consultation, 18% otherwise — until you pick one'),
    ).not.toBeInTheDocument();
    await user.click(part('gst'));
    await user.click(part('floor-toggle'));
    await user.type(part('floor'), '1200');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Offering #8 created'),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(lastCreate()).toMatchObject({
      canSetLowestPrice: true,
      fields: {
        name: 'Hydra facial',
        price: 1500.5,
        offerPrice: null,
        minPrice: 1200,
        gstPercent: 5,
        isGstInclusive: true,
        durationMin: 30,
      },
    });
    expect(lastCreate().idempotencyKey).toEqual(expect.any(String));
  });

  it('leaves the GST rate to the server while none is picked', async () => {
    const user = setUser();
    renderCreate();
    await drawer();
    await fillRequired(user);
    await user.click(part('save'));
    await waitFor(() => expect(createOffering).toHaveBeenCalledTimes(1));
    expect(lastCreate().fields.gstPercent).toBeNull();
  });

  it('"Create & add another" saves, then starts again blank', async () => {
    const user = setUser();
    const { onClose } = renderCreate({ name: 'Hydra' });
    await drawer();
    await user.type(part('price'), '900');
    await user.click(part('save-and-add'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Offering #8 created'),
    );
    await waitFor(() => expect(part('name')).toHaveValue(''));
    expect(part('price')).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('outlines the name another offering has (409 offering_name_taken) and keeps the draft', async () => {
    const user = setUser();
    vi.mocked(createOffering).mockRejectedValueOnce(
      refusal(409, {
        code: 'conflict',
        reason: 'offering_name_taken',
        detail: 'Another offering already has this name',
      }),
    );
    const { onClose } = renderCreate();
    await drawer();
    await fillRequired(user, { name: 'Research Peel' });
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Another offering already has this name',
        expect.objectContaining({ id: 'offering-save-failed' }),
      ),
    );
    expect(part('name')).toHaveAttribute('aria-invalid', 'true');
    expect(part('name')).toHaveValue('Research Peel');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Another offering already has this name',
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('puts the server’s field refusals on their fields', async () => {
    const user = setUser();
    vi.mocked(createOffering).mockRejectedValueOnce(
      refusal(400, {
        type: 'validation_error',
        code: 'invalid_field',
        detail: 'Invalid values for fields in request',
        errors: [
          {
            field: 'body.search_terms/0',
            message: 'Too big: expected string to have <=60 characters',
          },
        ],
      }),
    );
    renderCreate();
    await drawer();
    await fillRequired(user);
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Too big: expected string to have <=60 characters',
      ),
    );
    expect(stepOf('time')).toHaveAttribute('data-status', 'open');
    expect(part('search-terms')).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the draft when the connection drops: "Not saved", "Retry save"', async () => {
    const user = setUser();
    vi.mocked(createOffering).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderCreate();
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
      expect(notifyMock.success).toHaveBeenCalledWith('Offering #8 created'),
    );
  });

  it('hides the lowest price from a member without offering:lower_price:read, and never sends it (gap 6)', async () => {
    signIn(COUNSELLOR_CODES);
    const user = setUser();
    renderCreate();
    await drawer();
    expect(screen.queryByTestId(`${D}-floor-toggle`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-floor`)).not.toBeInTheDocument();
    await fillRequired(user);
    await user.click(part('save'));
    await waitFor(() => expect(createOffering).toHaveBeenCalledTimes(1));
    expect(lastCreate()).toMatchObject({
      canSetLowestPrice: false,
      fields: { minPrice: null },
    });
  });
});

describe('OfferingDrawer — Edit offering', () => {
  it('opens with its number, its values in rupees and three steps while an offer runs on it', async () => {
    const user = setUser();
    renderEdit(offeringRecord());
    const panel = await drawer();
    expect(part('title')).toHaveTextContent('Edit offering');
    expect(part('tag')).toHaveTextContent('#5');
    expect(part('name')).toHaveValue('Research Peel');
    expect(part('price')).toHaveValue('2000');
    expect(part('offer-price')).toHaveValue('1800');
    expect(part('gst-rate-18')).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByText('0% for a consultation, 18% otherwise — until you pick one'),
    ).not.toBeInTheDocument();
    // 1,800 less the live 15% offer: 1,530 — above the ₹1,500 floor.
    expect(part('billed-today')).toHaveTextContent(
      '₹1,530 · Research Diwali glow · 24% below list',
    );
    expect(part('summary')).toHaveTextContent('Research Peel · Treatment · ₹1,530');
    expect(
      within(stepOf('time')).getByText('Offers on this, time & validity'),
    ).toBeVisible();
    expect(within(stepOf('details')).getByText('Details')).toBeVisible();
    await user.click(part('step-offering-next'));
    expect(within(panel).getByTestId(`${D}-offer-${offerRecord().id}`)).toHaveTextContent(
      '15% off · Running',
    );
    expect(part('save')).toHaveTextContent('Save changes');
    expect(part('delete')).toBeVisible();
    expect(screen.queryByTestId(`${D}-quick-fill`)).not.toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('keeps two steps when every offer on it has ended', async () => {
    renderWithProviders(
      <OfferingDrawer
        mode="edit"
        open
        offering={offeringRecord()}
        onClose={vi.fn()}
        catalogue={{ ...CATALOGUE, offers: [offerRecord({ status: 'ended' })] }}
      />,
    );
    await drawer();
    expect(within(stepOf('time')).getByText('Time, validity & details')).toBeVisible();
    expect(screen.queryByTestId(`${D}-step-details`)).not.toBeInTheDocument();
    expect(part('billed-today')).toHaveTextContent('₹1,800 · 10% below list');
  });

  it('shows a skeleton until a deep-linked offering is read', async () => {
    renderEdit(undefined);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });

  it('saves only what changed with the read’s updated_at, and closes', async () => {
    const user = setUser();
    const { onClose } = renderEdit(offeringRecord());
    await drawer();
    await user.clear(part('price'));
    await user.type(part('price'), '2100.75');
    await user.click(part('gst-rate-12'));
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Offering #5 saved'),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    const { record, fields, canSetLowestPrice } = lastUpdate();
    expect(record).toEqual(offeringRecord());
    expect(offeringChangeOf(record, fields, { canSetLowestPrice })).toEqual({
      price: 2100.75,
      gst_percent: 12,
    });
  });

  it('turns an offering inactive', async () => {
    const user = setUser();
    renderEdit(offeringRecord());
    await drawer();
    await user.click(part('step-details-trigger'));
    expect(part('status')).toHaveTextContent('Active · bookable');
    await user.click(part('status'));
    expect(part('status')).toHaveTextContent('Inactive · hidden');
    await user.click(part('save'));
    await waitFor(() => expect(updateOffering).toHaveBeenCalledTimes(1));
    const { record, fields, canSetLowestPrice } = lastUpdate();
    expect(offeringChangeOf(record, fields, { canSetLowestPrice })).toEqual({
      is_active: false,
    });
  });

  it('shows the floor on demand and edits it for a member with offering:lower_price:read', async () => {
    const user = setUser();
    renderEdit(offeringRecord());
    await drawer();
    expect(part('floor-toggle')).toHaveTextContent('Hidden · tap to set');
    expect(screen.queryByTestId(`${D}-floor`)).not.toBeInTheDocument();
    await user.click(part('floor-toggle'));
    expect(part('floor')).toHaveValue('1500');
    await user.clear(part('floor'));
    await user.type(part('floor'), '1600');
    await user.click(part('save'));
    await waitFor(() => expect(updateOffering).toHaveBeenCalledTimes(1));
    const { record, fields, canSetLowestPrice } = lastUpdate();
    expect(offeringChangeOf(record, fields, { canSetLowestPrice })).toEqual({
      min_price: 1600,
    });
  });

  it('opens the hidden floor on the price rule it breaks', async () => {
    const user = setUser();
    renderEdit(offeringRecord());
    await drawer();
    await user.clear(part('offer-price'));
    await user.type(part('offer-price'), '1400');
    await user.click(part('save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith(
      'Lowest price can’t be above the offer price',
    );
    expect(part('floor')).toHaveAttribute('aria-invalid', 'true');
    expect(updateOffering).not.toHaveBeenCalled();
  });

  it('shows a floor refusal from the server on the floor', async () => {
    const user = setUser();
    vi.mocked(updateOffering).mockRejectedValueOnce(
      refusal(400, {
        type: 'validation_error',
        code: 'invalid_field',
        detail: "The lowest price can't be above the price",
        errors: [
          { field: 'min_price', message: "The lowest price can't be above the price" },
        ],
      }),
    );
    renderEdit(offeringRecord());
    await drawer();
    await user.click(part('name'));
    await user.type(part('name'), ' x');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        "The lowest price can't be above the price",
      ),
    );
    expect(part('floor')).toHaveAttribute('aria-invalid', 'true');
  });

  it('puts a hidden floor’s refusal on the Offer price for a Counsellor (gap 7)', async () => {
    signIn(COUNSELLOR_CODES);
    const user = setUser();
    vi.mocked(updateOffering).mockRejectedValueOnce(
      refusal(400, {
        type: 'validation_error',
        code: 'invalid_field',
        detail: "The lowest price can't be above the offer price",
        errors: [
          {
            field: 'min_price',
            message: "The lowest price can't be above the offer price",
          },
        ],
      }),
    );
    renderEdit(offeringRecord({ minPrice: null }));
    await drawer();
    expect(screen.queryByTestId(`${D}-floor-toggle`)).not.toBeInTheDocument();
    await user.clear(part('offer-price'));
    await user.type(part('offer-price'), '1400');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Below this offering’s lowest price — ask an Owner or Admin',
      ),
    );
    expect(part('offer-price')).toHaveAttribute('aria-invalid', 'true');
    expect(lastUpdate()).toMatchObject({
      canSetLowestPrice: false,
      fields: { minPrice: null, offerPrice: 1400 },
    });
  });

  it('says so when the role no longer sets the lowest price (403 field_permission_required)', async () => {
    const user = setUser();
    vi.mocked(updateOffering).mockRejectedValueOnce(
      refusal(403, {
        code: 'forbidden',
        reason: 'field_permission_required',
        detail: 'You need the offering:lower_price:read permission to change min_price',
      }),
    );
    renderEdit(offeringRecord());
    await drawer();
    await user.click(part('floor-toggle'));
    await user.clear(part('floor'));
    await user.type(part('floor'), '1000');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Your role can’t change the lowest price — ask an Owner or Admin',
      ),
    );
    expect(part('floor')).toHaveAttribute('aria-invalid', 'true');
  });

  it('reloads a stale save (409 record_changed) and saves over what was read', async () => {
    const user = setUser();
    vi.mocked(updateOffering).mockRejectedValueOnce(
      refusal(409, {
        code: 'conflict',
        reason: 'record_changed',
        detail:
          'This record was changed by usr_kb5tlncpzg38oat3s7nv7 at 2026-10-10T05:47:24.068Z — reload and try again',
      }),
    );
    // Someone else renamed it meanwhile.
    saved.set(
      TEST_OFFERING_ID,
      offeringRecord({
        name: 'Research Peel · glow',
        updatedAt: '2026-10-10T06:00:00.000Z',
      }),
    );
    const { onClose } = renderEdit(offeringRecord());
    await drawer();
    await user.clear(part('price'));
    await user.type(part('price'), '2200');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Someone else saved this meanwhile. Reload to see their changes, then make yours again.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Reload' }) }),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();

    const reload = notifyMock.error.mock.lastCall?.[1]?.action?.onClick as () => void;
    reload();
    await waitFor(() => expect(part('name')).toHaveValue('Research Peel · glow'));
    expect(fetchOffering).toHaveBeenCalledWith(TEST_OFFERING_ID);
    expect(part('price')).toHaveValue('2000');

    await user.clear(part('price'));
    await user.type(part('price'), '2200');
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(lastUpdate().record.updatedAt).toBe('2026-10-10T06:00:00.000Z');
  });

  it('deletes through the reason confirm, and closes', async () => {
    const user = setUser();
    const { onClose } = renderEdit(offeringRecord());
    await drawer();
    await user.click(part('delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this offering?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Research Peel',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(deleteOffering).toHaveBeenCalledWith({
      offeringId: TEST_OFFERING_ID,
      reason: 'duplicate',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Offering #5 removed',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
  });

  it('offers no Delete without offering:delete', async () => {
    signIn(COUNSELLOR_CODES);
    renderEdit(offeringRecord({ minPrice: null }));
    await drawer();
    expect(part('save')).toBeVisible();
    expect(screen.queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
  });

  it('is view only without offering:update — the floor shown to a member who may see it', async () => {
    signIn(ACCOUNTANT_CODES);
    renderEdit(offeringRecord());
    await drawer();
    expect(screen.queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    expect(part('footer')).toHaveTextContent('View only · your role can’t change this');
    expect(part('name')).toBeDisabled();
    expect(part('price')).toBeDisabled();
    expect(part('floor')).toHaveValue('1500');
    expect(part('floor')).toBeDisabled();
  });

  it('closes with Escape', async () => {
    const { onClose } = renderEdit(offeringRecord());
    await drawer();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
