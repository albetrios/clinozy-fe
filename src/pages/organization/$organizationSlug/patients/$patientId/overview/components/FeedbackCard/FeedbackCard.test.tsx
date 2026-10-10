import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import type * as FeedbackApiModule from '@/shared/api/clinic/feedback-api.ts';
import {
  deleteFeedback,
  listPatientFeedback,
  logFeedbackAction,
  restoreFeedback,
} from '@/shared/api/clinic/feedback-api.ts';
import type {
  FeedbackItem,
  PatientCheckIn,
  PatientReview,
} from '@/shared/api/clinic/feedback-contracts.ts';
import {
  CONFIRM_TEST_IDS,
  confirmReasonTestId,
} from '@/shared/components/ConfirmDialog/confirm-dialog.constants.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';
import { appointmentRow, DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { FeedbackCard, type FeedbackCardProps } from './FeedbackCard.tsx';

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
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const ID = 'feedback-card';
const VISIT = 'appt_visit00000000000000';

/** A check-in as the file reads it — a visit check-in, Better at 7, followed mostly. */
function checkIn(overrides: Partial<PatientCheckIn> = {}): PatientCheckIn {
  return {
    id: 'chk_visit0000000000000000',
    patientId: TEST_PATIENT_ID,
    appointmentId: null,
    treatmentId: null,
    context: 'Visit · 24 Sep',
    feel: 'better',
    score: 7,
    scoreChange: 2,
    followed: 'mostly',
    followedNote: null,
    currentState: 'Less redness',
    nextPlan: 'Second session in 3 weeks',
    nextOfferingIds: [],
    date: '2026-09-24',
    needsAction: false,
    actions: [],
    createdAt: '2026-09-24T05:00:00.000Z',
    updatedAt: '2026-09-24T05:00:00.000Z',
    ...overrides,
  };
}

/** A review as the file reads it — five stars on Google after a visit. */
function review(overrides: Partial<PatientReview> = {}): PatientReview {
  return {
    id: 'rev_google000000000000000',
    patientId: TEST_PATIENT_ID,
    appointmentId: VISIT,
    source: 'google',
    rating: 5,
    text: 'Lovely staff',
    link: 'https://g.page/r/abc',
    fileKeys: [],
    date: '2026-10-01',
    needsAction: false,
    actions: [],
    createdAt: '2026-10-01T05:00:00.000Z',
    updatedAt: '2026-10-01T05:00:00.000Z',
    ...overrides,
  };
}

const asCheckIn = (record: PatientCheckIn): FeedbackItem => ({
  kind: 'checkIn',
  id: record.id,
  checkIn: record,
});
const asReview = (record: PatientReview): FeedbackItem => ({
  kind: 'review',
  id: record.id,
  review: record,
});

/** The server's cards — a removal leaves them, Undo brings it back. */
const store = vi.hoisted(() => ({
  items: [] as FeedbackItem[],
  removed: [] as FeedbackItem[],
}));

vi.mock('@/shared/api/clinic/feedback-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof FeedbackApiModule>()),
  listPatientFeedback: vi.fn(async () => [...store.items]),
  deleteFeedback: vi.fn(async ({ id }: { id: string }) => {
    store.removed = store.items.filter((item) => item.id === id);
    store.items = store.items.filter((item) => item.id !== id);
  }),
  restoreFeedback: vi.fn(async () => {
    store.items = [...store.items, ...store.removed];
  }),
  logFeedbackAction: vi.fn(async ({ id }: { id: string }) => {
    store.items = store.items.map((item) =>
      item.id === id && item.kind === 'checkIn'
        ? asCheckIn({
            ...item.checkIn,
            needsAction: false,
            actions: [
              {
                id: 'fba_called',
                action: 'doctor_called',
                note: null,
                authorId: DOCTOR_NISHA.id,
                at: '2026-10-10T05:00:00.000Z',
              },
            ],
          })
        : item,
    );
  }),
}));
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppointmentsApiModule>()),
  fetchPersonAppointments: vi.fn(async () => [
    appointmentRow({ id: VISIT, seq: 2790, serviceLabel: 'Hydrafacial' }),
  ]),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof DirectoryApiModule>()),
  fetchTeamDirectory: vi.fn(async () => [DOCTOR_NISHA]),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MyMembershipModule>()),
  findMyMembershipId: vi.fn(async () => DOCTOR_NISHA.id),
}));

