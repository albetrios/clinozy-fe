import { useNavigate, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';

import {
  type MedicalTab,
  organizationManufacturerEdit,
  organizationMedicalCreate,
  organizationMedicalSale,
  organizationMedicalSaleReturn,
  organizationMedicalTab,
  organizationMedicineEdit,
  organizationMrEdit,
  organizationMrVisitCreate,
  organizationPurchaseOrder,
  organizationPurchaseOrderEdit,
  organizationPurchaseOrderReceive,
  organizationSupplierEdit,
} from '@/lib/routes/index.ts';
import { safeReferrer } from '@/shared/clinic/clinic-referrer.ts';

import {
  type MedicalCreateSearch,
  validateMedicalSearch,
} from '../../../medical.search.ts';

/** A Medical tab with a create dialog route. */
export type MedicalCreateTab = Exclude<MedicalTab, 'payments'>;

/** The list params a dialog route keeps from its tab: the search, filters and sort. */
const listSearch = (current: Record<string, unknown>) => validateMedicalSearch(current);

/**
 * The Medical family's navigation (KICKOFF §4, D24): each create, view and edit
 * dialog route over its own tab — a create from another tab opens over the
 * tab it belongs to (a standing deviation, §6.7) — keeping the tab's list
 * params, and the close back onto a tab with nothing of the drawer's, or onto
 * the room a drawer was opened from.
 */
export function useMedicalNav() {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });

  return useMemo(() => {
    const slug = organizationSlug;
    /** Back to a tab's list, keeping its search, filters and sort. */
    const close = (tab: MedicalTab) =>
      void navigate({
        ...organizationMedicalTab(slug, tab),
        search: listSearch,
        hash: true,
        replace: true,
      });
    return {
      organizationSlug: slug,
      close,
      /**
       * Back to the room a drawer opened from — `from` when the referrer
       * allow-list has it (Today's Dispense sends `from=today`; KICKOFF §4,
       * AMBER A-P1) — else to the tab's list.
       */
      closeTo: (tab: MedicalTab, from: string | undefined) => {
        const room = safeReferrer(from, '');
        if (!room || room === `medical/${tab}`) {
          close(tab);
          return;
        }
        void navigate({ href: `/organization/${slug}/${room}`, replace: true });
      },
      /** Another tab, fresh. */
      tab: (tab: MedicalTab) => void navigate(organizationMedicalTab(slug, tab)),
      /** A create drawer over its own tab, with its prefill. */
      create: (tab: MedicalCreateTab, search: MedicalCreateSearch = {}) =>
        void navigate({ ...organizationMedicalCreate(slug, tab), search }),
      sale: (saleId: string) =>
        void navigate({ ...organizationMedicalSale(slug, saleId), search: listSearch }),
      saleReturn: (saleId: string) =>
        void navigate({
          ...organizationMedicalSaleReturn(slug, saleId),
          search: listSearch,
        }),
      medicineEdit: (medicineId: string) =>
        void navigate({
          ...organizationMedicineEdit(slug, medicineId),
          search: listSearch,
        }),
      /** An order's view; `replace` when it stands in for a route the order's stage has left. */
      purchaseOrder: (id: string, replace = false) =>
        void navigate({
          ...organizationPurchaseOrder(slug, id),
          search: listSearch,
          replace,
        }),
      purchaseOrderEdit: (id: string) =>
        void navigate({ ...organizationPurchaseOrderEdit(slug, id), search: listSearch }),
      purchaseOrderReceive: (id: string) =>
        void navigate({
          ...organizationPurchaseOrderReceive(slug, id),
          search: listSearch,
        }),
      supplierEdit: (id: string) =>
        void navigate({ ...organizationSupplierEdit(slug, id), search: listSearch }),
      manufacturerEdit: (id: string) =>
        void navigate({ ...organizationManufacturerEdit(slug, id), search: listSearch }),
      mrEdit: (id: string) =>
        void navigate({ ...organizationMrEdit(slug, id), search: listSearch }),
      mrVisit: (id: string) =>
        void navigate({ ...organizationMrVisitCreate(slug, id), search: listSearch }),
    };
  }, [navigate, organizationSlug]);
}
