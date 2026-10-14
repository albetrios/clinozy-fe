import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { occurrenceKeys } from '@/lib/occurrence-keys.ts';
import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { localDateOf } from '@/shared/api/app/app-time.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  ChevronDown,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
} from '@/shared/icons/index.ts';

import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';
import type { RxAllergyMatch } from './rx-allergy.ts';
import { namedRxLines, type RxFormLine } from './rx-form.ts';
import { type RxChange, rxChangeCounts, type RxChangesSince } from './rx-since-last.ts';
import { useRxLabels } from './use-rx-labels.ts';
import { useRxPlainWords } from './use-rx-plain.ts';

const K = RX_KEYS;
const ID = RX_TEST_IDS.sidekick;

/** Each change's pill: new sage, changed butter, stopped blush, unchanged slate. */
const CHANGE_TONES: Readonly<Record<RxChange['kind'], Tone>> = {
  new: 'sage',
  changed: 'butter',
  unchanged: 'slate',
  stopped: 'blush',
};

/** Props of {@link RxSidekick}. */
export interface RxSidekickProps {
  /** The patient's allergies; null when the member may not see them (no section). */
  allergies: readonly string[] | null;
  matches: readonly RxAllergyMatch[];
  /** The lines against the previous prescription; null for the patient's first. */
  changes: RxChangesSince | null;
  /** The form's lines as they stand. */
  lines: readonly RxFormLine[];
  /** An approved prescription reads only: no Continue. */
  readOnly: boolean;
  /** "Continue": the stopped medicine's last line, back into the form. */
  onContinue: (line: RxFormLine) => void;
  /** The drawer's column from `xl`, or the folded card above the steps below it. */
  layout: 'column' | 'card';
}

/** One section: its small-caps heading, then its body. */
function SidekickSection({
  id,
  title,
  children,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      data-testid={`${ID}-${id}`}
      className="flex flex-col gap-2"
    >
      <h3
        id={headingId}
        className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The allergies: each as a danger pill, the matching lines under them — or "No allergies recorded". */
function AllergiesSection({
  allergies,
  matches,
}: {
  allergies: readonly string[];
  matches: readonly RxAllergyMatch[];
}) {
  const { t } = useTranslation(RX_NS);
  return (
    <SidekickSection id="allergies" title={t(K.sidekick.allergies)}>
      {allergies.length === 0 ? (
        <p className="text-detail text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          {t(K.sidekick.noAllergies)}
        </p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {allergies.map((allergy) => (
              <li
                key={allergy}
                data-slot="pill"
                className="bg-destructive/10 text-destructive text-caption inline-flex h-6 items-center gap-1 rounded-full px-2.5 font-medium"
              >
                <TriangleAlert aria-hidden="true" className="size-3" />
                {allergy}
              </li>
            ))}
          </ul>
          {matches.map((match) => (
            <p
              key={`${match.index}:${match.medicineName}`}
              data-testid={`${ID}-allergy-match`}
              className="text-detail text-destructive font-medium"
            >
              {t(
                K.sidekick.matches,
                isolateValues({
                  medicine: match.medicineName,
                  allergies: match.allergies.join(', '),
                }),
              )}
            </p>
          ))}
        </>
      )}
    </SidekickSection>
  );
}

/** A line's directions and quantity in the row's own words: "0-0-1 · After meal · ×10". */
function useShortDirections() {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  return (line: RxFormLine) =>
    [labels.directions(line), t(K.quick.qty, { qty: line.qty }), line.remarks.trim()]
      .filter(Boolean)
      .join(' · ');
}

/** What moved: a changed line's "before → now", else the line's own directions. */
function changeDetail(
  change: Exclude<RxChange, { kind: 'unchanged' }>,
  short: (line: RxFormLine) => string,
): string {
  if (change.kind === 'changed') return `${short(change.before)} → ${short(change.now)}`;
  return short(change.kind === 'new' ? change.now : change.before);
}

/** One medicine's change: its pill, its name, what moved — and "Continue" when it stopped. */
function ChangeRow({
  change,
  readOnly,
  onContinue,
}: {
  change: Exclude<RxChange, { kind: 'unchanged' }>;
  readOnly: boolean;
  onContinue: (line: RxFormLine) => void;
}) {
  const { t } = useTranslation(RX_NS);
  const short = useShortDirections();
  const detail = changeDetail(change, short);
  return (
    <li
      data-testid={`${ID}-change`}
      data-kind={change.kind}
      className="flex items-start gap-2"
    >
      <span
        data-slot="pill"
        className={cn(
          TONE_CLASSES[CHANGE_TONES[change.kind]].surface,
          'text-micro mt-px inline-flex h-5 flex-none items-center rounded-full px-2 font-semibold',
        )}
      >
        {t(K.sidekick.kinds[change.kind])}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'text-detail truncate font-medium',
            change.kind === 'stopped' && 'text-muted-foreground line-through',
          )}
        >
          {change.name}
        </span>
        {detail ? (
          <span className="text-caption text-muted-foreground tabular-nums">
            {detail}
          </span>
        ) : null}
      </span>
      {change.kind === 'stopped' && !readOnly ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t(K.sidekick.continueLabel, isolateValues({ name: change.name }))}
          onClick={() => onContinue(change.before)}
          data-testid={`${ID}-continue`}
          className="h-7 flex-none gap-1 px-2 text-xs"
        >
          <RotateCw aria-hidden="true" className="size-3" />
          {t(K.sidekick.continue)}
        </Button>
      ) : null}
    </li>
  );
}

