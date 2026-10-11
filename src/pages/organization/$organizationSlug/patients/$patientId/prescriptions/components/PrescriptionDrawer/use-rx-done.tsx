import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';
import { appCommandNavigation } from '@/shared/app/app-command-targets.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';

/**
 * A new Rx written in the visit flow is the visit's: tied to its booking (Today's pharmacy lane
 * joins the approved Rx by `appointment_id`) and printed once approved. An edit, or a drawer
 * outside the flow, is neither.
 */
export function rxVisitMode(
  visit: { appointmentId: string | null } | undefined,
  prescription: PrescriptionRecord | null,
): { atVisit: boolean; appointmentId: string | null } {
  if (!visit || prescription) return { atVisit: false, appointmentId: null };
  return { atVisit: true, appointmentId: visit.appointmentId };
}

/**
 * The save button's words (Q19): an approver's "Save & approve" — "Approve · print · send to
 * pharmacy" for a new Rx at the visit — else "Save changes" on an edit, "Save prescription" on a
 * new one (a draft).
 */
export function rxSaveLabelKey({
  editing,
  approves,
  atVisit,
}: {
  editing: boolean;
  approves: boolean;
  atVisit: boolean;
}): string {
  if (approves) return atVisit && !editing ? RX_KEYS.save.visit : RX_KEYS.save.approve;
  return editing ? RX_KEYS.save.edit : RX_KEYS.save.create;
}

/**
 * What a landed save does: "Prescription #500 approved" when it was approved, else
 * "Prescription saved" (or "#500 saved" on an edit); at the visit an approved Rx prints on A4
 * (the Visit sheet's Approve, L-64); then the drawer closes — or, after "Save & sell", a new
 * medical sale opens from the approved Rx, closing back to `sellFrom` (§4): the visit flow when
 * the drawer came from it, else the patient's prescriptions.
 */
export function useRxDone({
  editing,
  atVisit,
  onWritten,
  sellFrom,
  print,
  onClose,
}: {
  editing: boolean;
  atVisit: boolean;
  /** A new Rx at the visit landed: move the visit on (Q8). */
  onWritten?: () => void;
  /** The room the sale "Save & sell" opens closes back to (`from`). */
  sellFrom: string;
  print: (rx: PrescriptionRecord) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation(RX_NS);
  const navigate = useAppNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  return (saved: PrescriptionRecord, sell: boolean) => {
    const number = displayId.prescription(saved.seq);
    const approved = saved.status === 'approved';
    let message = t(RX_KEYS.save.saved);
    if (approved) message = t(RX_KEYS.save.approvedNumber, { number });
    else if (editing) message = t(RX_KEYS.save.savedNumber, { number });
    notify.success(message);
    onWritten?.();
    if (atVisit && approved) void print(saved);
    if (!sell) {
      onClose();
      return;
    }
    void navigate(
      appCommandNavigation('newSale', {
        organizationSlug,
        referrer: sellFrom,
        search: { prescription: saved.id },
      }),
    );
  };
}
