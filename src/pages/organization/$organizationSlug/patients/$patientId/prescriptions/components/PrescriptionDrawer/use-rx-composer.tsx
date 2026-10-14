import { type ReactNode, type RefObject, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import type {
  PrescriptionRecord,
  RxCatalog,
} from '@/shared/api/app/prescriptions-contracts.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useViewportWidth } from '@/shared/hooks/useViewportWidth/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import { type RxAllergyMatch, rxAllergyMatches } from './rx-allergy.ts';
import { RxAllergyBand } from './rx-allergy-band.tsx';
import { RxAllergyConfirm } from './rx-allergy-confirm.tsx';
import { rxComposerColumns } from './rx-composer-columns.ts';
import { type RxFormLine, type RxFormValues, withRxLine } from './rx-form.ts';
import type { RxPadRefs, RxPadState } from './rx-medicines-field.tsx';
import { RxSidekick } from './rx-sidekick.tsx';
import { previousRxOf, rxChangesSince } from './rx-since-last.ts';

/** The drawer's composer: the Pad, the sidekick, the band and the guarded save. */
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
  /** The save, through the allergy confirm when a line matches (D8). */
  save: (sell: boolean) => void;
  /** The confirm itself, rendered beside the drawer — none on a drawer that cannot save. */
  confirm: ReactNode;
  /** The drawer's Esc: an open Pad holding the focus closes first. */
  onEscapeKeyDown: (event: KeyboardEvent) => void;
}

/**
 * The prescription composer's state and parts (feat-prescription-composer
 * KICKOFF §6.4–§6.5): the Rx Pad's open state and its Esc; the allergy
 * matches against the patient's own list, the band and the save's confirm;
 * the changes since the previous prescription, with "Continue"; and where the
 * sidekick sits — the drawer's 320px column from `xl` (the drawer grows to
 * `min(1360, 100vw − 56)` so the form keeps its width), a folded card below.
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
  save: (sell: boolean) => void;
}): RxComposer {
  const { t } = useTranslation(RX_NS);
  const [padOpen, setPadOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const quickLineRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<{ sell: boolean } | null>(null);
  const desktop = useViewportTier() === 'desktop';
  const columns = rxComposerColumns(useViewportWidth());

  const matches = rxAllergyMatches(items, catalog?.medicines ?? [], allergies);
  const changes = rxChangesSince(items, previousRxOf(history, record));
  const asksFirst = writable && matches.length > 0;

  const onContinue = (line: RxFormLine) => {
    form.setValue('items', withRxLine(form.getValues('items'), line), {
      shouldDirty: true,
    });
    notify.success(
      t(RX_KEYS.sidekick.continued, isolateValues({ name: line.medicineName })),
    );
  };
  const sidekick = (layout: 'column' | 'card') => (
    <RxSidekick
      allergies={allergies}
      matches={matches}
      changes={changes}
      lines={items}
      readOnly={!writable}
      onContinue={onContinue}
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
    // A line that matches an allergy asks first (D8); a read-only drawer never saves.
    save: asksFirst ? (sell) => setConfirming({ sell }) : save,
    confirm: writable ? (
      <RxAllergyConfirm
        open={confirming !== null}
        matches={matches}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const sell = confirming?.sell ?? false;
          setConfirming(null);
          save(sell);
        }}
      />
    ) : null,
    onEscapeKeyDown: (event) => {
      if (padOpen && panelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        setPadOpen(false);
        toggleRef.current?.focus();
      }
    },
  };
}
