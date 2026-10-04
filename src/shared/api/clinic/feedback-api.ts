import { isHttpError } from '@/shared/errors/HttpError.ts';

import { compareText, validateClinicInput } from './clinic-fixture-store.ts';
import type { CheckIn, DeleteReason, FeedbackAction, Review } from './clinic-schema.ts';
import {
  type CheckInContext,
  type CheckInFeedback,
  type CheckInInput,
  checkInInputSchema,
  type CheckInSaved,
  FEEDBACK_PAGE_SIZE,
  type FeedbackActionInput,
  feedbackActionInputSchema,
  type FeedbackItem,
  type FeedbackLoggedAction,
  type FeedbackPerson,
  type FeedbackType,
  type PatientFeedbackPage,
  type ReviewFeedback,
  type ReviewInput,
  reviewInputSchema,
  type ReviewSaved,
} from './feedback-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';
import { addSuggestion } from './plan-api.ts';
import { createTask } from './tasks-api.ts';
import type { StaffProfile } from './users-contracts.ts';

/*
 * The patient file's feedback (KICKOFF §6.6 Feedback; `S:1636, 1648–1650`), on
 * the fixture world until clinozy-be serves it — REPLACE_WITH_API (D6).
 */

/** TanStack Query keys for feedback — under the patients' key (the file's counts and rail). */
export const feedbackQueryKeys = {
  all: [...patientQueryKeys.all, 'feedback'] as const,
  /** One page of a patient's cards of one type. */
  patient: (patientId: string, type: FeedbackType, limit: number) =>
    [...feedbackQueryKeys.all, 'patient', patientId, type, limit] as const,
  checkIn: (id: string) => [...feedbackQueryKeys.all, 'check-in', id] as const,
  review: (id: string) => [...feedbackQueryKeys.all, 'review', id] as const,
  context: (
    patientId: string,
    appointmentId: string,
    treatmentId: string,
    editing: string,
  ) =>
    [
      ...feedbackQueryKeys.all,
      'context',
      patientId,
      appointmentId,
      treatmentId,
      editing,
    ] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const fixtureStaff = () => import('./fixtures/staff.fixtures.ts');

type World = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/** A call-back after a bad check-in is due in 3 hours (`S:1648`), after a low review in 4 (`S:1649`). */
const CALL_BACK_HOURS = { checkIn: 3, review: 4 } as const;

/** Worse, or a score of 4 or less (`S:520`); 0 is "not rated" (A-F12). */
export function checkInNeedsAction(checkIn: Pick<CheckIn, 'feel' | 'score'>): boolean {
  return checkIn.feel === 'worse' || (checkIn.score > 0 && checkIn.score <= 4);
}

/** A rating of 3 or less (`S:538`). */
export function reviewNeedsAction(review: Pick<Review, 'rating'>): boolean {
  return review.rating !== null && review.rating <= 3;
}

/** Newest first: the day, then when it was logged. */
const newestFirst = (a: { date: string; createdAt: string }, b: typeof a) =>
  compareText(b.date, a.date) || compareText(b.createdAt, a.createdAt);

function personOf(profile: StaffProfile | undefined): FeedbackPerson | null {
  if (!profile) return null;
  return {
    id: profile.id,
    name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    initials: profile.initials,
    tone: profile.tone,
  };
}

/** The joins every card makes: people, visits, treatments, the actions logged. */
function joins(world: World) {
  const staff = new Map(world.staff.snapshot().map((profile) => [profile.id, profile]));
  const appointments = new Map(world.appointments.snapshot().map((row) => [row.id, row]));
  const treatments = new Map(world.treatments.snapshot().map((row) => [row.id, row]));
  const actions = world.feedbackActions
    .snapshot()
    .sort((a, b) => compareText(b.createdAt, a.createdAt));
  const visitOf = (id: string | null) => {
    const row = id ? appointments.get(id) : undefined;
    return row ? { seq: row.seq, service: row.serviceLabel || null } : null;
  };
  const actionOf = (
    match: (action: FeedbackAction) => boolean,
  ): FeedbackLoggedAction | null => {
    const action = actions.find(match);
    return action
      ? {
          action: action.action,
          note: action.note,
          by: personOf(staff.get(action.byId)),
          at: action.createdAt,
        }
      : null;
  };
  return {
    by: (id: string) => personOf(staff.get(id)),
    visitOf,
    treatmentName: (id: string | null) =>
      id ? (treatments.get(id)?.name ?? null) : null,
    actionOf,
  };
}

/** Which type chip a card answers to. */
function typeOf(item: FeedbackItem): FeedbackType {
  if (item.kind === 'review') return item.review.source;
  return item.checkIn.treatmentId ? 'treatment' : 'visit';
}

/** Every feedback card of a patient, newest first (REPLACE_WITH_API). */
async function allFeedback(patientId: string): Promise<FeedbackItem[]> {
  const { clinicFixtures } = await fixtureWorld();
  const join = joins(clinicFixtures);
  const checkIns = clinicFixtures.checkIns
    .snapshot((row) => row.patientId === patientId)
    .sort(newestFirst);
  const scored = checkIns.filter((row) => row.score > 0);
  const cards: FeedbackItem[] = [
    ...checkIns.map((checkIn): CheckInFeedback => {
      const earlier = scored.find(
        (row) => row !== checkIn && newestFirst(checkIn, row) < 0,
      );
      return {
        kind: 'checkIn',
        id: checkIn.id,
        date: checkIn.date,
        checkIn,
        treatmentName: join.treatmentName(checkIn.treatmentId),
        appointment: join.visitOf(checkIn.appointmentId),
        previousScore: checkIn.score > 0 && earlier ? earlier.score : null,
        needsAction: checkInNeedsAction(checkIn),
        action: join.actionOf((action) => action.checkInId === checkIn.id),
        by: join.by(checkIn.byId),
      };
    }),
    ...clinicFixtures.reviews
      .snapshot((row) => row.patientId === patientId)
      .map((review): ReviewFeedback => ({
        kind: 'review',
        id: review.id,
        date: review.date,
        review,
        appointment: join.visitOf(review.appointmentId),
        needsAction: reviewNeedsAction(review),
        action: join.actionOf((action) => action.reviewId === review.id),
        by: join.by(review.byId),
      })),
  ];
  return cards.sort((a, b) =>
    newestFirst(
      { date: a.date, createdAt: recordOf(a).createdAt },
      { date: b.date, createdAt: recordOf(b).createdAt },
    ),
  );
}

const recordOf = (item: FeedbackItem) =>
  item.kind === 'checkIn' ? item.checkIn : item.review;

/**
 * One page of a patient's feedback (`listFeedback`, `S:1636`; REPLACE_WITH_API):
 * the cards of a type, newest first, up to `limit` — "Load more" asks for six
 * more — with the counts and the types the chips offer.
 */
export async function listPatientFeedback(
  patientId: string,
  {
    type = 'all',
    limit = FEEDBACK_PAGE_SIZE,
  }: { type?: FeedbackType; limit?: number } = {},
): Promise<PatientFeedbackPage> {
  const all = await allFeedback(patientId);
  const shown = type === 'all' ? all : all.filter((item) => typeOf(item) === type);
  const present = new Set(all.map(typeOf));
  return {
    items: shown.slice(0, limit),
    total: shown.length,
    counts: {
      checkIns: all.filter((item) => item.kind === 'checkIn').length,
      reviews: all.filter((item) => item.kind === 'review').length,
    },
    types: (
      [
        'visit',
        'treatment',
        'google',
        'video',
        'instagram',
        'internal_form',
        'whatsapp',
      ] as const
    ).filter((kind) => present.has(kind)),
  };
}

/** One check-in — a 404 when it is unknown or removed (REPLACE_WITH_API). */
export async function fetchCheckIn(id: string): Promise<CheckIn> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.checkIns.get(id);
}

