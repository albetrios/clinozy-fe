import type { Manufacturer, MedicalRep, Supplier } from '@/shared/api/app/app-schema.ts';
import type { MedicineRecord } from '@/shared/api/app/medicines-contracts.ts';
import {
  type StackedRequests,
  useStackedRequest,
} from '@/shared/hooks/useStackedDrawer/index.ts';

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
export type MedicalStack = StackedRequests<MedicalStackRequest, MedicalStackRecord>;

/**
 * The Medical drawers' stacked child (KICKOFF §6.7 Stacked child drawers;
 * `S:116` — component state, no URL), on the shared {@link useStackedRequest}:
 * one child at a time over the open drawer — a manufacturer, supplier, MR or
 * medicine — named from the picker's text; its save selects the new record in
 * the field that asked.
 */
export function useMedicalStack(): MedicalStack {
  return useStackedRequest<MedicalStackRequest, MedicalStackRecord>();
}
