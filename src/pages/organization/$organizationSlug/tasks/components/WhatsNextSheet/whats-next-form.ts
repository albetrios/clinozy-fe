import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  type CreateTaskInput,
  TASK_FOLLOW_UP_SPANS,
  type TaskFollowUpWhen,
  taskTimeAfter,
} from '@/shared/api/clinic/tasks-contracts.ts';

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

/** The form as it opens: nothing picked, the member assigned. */
export function emptyWhatsNextForm(): WhatsNextForm {
  return { step: null, when: null, ownerId: null, note: '' };
}

/** The required picks still missing, in the form's order. */
export function whatsNextMissing(form: WhatsNextForm): ('step' | 'when')[] {
  const missing: ('step' | 'when')[] = [];
  if (!form.step) missing.push('step');
  if (!form.when) missing.push('when');
  return missing;
}

/**
 * The follow-up the form creates (`createTask`, S:1727): a "Follow-ups you set"
 * task after the closed one — its source copied — titled "<step> · <first>",
 * due in 3 h, tomorrow 11:00, in 3 or 7 days; its why line the note, else
 * "Planned after: <task> · <result>". Null while a pick is missing.
 */
export function whatsNextInputOf(
  form: WhatsNextForm,
  {
    followsTaskId,
    ownerId,
    title,
    plannedAfter,
    now,
  }: {
    followsTaskId: string;
    ownerId: string | null;
    title: string;
    plannedAfter: string;
    now: Date;
  },
): CreateTaskInput | null {
  if (!(form.step && form.when)) return null;
  return {
    title,
    why: form.note.trim() || plannedAfter,
    ownerId,
    dueAt: taskTimeAfter(TASK_FOLLOW_UP_SPANS[form.when], now),
    rule: 'manual',
    followsTaskId,
  };
}