/** One review — a 404 when it is unknown or removed (REPLACE_WITH_API). */
export async function fetchReview(id: string): Promise<Review> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.reviews.get(id);
}

/**
 * What the check-in drawer heads with (H:4396): the patient's latest check-in
 * before this one ("last check-in 24 Sep: Same", the "Last time: …"
 * placeholders), the treatment it follows and the visit (REPLACE_WITH_API).
 */
export async function fetchCheckInContext(
  patientId: string,
  {
    appointmentId = null,
    treatmentId = null,
    editingId = null,
  }: {
    appointmentId?: string | null;
    treatmentId?: string | null;
    editingId?: string | null;
  } = {},
): Promise<CheckInContext> {
  const { clinicFixtures } = await fixtureWorld();
  const editing = editingId
    ? clinicFixtures.checkIns.snapshot((row) => row.id === editingId)[0]
    : undefined;
  const previous =
    clinicFixtures.checkIns
      .snapshot(
        (row) =>
          row.patientId === patientId &&
          row.id !== editingId &&
          (!editing || newestFirst(editing, row) < 0),
      )
      .sort(newestFirst)[0] ?? null;
  const treatment = treatmentId
    ? clinicFixtures.treatments.snapshot((row) => row.id === treatmentId)[0]
    : undefined;
  const appointment = appointmentId
    ? clinicFixtures.appointments.snapshot((row) => row.id === appointmentId)[0]
    : undefined;
  return {
    previous,
    treatment: treatment
      ? { id: treatment.id, name: treatment.name, doctorId: treatment.doctorId }
      : null,
    appointment: appointment
      ? {
          id: appointment.id,
          seq: appointment.seq,
          service: appointment.serviceLabel || null,
        }
      : null,
  };
}

