import { useTranslation } from 'react-i18next';

import {
  InvoiceDrawer,
  type InvoiceSaleWrite,
} from '@/shared/components/InvoiceDrawer/index.ts';
import { useCrossRoomDialog } from '@/shared/hooks/useCrossRoomDialog/index.ts';

import { MEDICAL_NS } from '../../../medical.constants.ts';
import { useMedicalDialogRoute } from '../../../shared/hooks/useMedicalDialogRoute/index.ts';
import { useCreateSale } from '../../../shared/hooks/useMedicalFlows/index.ts';
import { useMedicalNav } from '../../../shared/hooks/useMedicalNav/index.ts';
import { fetchMedicalSale, medicalQueryKeys } from '../../../shared/medical-api.ts';
import type { SaleRow } from '../../../shared/medical-contracts.ts';
import { MEDICAL_DRAWER_KEYS } from '../../../shared/medical-drawers.constants.ts';
import { SaleDrawer } from '../SaleDrawer/index.ts';
import { SaleReturnDrawer } from '../SaleReturnDrawer/index.ts';

/**
 * New sale's write for the shared Invoice drawer: `POST /app/medical-sales` with
 * the drawer's sale — the buyer's contact, each medicine with its quantity and
 * discount, the overall discount, the team, the prescription, the remark and
 * "Paid now". The server draws the batches by earliest expiry and prices the
 * lines; no rate, free line or sale date is sent (MD19).
 */
function useSaleWrite(): InvoiceSaleWrite {
  const createSale = useCreateSale({ notifyOnError: false });
  return {
    create: async (input) => {
      const sale = await createSale.mutateAsync(input);
      return { invoiceId: sale.invoice?.id ?? sale.id, seq: sale.seq };
    },
  };
}

/** New sale's buyer from the URL's `customer`: a contact (`con_…`), or a patient's file (`pat_…`). */
function buyerPrefill(customer: string | undefined) {
  if (!customer) return {};
  return customer.startsWith('pat_') ? { patientId: customer } : { contactId: customer };
}

/**
 * The drawer the Sales URL names (D24): New sale — the shared Invoice drawer
 * with the type locked to Medical (`S:50`) and the room's write, on
 * `?prescription=&customer=` (the buyer's contact, or a patient's file),
 * closing back to `from` or the Sales list — the read-only Sale, or Return
 * from patient. Rendered by the
 * Sales page over its list, and by the app's cross-room host over the room
 * New sale was opened from — Today's Dispense, a prescription's "Sell
 * medicines" (A-P1) — which every way out returns to.
 */
export function SaleDrawers() {
  const { t } = useTranslation(MEDICAL_NS);
  const nav = useMedicalNav();
  const crossRoom = useCrossRoomDialog();
  const saleWrite = useSaleWrite();
  const { dialog, close } = useMedicalDialogRoute<SaleRow>({
    tab: 'sales',
    param: 'saleId',
    queryKey: medicalQueryKeys.sale,
    fetchRecord: fetchMedicalSale,
    recordLabel: t(MEDICAL_DRAWER_KEYS.records.sale),
  });

  if (dialog.kind === 'create') {
    const { prefill } = dialog;
    const back = crossRoom ? close : () => nav.closeTo('sales', prefill.from);
    return (
      <InvoiceDrawer
        mode="create"
        sale={saleWrite}
        open
        prefill={{
          prescriptionId: prefill.prescription ?? null,
          ...buyerPrefill(prefill.customer),
        }}
        onClose={back}
        onCreated={back}
      />
    );
  }
  if (dialog.kind !== 'record') return null;
  if (dialog.action === 'return') {
    return <SaleReturnDrawer open sale={dialog.record} onClose={close} />;
  }
  return (
    <SaleDrawer
      open
      sale={dialog.record}
      onClose={close}
      onReturn={(sale) => nav.saleReturn(sale.id)}
    />
  );
}
