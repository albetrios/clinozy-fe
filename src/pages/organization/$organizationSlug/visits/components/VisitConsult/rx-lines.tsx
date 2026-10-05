import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { PrescriptionItem } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { DrawerStepper } from '@/shared/components/DrawerField/index.ts';

import type { VisitDraftLine } from '../../store/useVisitDraftStore/index.ts';
import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';
import { doseText, hasDose, nextDose, RX_DOSE_SLOTS } from '../../visits.rx.ts';

const K = VISIT_KEYS.consult;
const ids = VISIT_TEST_IDS.consult;

/** The quantity a line takes (the Rx drawer's, `S:388`). */
const QTY_MAX = 999;

/** Each dose slot's word. */
const SLOT_KEYS = {
  doseMorning: K.doses.morning,
  doseAfternoon: K.doses.afternoon,
  doseNight: K.doses.night,
} as const;

/** "1-0-1 · qty 1", "SOS · qty 1", "Doctor to set · qty 1" — the line's sub-line. */
function useLineText() {
  const { t } = useTranslation(VISIT_NS);
  return (item: PrescriptionItem) => {
    const dose = doseText(item);
    let how = t(K.doctorToSet);
    if (dose) how = dose;
    else if (item.sos) how = t(K.sos);
    else if (item.timingText) how = item.timingText;
    return t(K.line, { dose: how, qty: item.qty });
  };
}

/**
 * The dose editor a "Doctor to set" line opens before it can be reviewed
 * (KICKOFF §6.13, AMBER): each slot's tap cycles 0 → 1 → 2, and the quantity.
 */
function DoseEditor({
  item,
  onChange,
  onDone,
}: {
  item: PrescriptionItem;
  onChange: (item: PrescriptionItem) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation(VISIT_NS);
  return (
    <div
      data-testid={ids.dose}
      className="col-span-3 flex flex-wrap items-center gap-2 border-t pt-2"
    >
      {RX_DOSE_SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onChange({ ...item, [slot]: nextDose(item[slot]) })}
          aria-label={`${t(SLOT_KEYS[slot])} ${item[slot]}`}
          data-slot="button"
          className="bg-card flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs"
        >
          {t(SLOT_KEYS[slot])}
          <span className="font-semibold tabular-nums">{item[slot]}</span>
        </button>
      ))}
      <DrawerStepper
        value={item.qty}
        min={1}
        max={QTY_MAX}
        label={t(K.qty)}
        aria-label={t(K.qty)}
        onValueChange={(qty) => onChange({ ...item, qty })}
        className="h-8 w-28"
      />
      <button
        type="button"
        onClick={onDone}
        disabled={!hasDose(item)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-lg px-3 text-xs font-medium disabled:opacity-55"
      >
        {t(K.done)}
      </button>
    </div>
  );
}

/** Props of {@link RxLines}. */
export interface RxLinesProps {
  lines: readonly VisitDraftLine[];
  onChange: (lines: VisitDraftLine[]) => void;
  /** Approved: the lines show without their actions. */
  readOnly: boolean;
}

/**
 * The Rx lines (KICKOFF §6.13; `today.md:86`; H:2559–2570): "No medicines yet…"
 * when there are none; each line its number, the medicine over "<dose> · qty
 * <n>", the review pill ("Review" blush ↔ "✓ Reviewed" sage) and "Remove". A
 * line with no dose reads "Doctor to set" and opens its dose editor before it
 * can be reviewed.
 */
export function RxLines({ lines, onChange, readOnly }: RxLinesProps) {
  const { t } = useTranslation(VISIT_NS);
  const lineText = useLineText();
  const [editing, setEditing] = useState<string | null>(null);
  const set = (key: string, change: Partial<VisitDraftLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...change } : line)));

  if (lines.length === 0) {
    return (
      <p className="text-detail text-muted-foreground-strong rounded-lg border border-dashed p-3.5 leading-[1.5]">
        {t(K.empty)}
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {lines.map((line, index) => {
        const settable = !hasDose(line.item);
        const tone = TONE_CLASSES[line.reviewed ? 'sage' : 'blush'];
        return (
          <li
            key={line.key}
            data-testid={ids.line}
            data-reviewed={line.reviewed}
            className="bg-canvas grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2 rounded-lg border px-2.5 py-2"
          >
            <span className="text-muted-foreground-strong text-xs tabular-nums">
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-body font-medium break-words">
                {line.item.medicineName}
              </span>
              <span className="text-muted-foreground-strong text-xs">
                {lineText(line.item)}
              </span>
            </span>
            {readOnly ? (
              <span className="text-tone-sage-foreground text-xs">{t(K.reviewed)}</span>
            ) : (
              <span className="flex flex-wrap justify-end gap-1">
                {settable ? (
                  <button
                    type="button"
                    aria-expanded={editing === line.key}
                    onClick={() => setEditing(editing === line.key ? null : line.key)}
                    data-testid={ids.review}
                    data-slot="pill"
                    className={cn(
                      'rounded-full border px-2.25 py-0.75 text-xs',
                      TONE_CLASSES.blush.surface,
                      TONE_CLASSES.blush.border,
                    )}
                  >
                    {t(K.setDose)}
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-pressed={line.reviewed}
                    onClick={() => set(line.key, { reviewed: !line.reviewed })}
                    data-testid={ids.review}
                    data-slot="pill"
                    className={cn(
                      'rounded-full border px-2.25 py-0.75 text-xs',
                      tone.surface,
                      tone.border,
                    )}
                  >
                    {t(line.reviewed ? K.reviewed : K.review)}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={t(K.removeLine, { name: line.item.medicineName })}
                  title={t(K.remove)}
                  onClick={() =>
                    onChange(lines.filter((other) => other.key !== line.key))
                  }
                  data-testid={ids.remove}
                  className="text-muted-foreground-strong hover:bg-muted rounded-lg border bg-transparent px-1.75 py-0.75 text-xs"
                >
                  {t(K.remove)}
                </button>
              </span>
            )}
            {editing === line.key && !readOnly ? (
              <DoseEditor
                item={line.item}
                onChange={(item) => set(line.key, { item, reviewed: false })}
                onDone={() => setEditing(null)}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