/** The doctor a call-back goes to: the treatment's, the visit's, else the patient's usual one. */
function callBackDoctor(
  world: World,
  {
    patientId,
    appointmentId,
    treatmentId,
  }: { patientId: string; appointmentId: string | null; treatmentId?: string | null },
): string | null {
  const treatment = treatmentId
    ? world.treatments.snapshot((row) => row.id === treatmentId)[0]
    : undefined;
  const appointment = appointmentId
    ? world.appointments.snapshot((row) => row.id === appointmentId)[0]
    : undefined;
  const patient = world.patients.snapshot((row) => row.id === patientId)[0];
  return treatment?.doctorId ?? appointment?.doctorId ?? patient?.doctorId ?? null;
}

/** Create the call-back task a bad check-in or a low review sets off (`S:1648–1649`). */
async function createCallBack(
  world: World,
  input: {
    patientId: string;
    appointmentId: string | null;
    treatmentId?: string | null;
    hours: number;
    why: string;
  },
): Promise<void> {
  const patient = await world.patients.get(input.patientId);
  const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
  await createTask({
    title: `Call back ${name}`,
    why: input.why,
    ownerId: callBackDoctor(world, input),
    ownerRole: 'doctor',
    patientId: input.patientId,
    dueAt: new Date(Date.now() + input.hours * 3_600_000).toISOString(),
    kind: 'callback',
    manualType: 'call_back',
    priority: 'high',
  });
}

/**
 * Each offering a check-in names becomes a Planned suggestion (`S:519`); one
 * already in the plan stays as it is (the server's 409) and is not counted.
 */
async function planOfferings(input: CheckInInput, offeringIds: readonly string[]) {
  let added = 0;
  for (const offeringId of offeringIds) {
    try {
      await addSuggestion({
        patientId: input.patientId,
        offeringId,
        appointmentId: input.appointmentId,
        sourceLabel: input.context,
        reason: input.nextPlan,
      });
      added += 1;
    } catch (error) {
      if (!(isHttpError(error) && error.status === 409)) throw error;
    }
  }
  return added;
}

/**
 * Save a new check-in (`createCheckIn`, `S:1648`; REPLACE_WITH_API): the
 * record, a Planned suggestion per offering it names, and — when it is Worse
 * or scores 4 or less — a doctor call-back due in 3 hours.
 */
export async function createCheckIn(input: CheckInInput): Promise<CheckInSaved> {
  const [{ clinicFixtures }, { FIXTURE_VIEWER_ID }] = await Promise.all([
    fixtureWorld(),
    fixtureStaff(),
  ]);
  const fields = validateClinicInput(checkInInputSchema, input);
  await clinicFixtures.patients.get(fields.patientId);
  const checkIn = await clinicFixtures.checkIns.create({
    ...fields,
    byId: FIXTURE_VIEWER_ID,
  });
  const suggestionsAdded = await planOfferings(fields, fields.nextOfferingIds);
  const callBackCreated = checkInNeedsAction(checkIn);
  if (callBackCreated) {
    await createCallBack(clinicFixtures, {
      ...fields,
      hours: CALL_BACK_HOURS.checkIn,
      why: fields.context,
    });
  }
  return { checkIn, suggestionsAdded, callBackCreated };
}

/**
 * Save an edited check-in (`updateCheckIn`, `S:1648`; REPLACE_WITH_API): the
 * offerings it newly names become suggestions, and a call-back is set off
 * only when it turns bad — a bad one already has its call-back.
 */