function renderCard(
  props: Partial<FeedbackCardProps> = {},
  counts = { checkIns: 2, reviews: 1 },
) {
  const onLog = vi.fn();
  const onEdit = vi.fn();
  const file = patientFile({
    feedback: { feel: 'better', score: 7, review: null, ...counts },
  });
  const view = renderInPatientFile(
    <FeedbackCard
      patientId={TEST_PATIENT_ID}
      canEdit
      onLog={onLog}
      onEdit={onEdit}
      {...props}
    />,
    { file, section: 'overview' },
  );
  return { ...view, user: userEvent.setup(), onLog, onEdit };
}

const items = () => screen.queryAllByTestId(`${ID}-item`);

async function openCard(
  props: Partial<FeedbackCardProps> = {},
  counts?: { checkIns: number; reviews: number },
) {
  const view = renderCard(props, counts);
  const card = await screen.findByTestId(ID);
  await view.user.click(within(card).getByTestId(`${ID}-toggle`));
  return { ...view, card };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  store.removed = [];
  store.items = [
    asReview(review()),
    asCheckIn(checkIn()),
    asCheckIn(
      checkIn({
        id: 'chk_aftercare000000000000',
        treatmentId: 'trt_lhr',
        context: 'After LHR Full Face',
        date: '2026-09-20',
        scoreChange: null,
        followed: null,
      }),
    ),
  ];
});
afterEach(() => {
  resetPatientFile();
  vi.resetAllMocks();
});

