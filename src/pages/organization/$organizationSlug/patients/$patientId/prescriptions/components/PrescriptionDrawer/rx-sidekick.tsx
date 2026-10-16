import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { occurrenceKeys } from '@/lib/occurrence-keys.ts';
import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { localDateOf } from '@/shared/api/app/app-time.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
} from '@/shared/icons/index.ts';

import { useStaffMember } from '../../../shared/components/PatientStaffPicker/index.ts';
import {
  RX_KEYS,
  RX_NS,
  RX_STATUS_TONES,
  RX_TEST_IDS,
} from '../../prescriptions.constants.ts';
import type { RxAllergyMatch } from './rx-allergy.ts';
import { namedRxLines, type RxFormLine, rxFormLineOf } from './rx-form.ts';
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
  /**
   * The patient's other prescriptions, newest first — the one being edited
   * left out (change-prescription-writing D8).
   */
  earlier: readonly PrescriptionRecord[];
  /** The form's lines as they stand. */
  lines: readonly RxFormLine[];
  /** An approved prescription reads only: no Continue, no Add. */
  readOnly: boolean;
  /** "Continue": the stopped medicine's last line, back into the form. */
  onContinue: (line: RxFormLine) => void;
  /** "+ Add" and "Add all": an earlier prescription's lines, into the form. */
  onAddEarlier: (lines: readonly RxFormLine[]) => void;
  /** The drawer's column from `xl`, or the folded card above the steps below it. */
  layout: 'column' | 'card';
}

/** One section: its small-caps heading, then its body. */
function SidekickSection({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: ReactNode;
  /** Beside the heading, outside it: the earlier prescriptions' pager. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      data-testid={`${ID}-${id}`}
      className="flex flex-col gap-2"
    >
      <div className="flex min-h-6 items-center gap-2">
        <h3
          id={headingId}
          className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase"
        >
          {title}
        </h3>
        {action}
      </div>
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

/** One earlier line: its name, its plain words, and + Add — or "In this Rx" when written. */
function EarlierLine({
  line,
  held,
  readOnly,
  onAdd,
}: {
  line: RxFormLine;
  held: boolean;
  readOnly: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation(RX_NS);
  const plainWords = useRxPlainWords();
  const words = plainWords(line);
  return (
    <li
      data-testid={`${ID}-earlier-line`}
      data-held={held}
      className="flex items-start gap-2 px-2.5 py-2"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-detail font-medium">{line.medicineName}</span>
        <span className="text-caption text-foreground-soft">{words.directions}</span>
        {words.note ? (
          <span className="rx-remark text-caption text-muted-foreground">
            {words.note}
          </span>
        ) : null}
      </span>
      {held ? (
        <span
          data-testid={`${ID}-earlier-held`}
          className="text-caption text-muted-foreground mt-0.5 flex flex-none items-center gap-1"
        >
          <Check aria-hidden="true" className="size-3" />
          {t(K.sidekick.earlier.inThisRx)}
        </span>
      ) : null}
      {held || readOnly ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t(
            K.sidekick.earlier.addLabel,
            isolateValues({ name: line.medicineName }),
          )}
          onClick={onAdd}
          data-testid={`${ID}-earlier-add`}
          className="rx-small-action h-7 flex-none gap-1 px-2 text-xs shadow-none"
        >
          <Plus aria-hidden="true" className="size-3" />
          {t(K.sidekick.earlier.add)}
        </Button>
      )}
    </li>
  );
}

/** The earlier prescription's header: its number, day, doctor and status. */
function EarlierHeading({ prescription }: { prescription: PrescriptionRecord }) {
  const { t } = useTranslation(RX_NS);
  const { formatDate } = useLocaleFormat();
  const { shortName } = useStaffMember(prescription.doctorId);
  const day = formatDate(
    localDateOf(prescription.date),
    { day: 'numeric', month: 'short', year: 'numeric' },
    { civilDay: true },
  );
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        data-testid={`${ID}-earlier-number`}
        className="text-detail font-semibold tabular-nums"
      >
        {displayId.prescription(prescription.seq)}
      </span>
      <span className="text-caption text-muted-foreground tabular-nums">{day}</span>
      {shortName ? (
        <span className="text-caption text-muted-foreground truncate">{shortName}</span>
      ) : null}
      <TonePill tone={RX_STATUS_TONES[prescription.status]} size="xs" className="ms-auto">
        {t(K.status[prescription.status])}
      </TonePill>
    </div>
  );
}

