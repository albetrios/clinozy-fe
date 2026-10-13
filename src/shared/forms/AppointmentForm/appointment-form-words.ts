import { isolateJoin, isolateValues } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type {
  AppointmentRow,
  AppointmentStaff,
} from '@/shared/api/app/appointments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';

import { APPOINTMENT_FORM_KEYS } from './appointment-form.constants.ts';
import type {
  AppointmentDraft,
  AppointmentFormMode,
  SavedSlot,
  SaveLabelKind,
} from './appointment-form-model.ts';

/*
 * The appointment form's derived words (`appointments.md` › Copy): the title,
 * the footer's summary and primary, step 1's summary and the cancelled
 * banner's reason. Pure — the caller hands its `t`. Names, days and times are
 * isolated in what they compose, so each stays whole on a right-to-left page.
 */

/** The `t` the words are made with. */
export type FormTranslate = (key: string, values?: Record<string, unknown>) => string;

const K = APPOINTMENT_FORM_KEYS;

/** The drawer's title: "New appointment", "Appointment #<seq>", "Reschedule #<seq>". */
export function formTitle(
  t: FormTranslate,
  mode: AppointmentFormMode,
  row: AppointmentRow | undefined,
): string {
  if (mode === 'create') return t(K.title.create);
  if (!row) return t(K.title.loading);
  const id = displayId.appointment(row.seq);
  return mode === 'reschedule' ? t(K.title.reschedule, { id }) : t(K.title.edit, { id });
}

/** The footer's summary (H:6044): "<who> · <service> · <n> min · <doctor>". */
export function footerSummary(
  t: FormTranslate,
  draft: AppointmentDraft,
  doctor: AppointmentStaff | undefined,
): string {
  return isolateJoin([
    draft.who?.name,
    draft.serviceLabel,
    t(K.footer.minutes, { minutes: draft.durationMin }),
    doctor?.name ?? '',
  ]);
}

/** The primary (H:5983): "Pick a time" · "Book <day>, <time>" · "Move to <day>, <time>" · "Save changes". */
export function saveLabelText(
  t: FormTranslate,
  kind: SaveLabelKind,
  slot: { day: string; time: string },
): string {
  if (kind === 'pickTime' || kind === 'saveChanges') return t(K.footer[kind]);
  return t(K.footer[kind], isolateValues(slot));
}

/** Step 1's summary when collapsed: service · doctor · length · “reason”, else "Not filled yet". */
export function detailsSummaryText(
  t: FormTranslate,
  draft: AppointmentDraft,
  doctor: AppointmentStaff | undefined,
): string {
  const reason = draft.reason.trim();
  const summary = isolateJoin([
    draft.serviceLabel,
    doctor?.name ?? '',
    t(K.footer.minutes, { minutes: draft.durationMin }),
    reason ? `“${reason.slice(0, 40)}”` : '',
  ]);
  return summary || t(K.details.notFilled);
}

/**
 * The Rescheduled note (H:4142): "Rescheduled · was <day> <time> · …" — "needs
 * confirming again" for a Confirmed booking; `null` without a move.
 */
export function rescheduledText(
  t: FormTranslate,
  note: { was: SavedSlot; confirmAgain: boolean } | null,
  slotLabel: (date: string, time: string) => { day: string; time: string },
): string | null {
  if (!note) return null;
  const key = note.confirmAgain ? K.status.rescheduledConfirm : K.status.rescheduled;
  return t(key, isolateValues(slotLabel(note.was.date, note.was.time)));
}

/** The cancelled banner's reason: an "Other"'s note, else the reason's label; `null` without one. */
export function cancelReasonText(
  t: FormTranslate,
  row: AppointmentRow | undefined,
): string | null {
  if (!row?.cancelReason) return null;
  if (row.cancelReason === 'other' && row.cancelNote) return row.cancelNote;
  return t(APP_KEYS.appointments.cancelReasons[row.cancelReason], { ns: APP_NS });
}
