import { type KeyboardEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type {
  LeadInterest,
  LeadStatus,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';
import type { LeadRecordSource } from '@/shared/api/clinic/leads-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  LEAD_INTEREST_TONES,
  LEAD_SOURCE_TONES,
  LEAD_STATUS_TONES,
  TONE_CLASSES,
  toneForLabel,
} from '@/shared/clinic/clinic-tones.ts';
import { DrawerChips } from '@/shared/components/DrawerField/index.ts';
import { Check, Plus } from '@/shared/icons/index.ts';

import { LEADS_KEYS, LEADS_NS } from '../../leads.constants.ts';
import { LEAD_SOURCE_ICONS, LEAD_SOURCE_ORDER } from '../LeadFields/lead-display.ts';

/** The four steps of the track, in order (H:1810); the rest close the lead. */
const MAIN_STATUSES = [
  'new',
  'contacted',
  'follow_up',
  'clinic_visited',
] as const satisfies readonly LeadStatus[];

/** "Close as" (H:1811). */
const CLOSING_STATUSES = [
  'no_response',
  'not_interested',
  'invalid',
  'lost',
] as const satisfies readonly LeadStatus[];

/** The interest chips the drawer offers — the six without "Others" (H:5722). */
const INTEREST_CHIPS = [
  'clinical',
  'peel',
  'lhr',
  'hydrafacial',
  'prp',
] as const satisfies readonly LeadInterest[];

/** A typed interest's longest form (`leads.md:64`). */
const CUSTOM_INTEREST_MAX = 30;

/** A drawer card (H:1768, H:1809, H:1813): a 24px number circle — green once filled — and the title. */
export function LeadCard({
  label,
  number,
  done,
  children,
}: {
  label: string;
  /** The circle's number; none for Info. */
  number?: number;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      data-slot="surface"
      className="bg-card flex flex-none flex-col overflow-hidden rounded-xl border"
    >
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        {number === undefined ? null : (
          <span
            aria-hidden="true"
            data-slot="pill"
            className={cn(
              'text-tiny flex size-6 flex-none items-center justify-center rounded-full font-semibold tabular-nums',
              done
                ? 'bg-success text-success-foreground'
                : 'bg-foreground text-background',
            )}
          >
            {number}
          </span>
        )}
        <h3 className="text-body-lg font-semibold">{label}</h3>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pb-4">{children}</div>
    </section>
  );
}

/** A field inside a card: the 12px label over its control. */
export function LeadField({
  label,
  action,
  children,
}: {
  label: string;
  /** Pills at the label's inline end ("Claim", "Release"). */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-muted-foreground-strong flex flex-wrap items-center gap-1.5 text-xs font-medium">
        {label}
        {action ? (
          <span className="ms-auto flex items-center gap-1.5">{action}</span>
        ) : null}
      </span>
      {children}
    </div>
  );
}

/** Source (`leads.md:63`): one chip, each with its icon in its tone; "Phone call" last (Q-L6). */
export function LeadSourceField({
  value,
  onChange,
}: {
  value: LeadRecordSource | null;
  onChange: (source: LeadRecordSource) => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  return (
    <LeadField label={t(LEADS_KEYS.drawer.source)}>
      <DrawerChips
        label={t(LEADS_KEYS.drawer.source)}
        options={LEAD_SOURCE_ORDER.map((source) => ({
          value: source,
          label: tClinic(CLINIC_KEYS.leads.sources[source]),
          tone: LEAD_SOURCE_TONES[source],
          icon: LEAD_SOURCE_ICONS[source],
        }))}
        value={value}
        onChange={(source) => {
          if (source) onChange(source);
        }}
      />
    </LeadField>
  );
}

/** The interests as the record keeps them: the contract's and the typed ones. */
export interface LeadInterestsValue {
  interests: readonly LeadInterest[];
  customInterests: readonly string[];
}

const CUSTOM_PREFIX = 'custom:';

/**
 * Interested in (`leads.md:64`): Clinical · Peel · LHR · Hydrafacial · PRP and
 * every typed one, picked chips with a check; the dashed 90px "Add interest"
 * adds on Enter or blur (≤ 30, case-insensitive dedupe), Esc clears it.
 */
export function LeadInterestsField({
  value,
  onChange,
}: {
  value: LeadInterestsValue;
  onChange: (value: LeadInterestsValue) => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const [typed, setTyped] = useState('');
  const others = value.interests.filter(
    (interest) => !(INTEREST_CHIPS as readonly string[]).includes(interest),
  );
  const options = [
    ...INTEREST_CHIPS.map((interest) => ({
      value: interest as string,
      label: tClinic(CLINIC_KEYS.leads.interests[interest]),
      tone: LEAD_INTEREST_TONES[interest] as Tone,
    })),
    ...value.customInterests.map((label) => ({
      value: `${CUSTOM_PREFIX}${label}`,
      label,
      tone: toneForLabel(label),
    })),
  ];
  const picks = [
    ...value.interests.filter((interest) =>
      (INTEREST_CHIPS as readonly string[]).includes(interest),
    ),
    ...value.customInterests.map((label) => `${CUSTOM_PREFIX}${label}`),
  ];
  const add = () => {
    const label = typed.trim().slice(0, CUSTOM_INTEREST_MAX);
    setTyped('');
    if (!label) return;
    const key = label.toLowerCase();
    const known = INTEREST_CHIPS.find(
      (interest) =>
        interest === key ||
        tClinic(CLINIC_KEYS.leads.interests[interest]).toLowerCase() === key,
    );
    if (known) {
      if (!value.interests.includes(known)) {
        onChange({ ...value, interests: [...value.interests, known] });
      }
      return;
    }
    if (value.customInterests.some((custom) => custom.toLowerCase() === key)) return;
    onChange({ ...value, customInterests: [...value.customInterests, label] });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    } else if (event.key === 'Escape' && typed) {
      event.stopPropagation();
      setTyped('');
    }
  };
  return (
    <LeadField label={t(LEADS_KEYS.drawer.interests)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <DrawerChips
          multiple
          label={t(LEADS_KEYS.drawer.interests)}
          options={options}
          value={picks}
          onChange={(next) => {
            onChange({
              interests: [
                ...others,
                ...next.filter(
                  (pick): pick is LeadInterest => !pick.startsWith(CUSTOM_PREFIX),
                ),
              ],
              customInterests: next
                .filter((pick) => pick.startsWith(CUSTOM_PREFIX))
                .map((pick) => pick.slice(CUSTOM_PREFIX.length)),
            });
          }}
        />
        <div
          data-slot="pill"
          className="text-muted-foreground bg-card border-border-strong inline-flex h-6 cursor-text items-center gap-1.5 rounded-full border border-dashed ps-2.5 pe-1.5"
        >
          <Plus aria-hidden="true" className="size-3 flex-none" />
          <input
            value={typed}
            maxLength={CUSTOM_INTEREST_MAX}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={add}
            placeholder={t(LEADS_KEYS.drawer.addInterest)}
            aria-label={t(LEADS_KEYS.drawer.addInterest)}
            className="text-foreground placeholder:text-muted-foreground h-full w-22.5 bg-transparent text-xs outline-none"
          />
        </div>
      </div>
    </LeadField>
  );
}

/** The track's tiles in each step's tone, as literals (`bg-tone-${tone}` is never generated). */
const TRACK_TONES: Readonly<
  Record<(typeof MAIN_STATUSES)[number], { next: string; bar: string }>
> = {
  new: { next: 'bg-tone-sky/30', bar: 'bg-tone-sky' },
  contacted: { next: 'bg-tone-lav/30', bar: 'bg-tone-lav' },
  follow_up: { next: 'bg-tone-butter/30', bar: 'bg-tone-butter' },
  clinic_visited: { next: 'bg-tone-sage/30', bar: 'bg-tone-sage' },
};

/**
 * Progress (`leads.md:284`, H:1809–1811): the 4-tile track New · Contacted ·
 * Follow-up · Clinic visited — done tiles in the tone's ink with a check,
 * the current one tinted with a ringed dot, the next ones at 30% with a dashed
 * number — then "Close as" No response · Not interested · Invalid · Lost. Any
 * status may follow any (Q-L4).
 */
export function LeadProgressField({
  status,
  onChange,
}: {
  status: LeadStatus | null;
  onChange: (status: LeadStatus) => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const at =
    status === null ? -1 : (MAIN_STATUSES as readonly LeadStatus[]).indexOf(status);
  const label = (value: LeadStatus) => tClinic(CLINIC_KEYS.leads.statuses[value]);
  return (
    <section
      aria-label={t(LEADS_KEYS.drawer.progressAria)}
      data-slot="surface"
      className="bg-card flex-none overflow-hidden rounded-xl border"
    >
      <div className="flex items-stretch border-b">
        {MAIN_STATUSES.map((step, index) => {
          const tone = TONE_OF[step];
          const done = at > index;
          const current = at === index;
          const name = label(step);
          let tip = t(LEADS_KEYS.drawer.stepTips.next, { status: name });
          if (done) tip = t(LEADS_KEYS.drawer.stepTips.done, { status: name });
          else if (current) tip = t(LEADS_KEYS.drawer.stepTips.current, { status: name });
          let stepLabel = t(LEADS_KEYS.drawer.steps.next);
          if (done) stepLabel = t(LEADS_KEYS.drawer.steps.done);
          else if (current) stepLabel = t(LEADS_KEYS.drawer.steps.current);
          return (
            <button
              key={step}
              type="button"
              title={tip}
              aria-pressed={current}
              onClick={() => onChange(step)}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-start gap-2 border-e px-3 pt-3 pb-2.5 text-start transition-colors last:border-e-0',
                done && TONE_CLASSES[tone].fill,
                current && TONE_CLASSES[tone].surface,
                !(done || current) && cn(TRACK_TONES[step].next, TONE_CLASSES[tone].ink),
              )}
            >
              <span className="flex max-w-full min-w-0 items-center gap-1.5">
                <StepMark done={done} current={current} number={index + 1} tone={tone} />
                <span className="text-tiny font-medium tracking-[0.02em] whitespace-nowrap">
                  {stepLabel}
                </span>
              </span>
              <span
                className={cn(
                  'text-body leading-tight [overflow-wrap:anywhere]',
                  current ? 'font-semibold' : 'font-medium',
                )}
              >
                {name}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-0 bottom-0 h-0.75',
                  TRACK_TONES[step].bar,
                )}
              >
                <span
                  className={cn(
                    'block h-full',
                    TONE_CLASSES[tone].dot,
                    done && 'w-full',
                    current && 'w-1/2',
                    !(done || current) && 'w-0',
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
        <span className="text-caption text-muted-foreground">
          {t(LEADS_KEYS.drawer.closeAs)}
        </span>
        <DrawerChips
          label={t(LEADS_KEYS.drawer.closeAs)}
          options={CLOSING_STATUSES.map((value) => ({
            value,
            label: label(value),
            tone: LEAD_STATUS_TONES[value],
          }))}
          value={
            (CLOSING_STATUSES as readonly LeadStatus[]).includes(status ?? 'new')
              ? (status as (typeof CLOSING_STATUSES)[number])
              : null
          }
          onChange={(value) => {
            if (value) onChange(value);
          }}
        />
      </div>
    </section>
  );
}

const TONE_OF = LEAD_STATUS_TONES;

/** The track's dot-coloured edges (the ringed dot, the dashed number), as literals. */
const TONE_BORDERS: Readonly<Partial<Record<Tone, string>>> = {
  sky: 'border-tone-sky-dot',
  lav: 'border-tone-lav-dot',
  butter: 'border-tone-butter-dot',
  sage: 'border-tone-sage-dot',
};

/** The tile's 18px mark: a check disc, the ringed dot, or the dashed number. */
function StepMark({
  done,
  current,
  number,
  tone,
}: {
  done: boolean;
  current: boolean;
  number: number;
  tone: Tone;
}) {
  if (done) {
    return (
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'bg-background flex size-4.5 flex-none items-center justify-center rounded-full',
          TONE_CLASSES[tone].ink,
        )}
      >
        <Check className="size-3" />
      </span>
    );
  }
  if (current) {
    return (
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'bg-background flex size-4.5 flex-none items-center justify-center rounded-full border-2',
          TONE_CLASSES[tone].halo,
          TONE_BORDERS[tone],
        )}
      >
        <span className={cn('size-2 rounded-full', TONE_CLASSES[tone].dot)} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-slot="pill"
      className={cn(
        'bg-background text-tiny flex size-4.5 flex-none items-center justify-center rounded-full border-[1.5px] border-dashed font-semibold tabular-nums',
        TONE_BORDERS[tone],
      )}
    >
      {number}
    </span>
  );
}
