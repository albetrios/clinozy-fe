import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import type * as LeadsApiModule from '@/shared/api/clinic/leads-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import type * as PackagesApiModule from '@/shared/api/clinic/patient-packages-api.ts';
import type { PatientPurchaseRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import type * as PlanApiModule from '@/shared/api/clinic/plan-api.ts';
import type {
  PlanActivityRow,
  PlanIdeaRow,
  PlanOffering,
  PlanSuggestionRow,
} from '@/shared/api/clinic/plan-contracts.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** The member's permission codes the card asks about. */
const access = vi.hoisted(() => ({ codes: new Set<string>() }));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => ({
    previewRole: null,
    can: () => true,
    canCode: (code: string) => access.codes.has(code),
    viewableSections: [],
    isResolved: true,
  }),
}));

vi.mock('@/shared/api/clinic/plan-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PlanApiModule>()),
  fetchPlan: vi.fn(),
  fetchPlanIdeas: vi.fn(),
  fetchPlanActivity: vi.fn(),
  createPlanSuggestion: vi.fn(),
  updatePlanSuggestion: vi.fn(),
  deletePlanSuggestion: vi.fn(),
  restorePlanSuggestion: vi.fn(),
}));
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OfferingsApiModule>()),
  fetchAllOfferings: vi.fn(),
}));
vi.mock('@/shared/api/clinic/patient-packages-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PackagesApiModule>()),
  listPatientPurchases: vi.fn(),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof DirectoryApiModule>()),
  fetchTeamDirectory: vi.fn(),
}));
vi.mock('@/shared/api/clinic/leads-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof LeadsApiModule>()),
  fetchLead: vi.fn(),
}));

import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import { fetchLead } from '@/shared/api/clinic/leads-api.ts';
import { fetchAllOfferings } from '@/shared/api/clinic/offerings-api.ts';
import { listPatientPurchases } from '@/shared/api/clinic/patient-packages-api.ts';
import {
  createPlanSuggestion,
  deletePlanSuggestion,
  fetchPlan,
  fetchPlanActivity,
  fetchPlanIdeas,
  restorePlanSuggestion,
  updatePlanSuggestion,
} from '@/shared/api/clinic/plan-api.ts';

import { type PlanCardHost, usePlanCard } from './use-plan-card.ts';

const PATIENT = 'pat_dharti000000000000000';
const CONTACT = 'con_dharti000000000000000';
const LEAD = 'lead_dharti00000000000000';
const REENAL = 'mem_reenal0000000000000000';

const LHR: PlanOffering = {
  id: 'off_lhr00000000000000000000',
  name: 'LHR Full Face',
  category: 'package',
  tone: 'lav',
  sessions: 7,
  price: 4800,
  offerPrice: 4500,
  minPrice: 4000,
  isActive: true,
};
const HYDRA: PlanOffering = {
  id: 'off_hydra000000000000000000',
  name: 'Hydrafacial',
  category: 'treatment',
  tone: 'sky',
  sessions: 1,
  price: 3500,
  offerPrice: null,
  minPrice: null,
  isActive: true,
};
const PEEL: PlanOffering = { ...HYDRA, id: 'off_peel0000000000000000000', name: 'Peel' };
const RETIRED: PlanOffering = {
  ...HYDRA,
  id: 'off_retired000000000000000',
  name: 'Old facial',
  isActive: false,
};

/** A plan row as `fetchPlan` answers it. */
const suggestion = (overrides: Partial<PlanSuggestionRow> = {}): PlanSuggestionRow => ({
  id: 'osug_lhr0000000000000000000',
  offeringId: LHR.id,
  name: 'LHR Full Face',
  quantity: 1,
  price: null,
  status: 'planned',
  reason: 'Wants smoother skin',
  sourceLabel: 'Patient file',
  suggestedById: REENAL,
  invoicedQuantity: 0,
  isFullyInvoiced: false,
  isBelowLowestPrice: false,
  createdAt: '2026-10-02T05:00:00.000Z',
  updatedAt: '2026-10-02T05:00:00.000Z',
  ...overrides,
});

const IDEA: PlanIdeaRow = {
  offeringId: 'off_consult0000000000000000',
  name: 'Consultation',
  category: 'consultation',
  sessions: 1,
  price: 500,
  reason: 'First visit · start with a consultation',
};