/** "Since Rx #12 · 30 Sep": each medicine's change, the unchanged counted — or the first prescription. */
function SinceLastSection({
  changes,
  readOnly,
  onContinue,
}: {
  changes: RxChangesSince | null;
  readOnly: boolean;
  onContinue: (line: RxFormLine) => void;
}) {
  const { t } = useTranslation(RX_NS);
  const { formatDate } = useLocaleFormat();
  if (!changes) {
    return (
      <SidekickSection id="since" title={t(K.sidekick.first)}>
        {null}
      </SidekickSection>
    );
  }
  const { previous } = changes;
  const title = t(
    K.sidekick.since,
    isolateValues({
      number: displayId.prescription(previous.seq),
      date: formatDate(
        localDateOf(previous.date),
        { day: 'numeric', month: 'short' },
        { civilDay: true },
      ),
    }),
  );
  const moved = changes.changes.filter(
    (change): change is Exclude<RxChange, { kind: 'unchanged' }> =>
      change.kind !== 'unchanged',
  );
  const unchanged = changes.changes.filter((change) => change.kind === 'unchanged');
  return (
    <SidekickSection id="since" title={title}>
      {moved.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {moved.map((change) => (
            <ChangeRow
              key={`${change.kind}:${change.name}`}
              change={change}
              readOnly={readOnly}
              onContinue={onContinue}
            />
          ))}
        </ul>
      ) : null}
      {unchanged.length > 0 ? (
        <p
          data-testid={`${ID}-unchanged`}
          title={unchanged.map((change) => change.name).join(', ')}
          className="text-caption text-muted-foreground"
        >
          {t(K.sidekick.unchangedCount, { value: unchanged.length })}
          {' · '}
          {unchanged.map((change) => change.name).join(', ')}
        </p>
      ) : null}
    </SidekickSection>
  );
}

