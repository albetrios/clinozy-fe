import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { Check, ChevronDown, Lock } from '@/shared/icons/index.ts';

import type { DrawerStepStatus } from './drawer-step-status.ts';

const CIRCLE_CLASS: Record<Exclude<DrawerStepStatus, 'open'>, string> = {
  missing: 'bg-destructive text-destructive-foreground',
  done: 'bg-success text-success-foreground',
  later: 'bg-border text-muted-foreground-strong',
};

/** Props of {@link DrawerStepCircle}. */
export interface DrawerStepCircleProps {
  status: DrawerStepStatus;
  number: number;
  /** The room's section tone — the open step's circle takes its ink. */
  tone: Tone;
  locked?: boolean;
}

/**
 * A step's 24px number circle, the same in every drawer: open — the section
 * tone's ink with its number; done — green "✓"; missing a required field — red
 * "!"; later — grey with its number; locked — grey with a lock.
 */
export function DrawerStepCircle({
  status,
  number,
  tone,
  locked,
}: DrawerStepCircleProps) {
  let mark: ReactNode = number;
  let fill: string;
  if (status === 'open') fill = TONE_CLASSES[tone].fill;
  else if (locked) {
    // Locked: the later grey with a fainter mark (H:4135, z200 / z400).
    fill = 'bg-border text-disabled';
    mark = <Lock className="size-3" />;
  } else fill = CIRCLE_CLASS[status];
  if (!locked && status === 'missing') mark = '!';
  else if (!locked && status === 'done') mark = <Check className="size-3" />;
  return (
    <span
      aria-hidden="true"
      data-slot="pill"
      className={cn(
        'text-micro flex size-6 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums transition-colors',
        fill,
      )}
    >
      {mark}
    </span>
  );
}

/** Props of {@link DrawerStepHeadText}. */
export interface DrawerStepHeadTextProps {
  title: string;
  status: DrawerStepStatus;
  number: number;
  total: number;
  locked?: boolean;
  /** The sub line — shown on a collapsed step only. */
  line?: string;
  /** The line names missing required fields: it reads in the destructive ink. */
  lineMissing?: boolean;
  /** "Edit", "Open" or the locked step's own words — collapsed only. */
  hint?: string;
  /** The chevron: off on a locked step and on an open step that cannot fold away. */
  chevron?: boolean;
}

/**
 * The words of a step head: the title, the collapsed step's one sub line, the
 * hint and the chevron that turns as the step opens — plus, for a screen
 * reader, where the step stands ("Step 2 of 3 · Complete"), which the circle
 * only shows in colour.
 */
export function DrawerStepHeadText({
  title,
  status,
  number,
  total,
  locked,
  line,
  lineMissing,
  hint,
  chevron = true,
}: DrawerStepHeadTextProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const open = status === 'open';
  const state = locked ? 'locked' : status;
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
        <span className="text-field text-foreground font-semibold">{title}</span>
        <span className="sr-only">
          {t(RECORD_DRAWER_KEYS.step.position, { number, total })} ·{' '}
          {t(RECORD_DRAWER_KEYS.step.state[state])}
        </span>
        {!open && line ? (
          <span
            className={cn(
              'truncate text-xs font-normal',
              lineMissing ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {line}
          </span>
        ) : null}
      </span>
      {!open && hint ? (
        <span className="text-muted-foreground shrink-0 text-xs font-normal">{hint}</span>
      ) : null}
      {chevron && !locked ? (
        <ChevronDown
          aria-hidden="true"
          data-slot="step-chevron"
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      ) : null}
    </>
  );
}
