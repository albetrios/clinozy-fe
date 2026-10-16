import { type ReactNode, type RefObject, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import type {
  PrescriptionRecord,
  RxCatalog,
} from '@/shared/api/app/prescriptions-contracts.ts';
import type { ItemsRowContext } from '@/shared/forms/ItemsField/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useViewportWidth } from '@/shared/hooks/useViewportWidth/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import { type RxAllergyMatch, rxAllergyMatches } from './rx-allergy.ts';
import { RxAllergyBand } from './rx-allergy-band.tsx';
import { rxComposerColumns } from './rx-composer-columns.ts';
import {
  emptyRxLine,
  type RxFormLine,
  type RxFormValues,
  withRxLine,
} from './rx-form.ts';
import type { RxPadRefs, RxPadState } from './rx-medicines-field.tsx';
import { RxRowAllergy } from './rx-row-allergy.tsx';
import { RxSidekick } from './rx-sidekick.tsx';
import { previousRxOf, rxChangesSince } from './rx-since-last.ts';
import { useRxLabels } from './use-rx-labels.ts';

/** The drawer's composer: the Pad, the sidekick, the band, the row warnings and the save. */
export interface RxComposer {
  pad: RxPadState;
  /** The open Pad's root and its toggle: Esc closes the Pad and gives the toggle the focus. */
  padRefs: RxPadRefs;
  /** The quick line's input. */
  quickLineRef: RefObject<HTMLInputElement | null>;
  /** What takes the focus on open: the quick line for a new prescription on Medicines (D9). */
  initialFocusRef: RefObject<HTMLInputElement | null> | undefined;
  /** The quick line takes the focus on open. */
  focusesLine: boolean;
  matches: RxAllergyMatch[];
  /** The allergy band under the header; undefined without allergies on file. */
  band: ReactNode | undefined;
  /** The sidekick column from `xl`. */
  aside: { content: ReactNode; width: number } | undefined;
  /** The drawer's width with the column; undefined below `xl` (the drawer's own 1040). */
  panelWidth: number | undefined;
  /** The folded sidekick card above the steps, below `xl`. */
  card: ReactNode;
  /** The allergy warning under a matching row (change-prescription-writing D7). */
  rowFooter: (row: ItemsRowContext<RxFormValues, 'items'>) => ReactNode;
  /** The save — held, and pointed at the row, while a warning is not yet answered (D7). */
  save: (sell: boolean) => void;
  /** The drawer's Esc: an open Pad holding the focus closes first. */
  onEscapeKeyDown: (event: KeyboardEvent) => void;
}

/** A Keep is remembered by the medicine's name: a changed medicine is warned again. */
const keepKey = (name: string) => name.trim().toLowerCase();

/**
 * The allergy answers (D7): Keep per medicine name, Remove drops the line, and
 * a held save that brings the first unanswered warning into view — its focus
 * asked for once, so a warning added later never takes it unasked.
 */
function useRxAllergyAnswers({
  form,
  matches,
  writable,
  quickLineRef,
}: {
  form: UseFormReturn<RxFormValues>;
  matches: readonly RxAllergyMatch[];
  writable: boolean;
  quickLineRef: RefObject<HTMLInputElement | null>;
}) {
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  // A held save rings the first unanswered warning from then on, and asks for the focus once.
  const [held, setHeld] = useState(false);
  const [focusPending, setFocusPending] = useState(false);
  const unanswered = writable
    ? matches.filter((match) => !kept.has(keepKey(match.medicineName)))
    : [];
  const keep = (name: string, next: boolean) =>
    setKept((current) => {
      const updated = new Set(current);
      if (next) updated.add(keepKey(name));
      else updated.delete(keepKey(name));
      return updated;
    });
  const remove = (index: number) => {
    const items = form.getValues('items').filter((_, position) => position !== index);
    form.setValue('items', items.length > 0 ? items : [emptyRxLine()], {
      shouldDirty: true,
    });
    quickLineRef.current?.focus();
  };
  const rowFooter = (row: ItemsRowContext<RxFormValues, 'items'>) => {
    const match = matches.find((candidate) => candidate.index === row.index);
    if (!match) return null;
    const first = unanswered[0]?.index === match.index;
    return (
      <RxRowAllergy
        match={match}
        kept={kept.has(keepKey(match.medicineName))}
        readOnly={!writable}
        emphasized={held && first}
        focusNow={focusPending && first}
        onFocused={() => setFocusPending(false)}
        onKeep={(next) => keep(match.medicineName, next)}
        onRemove={() => remove(match.index)}
      />
    );
  };
  return {
    unanswered,
    rowFooter,
    hold: () => {
      setHeld(true);
      setFocusPending(true);
    },
  };
}

/**
 * The prescription composer's state and parts (feat-prescription-composer
 * KICKOFF §6.4–§6.5; change-prescription-writing §6.2–§6.3): the Rx Pad's
 * open state and its Esc; the allergy matches against the patient's own list,
 * the band and each matching row's warning, with Keep and Remove; the save,
 * held while a warning is not answered — Medicines opens, the warning comes
 * into view and takes the focus; the changes since the previous prescription,
 * with "Continue", and the earlier prescriptions, with Add; and where the
 * sidekick sits — the drawer's column from `xl`, a folded card below.
 */
export function useRxComposer({
  form,
  items,
  record,
  history,
  catalog,
  allergies,
  writable,
  focusLine,
  openMedicines,
  save,
}: {
  form: UseFormReturn<RxFormValues>;
  /** The form's lines as they stand. */
  items: readonly RxFormLine[];
  /** The prescription the drawer holds; null for a new one. */
  record: PrescriptionRecord | null;
  /** The patient's prescriptions, newest first. */
  history: readonly PrescriptionRecord[];
  catalog: RxCatalog | undefined;
  allergies: readonly string[] | null;
  /** The drawer saves (a new one, or a draft an approver changes). */
  writable: boolean;
  /** The quick line takes the focus on open — a new prescription opening on Medicines. */
  focusLine: boolean;
  /** Opens the Medicines step — a held save shows its warning there. */
  openMedicines: () => void;
  save: (sell: boolean) => void;
}): RxComposer {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const [padOpen, setPadOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const quickLineRef = useRef<HTMLInputElement>(null);
  const desktop = useViewportTier() === 'desktop';
  const columns = rxComposerColumns(useViewportWidth());

  const matches = rxAllergyMatches(items, catalog?.medicines ?? [], allergies);
  const changes = rxChangesSince(items, previousRxOf(history, record), labels.dayWords);
  const answers = useRxAllergyAnswers({ form, matches, writable, quickLineRef });

  const addLines = (lines: readonly RxFormLine[]) => {
    if (lines.length === 0) return;
    form.setValue(
      'items',
      lines.reduce((current, line) => withRxLine(current, line), form.getValues('items')),
      { shouldDirty: true },
    );
  };
  const onContinue = (line: RxFormLine) => {
    addLines([line]);
    notify.success(
      t(RX_KEYS.sidekick.continued, isolateValues({ name: line.medicineName })),
    );
  };
  const onAddEarlier = (lines: readonly RxFormLine[]) => {
    addLines(lines);
    const [only] = lines;
    notify.success(
      lines.length === 1 && only
        ? t(RX_KEYS.quick.added, isolateValues({ name: only.medicineName }))
        : t(RX_KEYS.pad.added, { count: lines.length }),
    );
  };
  const sidekick = (layout: 'column' | 'card') => (
    <RxSidekick
      allergies={allergies}
      matches={matches}
      changes={changes}
      earlier={history.filter((prescription) => prescription.id !== record?.id)}
      lines={items}
      readOnly={!writable}
      onContinue={onContinue}
      onAddEarlier={onAddEarlier}
      layout={layout}
    />
  );

  return {
    pad: { open: padOpen, onOpenChange: setPadOpen },
    padRefs: { panelRef, toggleRef },
    quickLineRef,
    initialFocusRef: focusLine && writable ? quickLineRef : undefined,
    focusesLine: focusLine && writable,
    matches,
    band:
      allergies && allergies.length > 0 ? (
        <RxAllergyBand allergies={allergies} matches={matches} />
      ) : undefined,
    aside: desktop ? { content: sidekick('column'), width: columns.aside } : undefined,
    panelWidth: desktop ? columns.panel : undefined,
    card: desktop ? null : sidekick('card'),
    rowFooter: answers.rowFooter,
    save: (sell) => {
      const [first] = answers.unanswered;
      if (!first) {
        save(sell);
        return;
      }
      // A warning not yet answered holds the save (D7): no dialog — the row's own warning.
      openMedicines();
      answers.hold();
      notify.warning(
        t(RX_KEYS.rowAllergy.held, isolateValues({ medicine: first.medicineName })),
        { id: 'rx-allergy-held' },
      );
    },
    onEscapeKeyDown: (event) => {
      if (padOpen && panelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        setPadOpen(false);
        toggleRef.current?.focus();
      }
    },
  };
}