const PURCHASE: PatientPurchaseRow = {
  id: 'poff_lhr000000000000000000',
  offeringId: LHR.id,
  name: 'LHR Full Face',
  sessionsTotal: 7,
  sessionsUsed: 2,
  sessionsLeft: 5,
  status: 'active',
  validUntil: '2027-10-01',
  invoiceId: 'invc_one0000000000000000000',
  createdAt: '2026-09-24T05:00:00.000Z',
  updatedAt: '2026-09-24T05:00:00.000Z',
  isPackage: true,
};

const MESSAGE: PlanActivityRow = {
  id: 'msg_one00000000000000000000',
  at: '2026-10-01T10:40:00.000Z',
  channel: 'whatsapp',
  direction: 'sent',
  text: 'Your package is ready',
  delivery: 'failed',
};

const REENAL_MEMBER: DirectoryMember = {
  id: REENAL,
  userId: 'usr_reenal',
  name: 'Dr. Reenal Mehta',
  initials: 'RM',
  tone: 'sky',
  roleIds: [],
  branchIds: [],
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderCard(host: Partial<PlanCardHost> = {}) {
  const onOpenChat = vi.fn();
  const view = renderHook(
    () =>
      usePlanCard({
        patientId: PATIENT,
        contactId: CONTACT,
        leadId: LEAD,
        firstName: 'Dharti',
        canEdit: true,
        onOpenChat,
        ...host,
      }),
    { wrapper },
  );
  return { ...view, onOpenChat };
}

/** The card's props once it is ready. */
async function readyProps(result: { current: ReturnType<typeof usePlanCard> }) {
  await waitFor(() => expect(result.current.status).toBe('ready'));
  const { props } = result.current;
  if (!props) throw new Error('no props');
  return props;
}

beforeEach(() => {
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  access.codes = new Set([
    'contact_activity:read',
    'lead:read',
    'offering:lower_price:read',
  ]);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchPlan).mockResolvedValue({
    suggestions: [
      suggestion(),
      suggestion({
        id: 'osug_hydra00000000000000000',
        offeringId: HYDRA.id,
        name: 'Hydrafacial',
        quantity: 2,
        price: 6500,
        status: 'accepted',
        reason: null,
        sourceLabel: 'Appt #2861 · Hydrafacial',
        suggestedById: null,
        invoicedQuantity: 2,
        isFullyInvoiced: true,
        isBelowLowestPrice: true,
      }),
      suggestion({
        id: 'osug_peel000000000000000000',
        offeringId: PEEL.id,
        name: 'Peel',
        status: 'declined',
        reason: null,
      }),
    ],
    planTotal: 11_000.5,
  });
  vi.mocked(fetchPlanIdeas).mockResolvedValue([IDEA]);
  vi.mocked(fetchAllOfferings).mockResolvedValue(
    [LHR, HYDRA, PEEL, RETIRED].map((offering) => offeringRecord(offering)),
  );
  vi.mocked(fetchPlanActivity).mockResolvedValue([MESSAGE]);
  vi.mocked(listPatientPurchases).mockResolvedValue([
    PURCHASE,
    {
      ...PURCHASE,
      id: 'poff_hydra0000000000000000',
      offeringId: 'off_gone',
      name: 'Gone',
      isPackage: false,
    },
  ]);
  vi.mocked(fetchTeamDirectory).mockResolvedValue([REENAL_MEMBER]);
  vi.mocked(fetchLead).mockResolvedValue({
    id: LEAD,
    leadNumber: 2363,
    status: 'contacted',
  } as LeadRecord);
  vi.mocked(createPlanSuggestion).mockImplementation(async ({ input }) =>
    suggestion({ id: 'osug_new0000000000000000000', offeringId: input.offeringId }),
  );
  vi.mocked(updatePlanSuggestion).mockImplementation(async ({ suggestionId }) =>
    suggestion({ id: suggestionId, updatedAt: '2026-10-03T05:00:00.000Z' }),
  );
  vi.mocked(deletePlanSuggestion).mockResolvedValue(undefined);
  vi.mocked(restorePlanSuggestion).mockImplementation(async ({ suggestionId }) =>
    suggestion({ id: suggestionId }),
  );
});
afterEach(() => {
  client.clear();
  vi.resetAllMocks();
});

