import type { Tone } from '@/shared/api/app/app-schema.ts';
import {
  TASK_FOLLOW_UP_SPANS,
  type TaskFields,
  type TaskFollowUpWhen,
  type TaskRecord,
  taskTimeAfter,
} from '@/shared/api/app/tasks-contracts.ts';

/** "What’s next" Next step chips (H:4054), in order. */
export const WHATS_NEXT_STEPS = [
  'callAgain',
  'sendWhatsApp',
  'bookVisit',
  'collectPayment',
  'sendOffer',
] as const;

/** One Next step chip. */
export type WhatsNextStep = (typeof WHATS_NEXT_STEPS)[number];

/** Each step in its tone: sky · sage · lav · peach · butter (H:4054). */
export const WHATS_NEXT_STEP_TONES: Readonly<Record<WhatsNextStep, Tone>> = {
  callAgain: 'sky',
  sendWhatsApp: 'sage',
  bookVisit: 'lav',
  collectPayment: 'peach',
  sendOffer: 'butter',
};

/** The "What’s next" form. */
export interface WhatsNextForm {
  step: WhatsNextStep | null;
  when: TaskFollowUpWhen | null;
  /** Picked assignee; null keeps the member ("<name> (you)" preselected). */
  ownerId: string | null;
  note: string;
}

/** A required pick of the form. */
export type WhatsNextRequired = 'step' | 'when' | 'ownerId';

/** The form as it opens: nothing picked, the member assigned. */
export function emptyWhatsNextForm(): WhatsNextForm {
  return { step: null, when: null, ownerId: null, note: '' };
}

/** The required picks still missing, in the form's order — the owner being the one in effect. */
export function whatsNextMissing(
  form: WhatsNextForm,
  ownerId: string | null,
): WhatsNextRequired[] {
  const missing: WhatsNextRequired[] = [];
  if (!form.step) missing.push('step');
  if (!form.when) missing.push('when');
  if (!ownerId) missing.push('ownerId');
  return missing;
}

/**
 * The follow-up the form creates (`POST /app/tasks`, research-tasks Q2 — the
 * second of two steps, after the close): a task made by hand for the closed
 * task's person and record — so it files under the same branch — titled
 * "<step> · <first>", due in 3 h, tomorrow 11:00, in 3 or 7 days from `now`;
 * its why line the note, else "Planned after: <task> · <result>"; for the
 * member picked (the member themself by default), at normal priority. Null
 * while a pick is missing.
 */
export function whatsNextFieldsOf(
  form: WhatsNextForm,
  {
    closed,
    ownerId,
    title,
    plannedAfter,
    now,
  }: {
    /** The task just closed — its person and the record it points at. */
    closed: Pick<TaskRecord, 'contact' | 'link'>;
    ownerId: string | null;
    title: string;
    plannedAfter: string;
    now: Date;
  },
): TaskFields | null {
  if (!(form.step && form.when && ownerId)) return null;
  return {
    title,
    why: form.note.trim() || plannedAfter,
    dueAt: taskTimeAfter(TASK_FOLLOW_UP_SPANS[form.when], now),
    assignee: { membershipId: ownerId },
    priority: 'normal',
    contactId: closed.contact?.id ?? null,
    link: closed.link,
  };
}
