import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  useDeleteOffering,
  useRestoreOffering,
} from '@/shared/hooks/useOfferings/index.ts';
import { useDeleteOffer, useRestoreOffer } from '@/shared/hooks/useOffers/index.ts';

import {
  CATALOGUE_DELETE_KEYS,
  CATALOGUE_DELETE_NS,
} from './catalogue-delete-confirm.constants.ts';

/** The record a delete confirm is about: an offering, or an offer. */
export type CatalogueDeleteTarget =
  | {
      kind: 'offering';
      id: string;
      /** Its display id — "Offering #272 removed". */
      offeringNumber: number;
      /**
       * The grey pill under the title: the name from a row, the drawer's
       * summary line from a drawer.
       */
      record: string;
    }
  | {
      kind: 'offer';
      id: string;
      /** Its name — "Navratri glow removed". */
      name: string;
      /** The grey pill: the offer's name (§7.3 — never the row's first cell). */
      record: string;
    };

/** Props of {@link CatalogueDeleteConfirm}. */
export interface CatalogueDeleteConfirmProps {
  /** The record to delete; the confirm is open while one is set. */
  target: CatalogueDeleteTarget | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing after the write. */
  onClose: () => void;
  /** Runs once the record is removed (a drawer closes itself). */
  onDeleted?: () => void;
}

/**
 * Delete an offering or an offer (KICKOFF §6.11 Delete confirm;
 * `offerings.md:205–219`): the shared reason confirm — a panel at the inline
 * end from `md`, a bottom sheet below — titled "Delete this offering?" /
 * "Delete this offer?", the record in a grey pill, the schema's
 * `delete_reason` chips. The delete is optimistic (the row leaves at once) and
 * answers nothing (204); "Offering #272 removed" / "Navratri glow removed"
 * offers Undo for 10s, which restores it with the Undo's own idempotency key
 * (D32, `POST …/restore`).
 */
export function CatalogueDeleteConfirm({
  target,
  onClose,
  onDeleted,
}: CatalogueDeleteConfirmProps) {
  const { t } = useTranslation(CATALOGUE_DELETE_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const removeOffering = useDeleteOffering();
  const restoreOffering = useRestoreOffering();
  const removeOffer = useDeleteOffer();
  const restoreOffer = useRestoreOffer();

  const removed = (record: CatalogueDeleteTarget) =>
    record.kind === 'offering'
      ? tApp(APP_KEYS.offerings.toasts.offeringRemoved, {
          id: displayId.offering(record.offeringNumber),
        })
      : tApp(APP_KEYS.offerings.toasts.offerRemoved, { name: record.name });

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(
        target?.kind === 'offer'
          ? CATALOGUE_DELETE_KEYS.offerTitle
          : CATALOGUE_DELETE_KEYS.offeringTitle,
      )}
      reason={{
        record: target?.record,
        undo: target
          ? {
              message: removed(target),
              onUndo: () =>
                target.kind === 'offering'
                  ? restoreOffering.mutateAsync(target.id)
                  : restoreOffer.mutateAsync(target.id),
            }
          : undefined,
      }}
      onConfirm={async ({ reason, note }) => {
        if (!target) return;
        const vars = { id: target.id, reason, note };
        if (target.kind === 'offering') await removeOffering.mutateAsync(vars);
        else await removeOffer.mutateAsync(vars);
        onDeleted?.();
      }}
    />
  );
}
