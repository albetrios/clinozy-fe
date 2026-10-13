import { useTranslation } from 'react-i18next';

import { isolateJoin, isolateText } from '@/lib/bidi-isolate.ts';
import {
  type CheckinFeel,
  OFFERING_CATEGORY_VALUES,
} from '@/shared/api/app/app-schema.ts';
import { localDateOf } from '@/shared/api/app/app-time.ts';
import type {
  CheckInContext,
  CheckInOffering,
} from '@/shared/api/app/feedback-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import {
  CHECKIN_FEEL_TONES,
  CHECKIN_FOLLOWED_TONES,
  OFFERING_CATEGORY_TONES,
} from '@/shared/app/app-tones.ts';
import type { DrawerPeekItem } from '@/shared/components/DrawerSteps/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { followedLabel, scoreTone } from '../../patient-feedback.ts';
import { CHECK_IN_KEYS, CHECK_IN_NS } from './check-in.constants.ts';
import type { CheckInFormValues } from './check-in-form.ts';
import type { CheckInStepId } from './use-check-in-save.ts';

const K = CHECK_IN_KEYS;

/** A step head's words: its collapsed peek. */
export interface CheckInStepView {
  peek: DrawerPeekItem[];
}

/** The drawer's title and sub line. */
export interface CheckInHead {
  title: string;
  sub: string;
}

/**
 * The head (H:4396): "Aftercare check-in" after a treatment, "Visit check-in"
 * otherwise, over "Dharti Galani · LHR Full Face · last check-in 24 Sep: Same"
 * — the treatment's name or the visit's service, and the patient's check-in
 * before this one. The stored `context` is the server's words (TR9), not the drawer's.
 */
export function useCheckInHead({
  patientName,
  aftercare,
  context,
}: {
  patientName: string;
  aftercare: boolean;
  context: CheckInContext;
}): CheckInHead {
  const { t } = useTranslation([CHECK_IN_NS, APP_NS]);
  const { formatDate } = useLocaleFormat();
  const { previous } = context;
  const last = previous
    ? t(K.last, {
        date: isolateText(
          formatDate(
            localDateOf(previous.date),
            { day: 'numeric', month: 'short' },
            { civilDay: true },
          ),
        ),
        feel: t(APP_KEYS.checkInFeels[previous.feel], { ns: APP_NS }),
      })
    : '';
  const service = context.treatmentName ?? context.visitService;
  return {
    title: t(aftercare ? K.titles.aftercare : K.titles.visit),
    // The drawer's sub keeps the page's direction; each part is isolated.
    sub: isolateJoin([patientName, service, last]),
  };
}

/**
 * The offerings a plan can name (H:4396 `nextOf`): the active ones and any
 * already named, by category, each "₹4,800 · 7 sessions" (the API's rupees).
 */
export function useCheckInOfferingOptions(
  offerings: readonly CheckInOffering[],
  picked: readonly string[],
): PickerOption<CheckInOffering>[] {
  const { t } = useTranslation([CHECK_IN_NS, APP_NS]);
  const paise = usePaiseFormat();
  const money = (rupees: number) => paise(Math.round(rupees * 100));
  const rank = (offering: CheckInOffering) =>
    OFFERING_CATEGORY_VALUES.indexOf(offering.category);
  return offerings
    .filter((offering) => offering.isActive || picked.includes(offering.id))
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
      group: t(APP_KEYS.offerings.categories[offering.category], { ns: APP_NS }),
      groupTone: OFFERING_CATEGORY_TONES[offering.category],
      tone: offering.tone,
      keywords: offering.searchTerms,
      data: offering,
    }));
}

/**
 * Each step head's collapsed peek: the feel and the score in their tones, the
 * words; how far the advice was followed and the details; the plan and the
 * offerings it names.
 */
export function useCheckInStepsView(
  values: CheckInFormValues,
  named: readonly PickerOption<CheckInOffering>[],
): Record<CheckInStepId, CheckInStepView> {
  const { t } = useTranslation([CHECK_IN_NS, APP_NS]);
  const feelOf = (feel: CheckinFeel) => t(APP_KEYS.checkInFeels[feel], { ns: APP_NS });
  const feel = values.feel ? feelOf(values.feel) : '';
  const score = values.score > 0 ? String(values.score) : '';
  const now = values.currentState.trim();
  const followed = values.followed ? followedLabel(t, values.followed) : '';
  const details = values.followedNote.trim();
  const plan = values.nextPlan.trim();
  return {
    now: {
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
