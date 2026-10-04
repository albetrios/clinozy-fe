import { useState } from 'react';

import type {
  Manufacturer,
  MedicalRep,
  Supplier,
} from '@/shared/api/clinic/clinic-schema.ts';
import type { MedicineRecord } from '@/shared/api/clinic/medicines-contracts.ts';
import { useStackedDrawer } from '@/shared/hooks/useStackedDrawer/index.ts';

/**
 * A parent's "New <thing> · “q”" + "full details" (`medical.md:319, 343–355`):
 * which record opens on top, its name (the picker's text) and prefill, and
 * the field its save selects the new record in.
 */
export type MedicalStackRequest =
  | { kind: 'manufacturer'; query: string; onCreated: (record: Manufacturer) => void }
  | {
      kind: 'supplier';
      query: string;
      /** The makers it distributes from the start (the medicine's own). */
      manufacturerIds?: readonly string[];
      onCreated: (record: Supplier) => void;
    }
  | { kind: 'mr'; query: string; onCreated: (record: MedicalRep) => void }
  | { kind: 'medicine'; query: string; onCreated: (record: MedicineRecord) => void };

/** The records a Medical drawer can open on top of itself. */
export type MedicalStackKind = MedicalStackRequest['kind'];

/** What a stacked child saves. */
export type MedicalStackRecord = Manufacturer | Supplier | MedicalRep | MedicineRecord;

/** How a record drawer asks for a stacked child; without it the pickers offer no "full details". */
export type OpenMedicalChild = (request: MedicalStackRequest) => void;

/** What {@link useMedicalStack} hands the page that hosts the drawers. */
export interface MedicalStack {
  /** The child open on top, or `null`. */
  child: MedicalStackRequest | null;
  /**
   * The last child asked for, open or not — the host keeps its drawer mounted
   * closed, so the sheet closes the way every drawer does.
   */
  last: MedicalStackRequest | null;
  open: OpenMedicalChild;
  /** Back, ×, the backdrop or Esc: only the child closes, nothing is selected. */
  close: () => void;
  /** The child saved: it closes and its record lands in the parent's field. */
  complete: (record: MedicalStackRecord) => void;
}

/** Hand a saved record to the field that asked — the request names its kind. */
function deliver(request: MedicalStackRequest, record: MedicalStackRecord) {
  (request.onCreated as (saved: MedicalStackRecord) => void)(record);
}

/**
 * The Medical drawers' stacked child (KICKOFF §6.7 Stacked child drawers;
 * `S:116` — component state, no URL), on the shared {@link useStackedDrawer}:
 * one child at a time over the open drawer — a manufacturer, supplier, MR or
 * medicine — named from the picker's text; its save selects the new record in
 * the field that asked.
 */
export function useMedicalStack(): MedicalStack {
  const [request, setRequest] = useState<MedicalStackRequest | null>(null);
  const stacked = useStackedDrawer<MedicalStackRecord>((record) => {
    if (request) deliver(request, record);
  });
  return {
    child: stacked.isOpen ? request : null,
    last: request,
    open: (next) => {
      setRequest(next);
      stacked.open(next.query);
    },
    close: stacked.close,
    complete: stacked.complete,
  };
}