export async function updateCheckIn(
  id: string,
  input: CheckInInput,
): Promise<CheckInSaved> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(checkInInputSchema, input);
  const before = await clinicFixtures.checkIns.get(id);
  const checkIn = await clinicFixtures.checkIns.update(id, fields);
  const added = fields.nextOfferingIds.filter(
    (offeringId) => !before.nextOfferingIds.includes(offeringId),
  );
  const suggestionsAdded = await planOfferings(fields, added);
  const callBackCreated = checkInNeedsAction(checkIn) && !checkInNeedsAction(before);
  if (callBackCreated) {
    await createCallBack(clinicFixtures, {
      ...fields,
      hours: CALL_BACK_HOURS.checkIn,
      why: fields.context,
    });
  }
  return { checkIn, suggestionsAdded, callBackCreated };
}

/** Remove a check-in with its reason ("Remove this check-in?"; D32); Undo restores it. */
export async function deleteCheckIn(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<CheckIn> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.checkIns.remove(id, reason, note);
}

/** Restore a removed check-in — its toast's Undo. */
export async function restoreCheckIn(id: string): Promise<CheckIn> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.checkIns.restore(id);
}

/** A review's call-back reason: "3★ Google review". */
const reviewWhy = (review: Pick<Review, 'rating' | 'source'>) =>
  `${review.rating ?? 0}★ ${review.source.replace('_', ' ')} review`;

/**
 * Save a new review (`createReview`, `S:1649`; REPLACE_WITH_API): the record,
 * and a call-back due in 4 hours when it rates 3 or less. Its files follow
 * through the upload tray (`attachReviewFile`).
 */
export async function createReview(input: ReviewInput): Promise<ReviewSaved> {
  const [{ clinicFixtures }, { FIXTURE_VIEWER_ID }] = await Promise.all([
    fixtureWorld(),
    fixtureStaff(),
  ]);
  const fields = validateClinicInput(reviewInputSchema, input);
  await clinicFixtures.patients.get(fields.patientId);
  const review = await clinicFixtures.reviews.create({
    ...fields,
    files: [],
    byId: FIXTURE_VIEWER_ID,
  });
  const callBackCreated = reviewNeedsAction(review);
  if (callBackCreated) {
    await createCallBack(clinicFixtures, {
      ...fields,
      hours: CALL_BACK_HOURS.review,
      why: reviewWhy(review),
    });
  }
  return { review, callBackCreated };
}

/** Save an edited review (`updateReview`, `S:1649`); a call-back only when it turns low. */
export async function updateReview(id: string, input: ReviewInput): Promise<ReviewSaved> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(reviewInputSchema, input);
  const before = await clinicFixtures.reviews.get(id);
  const review = await clinicFixtures.reviews.update(id, fields);
  const callBackCreated = reviewNeedsAction(review) && !reviewNeedsAction(before);
  if (callBackCreated) {
    await createCallBack(clinicFixtures, {
      ...fields,
      hours: CALL_BACK_HOURS.review,
      why: reviewWhy(review),
    });
  }
  return { review, callBackCreated };
}

/**
 * Attach an uploaded file to a review — the key the upload tray confirmed
 * (REPLACE_WITH_API). A key already on it is not added twice; ten at most.
 */
export async function attachReviewFile(reviewId: string, key: string): Promise<Review> {
  const { clinicFixtures } = await fixtureWorld();
  const review = await clinicFixtures.reviews.get(reviewId);
  if (review.files.includes(key)) return review;
  return clinicFixtures.reviews.update(reviewId, {
    files: [...review.files, key].slice(0, 10),
  });
}

/** Remove a review with its reason ("Remove this review?"); Undo restores it. */
export async function deleteReview(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<Review> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.reviews.remove(id, reason, note);
}

/** Restore a removed review — its toast's Undo. */
export async function restoreReview(id: string): Promise<Review> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.reviews.restore(id);
}

/** Log the follow-up on a card ("✓ Doctor called · logged"; `S:1650`; REPLACE_WITH_API). */
export async function logFeedbackAction(
  input: FeedbackActionInput,
): Promise<FeedbackAction> {
  const [{ clinicFixtures }, { FIXTURE_VIEWER_ID }] = await Promise.all([
    fixtureWorld(),
    fixtureStaff(),
  ]);
  const fields = validateClinicInput(feedbackActionInputSchema, input);
  if (fields.checkInId) await clinicFixtures.checkIns.get(fields.checkInId);
  if (fields.reviewId) await clinicFixtures.reviews.get(fields.reviewId);
  return clinicFixtures.feedbackActions.create({ ...fields, byId: FIXTURE_VIEWER_ID });
}