describe('FeedbackCard (KICKOFF §6.6 Feedback)', () => {
  it('starts collapsed on the file’s counts, reading nothing, then opens on the chips and the cards', async () => {
    const { user, container } = renderCard();
    const card = await screen.findByTestId(ID);
    expect(card).toHaveTextContent('2 check-ins · 1 review');
    expect(within(card).getByTestId(`${ID}-toggle`)).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(listPatientFeedback).not.toHaveBeenCalled();
    await user.click(within(card).getByTestId(`${ID}-toggle`));
    await waitFor(() => expect(items()).toHaveLength(3));
    expect(listPatientFeedback).toHaveBeenCalledWith(TEST_PATIENT_ID);
    expect(
      ['all', 'visit', 'treatment', 'google'].map(
        (type) => within(card).getByTestId(`${ID}-type-${type}`).textContent,
      ),
    ).toEqual(['All', 'Consultation', 'Treatment feedback', 'Google']);
    expect(card).toHaveTextContent('Followed mostly');
    expect(card).toHaveTextContent('★★★★★');
    // The server's move against the check-in before (`score_change`).
    expect(card).toHaveTextContent('7/10 ▲ 2');
    // A check-in's sub line is the server's words; a review's visit, from her bookings.
    expect(card).toHaveTextContent('After LHR Full Face');
    await waitFor(() => expect(card).toHaveTextContent('Hydrafacial · Appt #2790'));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows one type at a time', async () => {
    const { user, card } = await openCard();
    await user.click(await within(card).findByTestId(`${ID}-type-treatment`));
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(items()[0]).toHaveTextContent('After LHR Full Face');
  });

  it('hands a card to its Edit, and logs feedback from the header', async () => {
    const { user, card, onEdit, onLog } = await openCard();
    await user.click(within(card).getByTestId(`${ID}-log`));
    expect(onLog).toHaveBeenCalledOnce();
    await waitFor(() => expect(items()).toHaveLength(3));
    const [first] = items();
    if (!first) throw new Error('no card');
    await user.click(within(first).getByTestId(`${ID}-item-edit`));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'review' }));
  });

  it('removes a check-in for a reason, with Undo — the record’s own route', async () => {
    const { user, card } = await openCard();
    await user.click(await within(card).findByTestId(`${ID}-type-visit`));
    await waitFor(() => expect(items()).toHaveLength(1));
    const [visit] = items();
    if (!visit) throw new Error('no card');
    await user.click(within(visit).getByTestId(`${ID}-item-remove`));
    const confirm = await screen.findByTestId(CONFIRM_TEST_IDS.dialog);
    expect(confirm).toHaveTextContent('Remove this check-in?');
    await user.click(screen.getByTestId(confirmReasonTestId('mistake')));
    await user.click(screen.getByTestId(CONFIRM_TEST_IDS.accept));
    await waitFor(() =>
      expect(deleteFeedback).toHaveBeenCalledWith(
        {
          patientId: TEST_PATIENT_ID,
          kind: 'checkIn',
          id: 'chk_visit0000000000000000',
          reason: 'mistake',
          note: null,
        },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Check-in removed',
        expect.any(Object),
      ),
    );
    await waitFor(() => expect(card).toHaveTextContent('1 check-in · 1 review'));
    const [, undo] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    undo.onUndo();
    await waitFor(() =>
      expect(restoreFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'checkIn', id: 'chk_visit0000000000000000' }),
      ),
    );
    await waitFor(() => expect(card).toHaveTextContent('2 check-ins · 1 review'));
  });

  it('logs the follow-up on a card the server says needs action — then names who did', async () => {
    store.items = [
      asCheckIn(
        checkIn({
          id: 'chk_bad',
          feel: 'worse',
          score: 3,
          scoreChange: -4,
          currentState: 'Itching',
          needsAction: true,
        }),
      ),
    ];
    const { user, card } = await openCard({}, { checkIns: 1, reviews: 0 });
    await waitFor(() => expect(items()).toHaveLength(1));
    const [bad] = items();
    if (!bad) throw new Error('no card');
    expect(bad).toHaveTextContent('Action needed');
    expect(bad).toHaveTextContent('3/10 ▼ 4');
    await user.click(within(bad).getByTestId(`${ID}-item-log-action`));
    // "Other" needs a note the menu has no field for.
    expect(screen.queryByTestId(`${ID}-item-action-other`)).not.toBeInTheDocument();
    await user.click(await screen.findByTestId(`${ID}-item-action-doctor_called`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('✓ Doctor called · logged'),
    );
    expect(logFeedbackAction).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: TEST_PATIENT_ID,
        kind: 'checkIn',
        id: 'chk_bad',
        action: 'doctor_called',
      }),
    );
    await waitFor(() =>
      expect(within(card).getByTestId(`${ID}-item-action`)).toHaveTextContent(
        /✓ Doctor called · .*Nisha/,
      ),
    );
    expect(within(card).queryByText('Action needed')).not.toBeInTheDocument();
  });

  it('shows six at a time — “Load more”', async () => {
    store.items = Array.from({ length: 9 }, (_, index) =>
      asCheckIn(checkIn({ id: `chk_${index}`, currentState: `Visit ${index}` })),
    );
    const { user, card } = await openCard({}, { checkIns: 9, reviews: 0 });
    await waitFor(() => expect(items()).toHaveLength(6));
    const more = within(card).getByTestId(`${ID}-load-more`);
    expect(more).toHaveTextContent('3 more');
    await user.click(more);
    await waitFor(() => expect(items()).toHaveLength(9));
    expect(within(card).queryByTestId(`${ID}-load-more`)).not.toBeInTheDocument();
  });

  it('offers the picker when there is no feedback yet', async () => {
    store.items = [];
    const { user, card, onLog } = await openCard({}, { checkIns: 0, reviews: 0 });
    expect(card).toHaveTextContent('No feedback yet');
    const empty = await within(card).findByTestId(`${ID}-empty`);
    expect(empty).toHaveTextContent(
      'Log a check-in or a review after the next visit · Log feedback',
    );
    await user.click(empty);
    expect(onLog).toHaveBeenCalledOnce();
  });

  it('says so, with Retry, when the cards cannot be read', async () => {
    vi.mocked(listPatientFeedback).mockRejectedValueOnce(new Error('offline'));
    const { user, card } = await openCard();
    const failed = await within(card).findByTestId(`${ID}-error`);
    expect(failed).toHaveTextContent('Feedback unavailable');
    await user.click(within(failed).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(items()).toHaveLength(3));
  });

  it('only reads without Patients edit', async () => {
    const { card } = await openCard({ canEdit: false });
    expect(within(card).queryByTestId(`${ID}-log`)).not.toBeInTheDocument();
    await waitFor(() => expect(items()).toHaveLength(3));
    expect(within(card).queryByTestId(`${ID}-item-edit`)).not.toBeInTheDocument();
  });
});