describe('usePlanCard — the plan rows (api-integration §5.4)', () => {
  it('waits for the rows and the catalogue, then shows the server’s total in paise', async () => {
    const { result } = renderCard();
    expect(result.current).toMatchObject({ status: 'pending', props: null });
    const props = await readyProps(result);
    expect(props.total).toBe(1_100_050);
    expect(fetchPlan).toHaveBeenCalledWith(PATIENT);
  });

  it('names and prices each row from the catalogue, signed by its member', async () => {
    const { result } = renderCard();
    const [lhr, hydra] = (await readyProps(result)).lines;
    expect(lhr).toMatchObject({
      name: 'LHR Full Face',
      tone: 'lav',
      qty: 1,
      price: null,
      // A row without its own price bills at the offer price (PK9).
      listPrice: 450_000,
      status: 'planned',
      fullyInvoiced: false,
      belowLowest: false,
    });
    expect(lhr?.info).toBe(
      'Package · 7 sessions · List ₹4,800 · lowest ₹4,000 · Wants smoother skin',
    );
    expect(lhr?.by.initials).toBe('RM');
    expect(lhr?.by.label).toMatch(/^Dr\. Reenal Mehta · .+ · Patient file$/);
    expect(hydra).toMatchObject({
      price: 650_000,
      invoicedQty: 2,
      fullyInvoiced: true,
      belowLowest: true,
      by: { initials: '?', tone: 'stone' },
    });
    expect(hydra?.info).toBe('Treatment · 2 visits · List ₹3,500');
  });

  it('reports a failed read of the rows', async () => {
    vi.mocked(fetchPlan).mockRejectedValue(new Error('down'));
    const { result } = renderCard();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.props).toBeNull();
  });

  it('reads nothing without a patient', () => {
    const { result } = renderCard({ patientId: '' });
    expect(result.current.status).toBe('pending');
    expect(fetchPlan).not.toHaveBeenCalled();
    expect(fetchAllOfferings).not.toHaveBeenCalled();
  });

  it('passes the lowest-price code through, and the host’s edit', async () => {
    access.codes.delete('offering:lower_price:read');
    const { result } = renderCard({ canEdit: false });
    const props = await readyProps(result);
    expect(props.canSeeLowestPrice).toBe(false);
    expect(props.canEdit).toBe(false);
  });
});