/** ‹ newer · "2 of 5" · older ›, over the patient's other prescriptions. */
function EarlierPager({
  index,
  count,
  onMove,
}: {
  index: number;
  count: number;
  onMove: (index: number) => void;
}) {
  const { t } = useTranslation(RX_NS);
  if (count < 2) return null;
  return (
    <span className="ms-auto flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={index === 0}
        aria-label={t(K.sidekick.earlier.newer)}
        title={t(K.sidekick.earlier.newer)}
        onClick={() => onMove(index - 1)}
        data-testid={`${ID}-earlier-newer`}
        className="rx-icon-action"
      >
        <ChevronLeft aria-hidden="true" className="size-3.5 rtl:rotate-180" />
      </Button>
      <span
        aria-live="polite"
        className="text-caption text-muted-foreground tabular-nums"
      >
        {t(K.sidekick.earlier.position, { index: index + 1, count })}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={index >= count - 1}
        aria-label={t(K.sidekick.earlier.older)}
        title={t(K.sidekick.earlier.older)}
        onClick={() => onMove(index + 1)}
        data-testid={`${ID}-earlier-older`}
        className="rx-icon-action"
      >
        <ChevronRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
      </Button>
    </span>
  );
}

/**
 * "Earlier prescriptions" (change-prescription-writing D8): one of the
 * patient's other prescriptions at a time, newest first — its number, day,
 * doctor and status, its lines in plain words with "+ Add" (or "In this Rx"
 * when the form holds the medicine), "Add N missing", and its advice.
 */
function EarlierSection({
  earlier,
  lines,
  readOnly,
  onAdd,
}: {
  earlier: readonly PrescriptionRecord[];
  lines: readonly RxFormLine[];
  readOnly: boolean;
  onAdd: (lines: readonly RxFormLine[]) => void;
}) {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const [position, setPosition] = useState(0);
  const index = Math.min(position, Math.max(0, earlier.length - 1));
  const prescription = earlier[index];
  const title = t(K.sidekick.earlier.title);
  const pager = (
    <EarlierPager index={index} count={earlier.length} onMove={setPosition} />
  );
  if (!prescription) {
    return (
      <SidekickSection id="earlier" title={title}>
        <p className="text-caption text-muted-foreground">{t(K.sidekick.earlier.none)}</p>
      </SidekickSection>
    );
  }
  const written = new Set(
    namedRxLines(lines).map((line) => line.medicineName.trim().toLowerCase()),
  );
  const isHeld = (line: RxFormLine) =>
    written.has(line.medicineName.trim().toLowerCase());
  const earlierLines = prescription.items.map((item) =>
    rxFormLineOf(item, labels.dayWords),
  );
  const missing = earlierLines.filter((line) => !isHeld(line));
  // A line is its medicine — "·2" for one written twice.
  const lineKeys = occurrenceKeys(earlierLines.map((line) => line.medicineName));
  return (
    <SidekickSection id="earlier" title={title} action={pager}>
      <div
        data-testid={`${ID}-earlier-card`}
        className="bg-background flex flex-col rounded-lg border"
      >
        <div className="border-b px-2.5 py-2">
          <EarlierHeading prescription={prescription} />
        </div>
        {earlierLines.length === 0 ? (
          <p className="text-caption text-muted-foreground px-2.5 py-2">
            {t(K.sidekick.earlier.noLines)}
          </p>
        ) : (
          <ol className="flex flex-col divide-y">
            {earlierLines.map((line, lineIndex) => (
              <EarlierLine
                key={lineKeys[lineIndex]}
                line={line}
                held={isHeld(line)}
                readOnly={readOnly}
                onAdd={() => onAdd([line])}
              />
            ))}
          </ol>
        )}
        {prescription.advice ? (
          <p className="text-caption text-muted-foreground border-t px-2.5 py-2">
            <span className="text-foreground-soft font-medium">
              {t(K.sidekick.earlier.advice)}
            </span>
            <span aria-hidden="true">: </span>
            {prescription.advice}
          </p>
        ) : null}
      </div>
      {!readOnly && missing.length > 1 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdd(missing)}
          data-testid={`${ID}-earlier-add-all`}
          className="rx-add-all gap-1.5 self-start shadow-none"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {t(K.sidekick.earlier.addAll, { count: missing.length })}
        </Button>
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
                    <span className="rx-remark text-caption text-muted-foreground">
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
 * (New · Changed · Unchanged · Stopped, with Continue), the patient's earlier
 * prescriptions one at a time with Add (change-prescription-writing D8), and
 * the lines in the patient's plain words. From `xl` the drawer's 320px column; below it one
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
      <EarlierSection
        earlier={props.earlier}
        lines={lines}
        readOnly={readOnly}
        onAdd={props.onAddEarlier}
      />
      <ReadsSection lines={lines} />
    </div>
  );

  if (layout === 'column') {
    return (
      <section
        aria-label={t(K.sidekick.label)}
        data-testid={ID}
        data-layout="column"
        className="bg-canvas flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
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
      className={cn('bg-card rounded-xl border', alert && 'border-destructive-border')}
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
            'text-muted-foreground size-4 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? <div className="border-t px-3.5 py-3.5">{body}</div> : null}
    </section>
  );
}