/** "What the patient reads": each line in plain words, numbered as the sheet prints them. */
function ReadsSection({ lines }: { lines: readonly RxFormLine[] }) {
  const { t } = useTranslation(RX_NS);
  const plainWords = useRxPlainWords();
  const named = namedRxLines(lines);
  // A line is its medicine — "·2" for one written twice.
  const lineKeys = occurrenceKeys(named.map((line) => line.medicineName));
  return (
    <SidekickSection id="reads" title={t(K.sidekick.reads)}>
      {named.length === 0 ? (
        <p className="text-caption text-muted-foreground">{t(K.sidekick.readsEmpty)}</p>
      ) : (
        <ol className="bg-background flex flex-col divide-y rounded-lg border">
          {named.map((line, index) => {
            const words = plainWords(line);
            return (
              <li
                key={lineKeys[index]}
                data-testid={`${ID}-reads-line`}
                className="flex gap-2 px-2.5 py-2"
              >
                <span className="text-caption text-muted-foreground w-4 flex-none tabular-nums">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-detail font-medium">{line.medicineName}</span>
                  <span className="text-caption text-foreground-soft">
                    {words.directions}
                  </span>
                  {words.note ? (
                    <span className="text-caption text-muted-foreground italic">
                      {words.note}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </SidekickSection>
  );
}

/** The folded card's one line: "1 allergy match · 3 changes since Rx #12". */
function useSidekickSummary({
  matches,
  changes,
}: Pick<RxSidekickProps, 'matches' | 'changes'>) {
  const { t } = useTranslation(RX_NS);
  const parts: string[] = [];
  if (matches.length > 0)
    parts.push(t(K.sidekick.summary.allergy, { count: matches.length }));
  if (changes) {
    const counts = rxChangeCounts(changes.changes);
    const moved = counts.new + counts.changed + counts.stopped;
    const number = displayId.prescription(changes.previous.seq);
    parts.push(
      moved > 0
        ? t(K.sidekick.summary.changes, { count: moved, number })
        : t(K.sidekick.summary.noChanges, { number }),
    );
  } else {
    parts.push(t(K.sidekick.summary.first));
  }
  return parts.join(' · ');
}

/**
 * The Rx sidekick (feat-prescription-composer KICKOFF §6.5; `BRIEF.md:29–44`)
 * — the prescription checked as it is written: the patient's allergies and
 * the lines that match them, what changed since the previous prescription
 * (New · Changed · Unchanged · Stopped, with Continue), and the lines in the
 * patient's plain words. From `xl` the drawer's 320px column; below it one
 * card above the steps, folded to its summary line until opened.
 */
export function RxSidekick(props: RxSidekickProps) {
  const { allergies, matches, changes, lines, readOnly, onContinue, layout } = props;
  const { t } = useTranslation(RX_NS);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const summary = useSidekickSummary({ matches, changes });
  const body = (
    <div id={bodyId} className="flex flex-col gap-5">
      {allergies === null ? null : (
        <AllergiesSection allergies={allergies} matches={matches} />
      )}
      <SinceLastSection changes={changes} readOnly={readOnly} onContinue={onContinue} />
      <ReadsSection lines={lines} />
    </div>
  );

  if (layout === 'column') {
    return (
      <section
        aria-label={t(K.sidekick.label)}
        data-testid={ID}
        data-layout="column"
        className="bg-canvas flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5"
      >
        <h2 className="text-body font-semibold">{t(K.sidekick.label)}</h2>
        {body}
      </section>
    );
  }

  const alert = matches.length > 0;
  return (
    <section
      aria-label={t(K.sidekick.label)}
      data-testid={ID}
      data-layout="card"
      data-slot="card"
      className={cn('bg-card rounded-xl border', alert && 'border-destructive/40')}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={() => setOpen((current) => !current)}
        data-testid={`${ID}-toggle`}
        className="hover:bg-muted/50 flex min-h-11 w-full items-center gap-2 rounded-xl px-3.5 py-2 text-start"
      >
        {alert ? (
          <TriangleAlert
            aria-hidden="true"
            className="text-destructive size-4 flex-none"
          />
        ) : (
          <ShieldCheck aria-hidden="true" className="text-success size-4 flex-none" />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-detail font-semibold">{t(K.sidekick.label)}</span>
          <span
            data-testid={`${ID}-summary`}
            className={cn(
              'text-caption truncate',
              alert ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {summary}
          </span>
        </span>
        <span className="text-caption text-muted-foreground">
          {t(open ? K.sidekick.hide : K.sidekick.show)}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'text-muted-foreground size-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? <div className="border-t px-3.5 py-3.5">{body}</div> : null}
    </section>
  );
}