describe('usePlanCard — the writes', () => {
  it('saves an edit in rupees with the `updated_at` it was read at', async () => {
    const { result } = renderCard();
    const props = await readyProps(result);
    const lhr = props.lines[0];
    if (!lhr) throw new Error('no line');
    act(() => props.onChange?.(lhr, { qty: 2, price: 840_000 }));
    await waitFor(() => expect(updatePlanSuggestion).toHaveBeenCalledOnce());
    expect(updatePlanSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: PATIENT,
        suggestionId: 'osug_lhr0000000000000000000',
        change: { quantity: 2, price: 8400 },
        expectedUpdatedAt: '2026-10-02T05:00:00.000Z',
      }),
    );
  });

  it('sends a status alone, and a price back to the billed one as null', async () => {
    const { result } = renderCard();
    const props = await readyProps(result);
    const lhr = props.lines[0];
    if (!lhr) throw new Error('no line');
    act(() => props.onChange?.(lhr, { status: 'next_time' }));
    await waitFor(() =>
      expect(updatePlanSuggestion).toHaveBeenLastCalledWith(
        expect.objectContaining({ change: { status: 'next_time' } }),
      ),
    );
    act(() => props.onChange?.(lhr, { price: null }));
    await waitFor(() =>
      expect(updatePlanSuggestion).toHaveBeenLastCalledWith(
        expect.objectContaining({ change: { price: null } }),
      ),
    );
  });

  it('removes with the confirm’s reason and offers Undo, which restores it', async () => {
    const { result } = renderCard();
    const props = await readyProps(result);
    const lhr = props.lines[0];
    if (!lhr) throw new Error('no line');
    await act(() =>
      props.onRemove?.(lhr, {
        reason: 'other',
        note: 'Plan changed',
        picked: { value: 'plan_changed', label: 'Plan changed' },
        comment: '',
      }),
    );
    expect(deletePlanSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: PATIENT,
        suggestionId: lhr.id,
        reason: 'other',
        note: 'Plan changed',
      }),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'LHR Full Face removed from suggestions',
      expect.any(Object),
    );
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    act(() => options.onUndo());
    await waitFor(() =>
      expect(restorePlanSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: PATIENT, suggestionId: lhr.id }),
      ),
    );
  });

  it('adds an idea with the server’s reason, and toasts it', async () => {
    const { result } = renderCard();
    const props = await readyProps(result);
    await waitFor(() => expect(result.current.props?.ideas).toHaveLength(1));
    const [idea] = result.current.props?.ideas ?? [];
    if (!idea) throw new Error('no idea');
    expect(idea).toMatchObject({
      id: IDEA.offeringId,
      tone: 'sky',
      listPrice: 50_000,
      info: 'Idea from history · First visit · start with a consultation · Consultation',
    });
    act(() => props.onAddIdea?.(idea));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Consultation added to Dharti’s suggestions',
      ),
    );
    expect(createPlanSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: PATIENT,
        input: { offeringId: IDEA.offeringId, reason: IDEA.reason },
      }),
    );
  });

  it('offers the active offerings, the ones the plan holds disabled, and adds a pick', async () => {
    const { result } = renderCard();
    const props = await readyProps(result);
    const options = props.addOffering?.options ?? [];
    expect(options.map((option) => [option.label, option.disabled])).toEqual([
      // A to Z, as the catalogue reads. Planned: held. Accepted and invoiced in full, or
      // declined: free again (PK9).
      ['Hydrafacial', false],
      ['LHR Full Face', true],
      ['Peel', false],
    ]);
    expect(options[1]).toMatchObject({
      sub: '7 sessions · min ₹4,000',
      meta: '₹4,800',
      group: 'Package',
    });
    expect(options[0]?.sub).toBe('Single');
    act(() => props.addOffering?.onPick(HYDRA.id));
    await waitFor(() =>
      expect(createPlanSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({ input: { offeringId: HYDRA.id, reason: null } }),
      ),
    );
  });
});

describe('usePlanCard — purchases and contact activity', () => {
  it('lists the last purchases with the catalogue’s category and a package’s sessions', async () => {
    const { result } = renderCard();
    await readyProps(result);
    await waitFor(() => expect(result.current.props?.purchases).toHaveLength(2));
    const [lhr, gone] = result.current.props?.purchases ?? [];
    expect(lhr).toMatchObject({
      name: 'LHR Full Face',
      category: { label: 'Package', tone: 'lav' },
      sessions: { used: 2, total: 7 },
    });
    expect(gone).toMatchObject({ category: null, sessions: null });
    expect(listPatientPurchases).toHaveBeenCalledWith(PATIENT);
  });

  it('lists the contact’s last messages under their lead, with "Open chat"', async () => {
    const { result, onOpenChat } = renderCard();
    await readyProps(result);
    await waitFor(() =>
      expect(result.current.props?.activity?.summary).toBe('Lead #2363 · Contacted'),
    );
    const activity = result.current.props?.activity;
    expect(activity?.lines).toEqual([
      expect.objectContaining({
        channel: { label: 'WhatsApp', tone: 'sage' },
        direction: 'sent',
        text: 'Your package is ready',
        status: 'Not delivered',
        statusTone: 'danger',
      }),
    ]);
    activity?.onOpenChat?.();
    expect(onOpenChat).toHaveBeenCalledWith(LEAD);
    expect(fetchPlanActivity).toHaveBeenCalledWith(CONTACT);
  });

  it('reads neither the stream nor the lead without their codes', async () => {
    access.codes = new Set();
    const { result } = renderCard();
    const props = await readyProps(result);
    expect(props.activity).toBeUndefined();
    expect(fetchPlanActivity).not.toHaveBeenCalled();
    expect(fetchLead).not.toHaveBeenCalled();
  });

  it('shows the messages without a summary or "Open chat" when there is no lead', async () => {
    const { result } = renderCard({ leadId: null });
    await readyProps(result);
    await waitFor(() => expect(result.current.props?.activity?.lines).toHaveLength(1));
    expect(result.current.props?.activity?.summary).toBeUndefined();
    expect(result.current.props?.activity?.onOpenChat).toBeUndefined();
  });
});
