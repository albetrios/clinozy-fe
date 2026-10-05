import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { isolateJoin, isolateText } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import {
  type CheckinFeel,
  OFFERING_CATEGORY_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import {
  type CheckInContext,
  FEEDBACK_LIMITS,
} from '@/shared/api/clinic/feedback-contracts.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  CHECKIN_FEEL_TONES,
  CHECKIN_FOLLOWED_TONES,
  OFFERING_CATEGORY_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import {
  type DrawerPeekItem,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { followedLabel, scoreTone } from '../../patient-feedback.ts';
import { CHECK_IN_KEYS, CHECK_IN_NS } from './check-in.constants.ts';
import type { CheckInFormValues } from './check-in-form.ts';
import type { CheckInStepId } from './use-check-in-save.ts';

const K = CHECK_IN_KEYS;

/** A step head's words: its sub line and its collapsed peek. */
export interface CheckInStepView {
  summary: string;
  peek: DrawerPeekItem[];
}

/** The drawer's title, sub line and the `context` a new check-in stores. */
export interface CheckInHead {
  title: string;
  sub: string;
  /** "Aftercare after LHR Full Face", "Visit check-in · Appt #2790" or "Visit check-in" (`S:510`). */
  context: string;
}

/** The stored `context`: what the check-in follows, in words, within the contract's 80. */
function contextText(context: CheckInContext | undefined, t: TFunction): string {
  let text = t(K.contextVisit);
  if (context?.treatment) {
    text = t(K.contextAftercare, { treatment: context.treatment.name });
  } else if (context?.appointment) {
    text = t(K.contextAppointment, {
      number: displayId.appointment(context.appointment.seq),
    });
  }
  return text.slice(0, FEEDBACK_LIMITS.context);
}

/**
 * The head (H:4396): "Aftercare check-in" after a treatment, "Visit check-in"
 * otherwise, over "Dharti Galani · LHR Full Face · last check-in 24 Sep: Same"
 * — the treatment's name or the visit's service, and the patient's check-in
 * before this one.
 */
export function useCheckInHead({
  patientName,
  aftercare,
  context,
}: {
  patientName: string;
  aftercare: boolean;
  context: CheckInContext | undefined;
}): CheckInHead {
  const { t } = useTranslation([CHECK_IN_NS, CLINIC_NS]);
  const { formatDate } = useLocaleFormat();
  const previous = context?.previous;
  const last = previous
    ? t(K.last, {
        date: isolateText(
          formatDate(
            localDateOf(previous.date),
            { day: 'numeric', month: 'short' },
            { civilDay: true },
          ),
        ),
        feel: t(CLINIC_KEYS.checkInFeels[previous.feel], { ns: CLINIC_NS }),
      })
    : '';
  const service = context?.treatment?.name ?? context?.appointment?.service;
  return {
    title: t(aftercare ? K.titles.aftercare : K.titles.visit),
    // The drawer's sub keeps the page's direction; each part is isolated.
    sub: isolateJoin([patientName, service, last]),
    context: contextText(context, t),
  };
}

/**
 * The offerings a plan can name (H:4396 `nextOf`): the active ones and any
 * already named, by category, each "₹4,800 · 7 sessions".
 */
export function useCheckInOfferingOptions(
  offerings: readonly OfferingRecord[],
  picked: readonly string[],
): PickerOption<OfferingRecord>[] {
  const { t } = useTranslation([CHECK_IN_NS, CLINIC_NS]);
  const money = usePaiseFormat();
  const rank = (offering: OfferingRecord) =>
    OFFERING_CATEGORY_VALUES.indexOf(offering.category);
  return offerings
    .filter((offering) => offering.active || picked.includes(offering.id))
    .sort((a, b) => rank(a) - rank(b))
    .map((offering) => ({
      key: offering.id,
      label: offering.name,
      sub:
        offering.sessions > 1
          ? t(K.offeringSessions, {
              price: money(offering.price),
              count: offering.sessions,
            })
          : money(offering.price),
      group: t(CLINIC_KEYS.offerings.categories[offering.category], { ns: CLINIC_NS }),
      groupTone: OFFERING_CATEGORY_TONES[offering.category],
      tone: offering.tone,
      keywords: offering.searchTerms,
      data: offering,
    }));
}

/**
 * Each step head's sub line — its first filled values (H:3840 `stepSum`) —
 * and its collapsed peek: the feel and the score in their tones, the words;
 * how far the advice was followed and the details; the plan and the
 * offerings it names.
 */
export function useCheckInStepsView(
  values: CheckInFormValues,
  named: readonly PickerOption<OfferingRecord>[],
): Record<CheckInStepId, CheckInStepView> {
  const { t } = useTranslation([CHECK_IN_NS, CLINIC_NS]);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const feelOf = (feel: CheckinFeel) =>
    t(CLINIC_KEYS.checkInFeels[feel], { ns: CLINIC_NS });
  const feel = values.feel ? feelOf(values.feel) : '';
  const score = values.score > 0 ? String(values.score) : '';
  const now = values.now.trim();
  const followed = values.followed ? followedLabel(t, values.followed) : '';
  const details = values.followedNote.trim();
  const plan = values.nextPlan.trim();
  return {
    now: {
      summary: drawerStepSummary([feel, score, now], notFilled),
      peek: [
        {
          kind: 'value',
          label: t(K.feel),
          value: feel || undefined,
          tone: values.feel ? CHECKIN_FEEL_TONES[values.feel] : undefined,
        },
        {
          kind: 'value',
          label: t(K.score),
          value: score || undefined,
          tone: values.score > 0 ? scoreTone(values.score) : undefined,
        },
        { kind: 'value', label: t(K.words), value: now || undefined },
      ],
    },
    followed: {
      summary: drawerStepSummary([followed, details], notFilled),
      peek: [
        {
          kind: 'value',
          label: t(K.followed),
          value: followed || undefined,
          tone: values.followed ? CHECKIN_FOLLOWED_TONES[values.followed] : undefined,
        },
        { kind: 'value', label: t(K.details), value: details || undefined },
      ],
    },
    next: {
      summary: drawerStepSummary(
        [plan, named.map((option) => option.label).join(', ')],
        notFilled,
      ),
      peek: [
        { kind: 'value', label: t(K.plan), value: plan || undefined },
        {
          kind: 'multi',
          label: t(K.offerings),
          values: named.map((option) => ({ label: option.label, tone: option.tone })),
        },
      ],
    },
  };
}
