/**
 * The URL-driven dialog routes (D24) — every drawer, viewer and preview a URL
 * opens over its page — as ONE module that `routeTree.tsx` imports lazily.
 *
 * A dialog route renders nothing of its own: the page under it reads the URL
 * and opens the drawer. What the route itself needs is its manifest (the
 * gate's policy and the document title) and its component, and `routeTree.tsx`
 * is the entry chunk — carried there, the manifests and a lazy import each cost
 * every first paint, for drawers most loads never open. Here they load the
 * first time a dialog route is entered, or hovered (`dialogRoute` in
 * `routeTree.tsx`, which awaits the manifest before the gate). The patient
 * file's dialogs are not here: they inherit the file's gate and
 * ride its own lazy module (`patient-id.sections.ts`).
 *
 * A drawer another room opened ({@link handOverToReferrer}, A-P1) leaves its
 * route for that room's, the drawer named in the room's search and the URL
 * bar keeping the drawer's route.
 */
import {
  type ParsedLocation,
  redirect,
  type RouteComponent,
} from '@tanstack/react-router';

import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import { manifest as appointmentManifest } from '@/pages/organization/$organizationSlug/appointments/$appointmentId/appointment-id.manifest.ts';
import { Component as AppointmentRoute } from '@/pages/organization/$organizationSlug/appointments/$appointmentId/appointment-id.route.tsx';
import { manifest as appointmentCreateManifest } from '@/pages/organization/$organizationSlug/appointments/create/create.manifest.ts';
import { Component as AppointmentCreateRoute } from '@/pages/organization/$organizationSlug/appointments/create/create.route.tsx';
import { manifest as invoiceEditManifest } from '@/pages/organization/$organizationSlug/invoices/$invoiceId/edit/edit.manifest.ts';
import { Component as InvoiceEditRoute } from '@/pages/organization/$organizationSlug/invoices/$invoiceId/edit/edit.route.tsx';
import { manifest as invoiceManifest } from '@/pages/organization/$organizationSlug/invoices/$invoiceId/invoice-id.manifest.ts';
import { Component as InvoiceRoute } from '@/pages/organization/$organizationSlug/invoices/$invoiceId/invoice-id.route.tsx';
import { manifest as invoiceCreateManifest } from '@/pages/organization/$organizationSlug/invoices/create/create.manifest.ts';
import { Component as InvoiceCreateRoute } from '@/pages/organization/$organizationSlug/invoices/create/create.route.tsx';
import { manifest as leadManifest } from '@/pages/organization/$organizationSlug/leads/$leadId/lead-id.manifest.ts';
import { Component as LeadRoute } from '@/pages/organization/$organizationSlug/leads/$leadId/lead-id.route.tsx';
import { manifest as leadCreateManifest } from '@/pages/organization/$organizationSlug/leads/create/create.manifest.ts';
import { Component as LeadCreateRoute } from '@/pages/organization/$organizationSlug/leads/create/create.route.tsx';
import { manifest as manufacturerEditManifest } from '@/pages/organization/$organizationSlug/medical/manufacturers/$manufacturerId/edit/edit.manifest.ts';
import { Component as ManufacturerEditRoute } from '@/pages/organization/$organizationSlug/medical/manufacturers/$manufacturerId/edit/edit.route.tsx';
import { manifest as manufacturerCreateManifest } from '@/pages/organization/$organizationSlug/medical/manufacturers/create/create.manifest.ts';
import { Component as ManufacturerCreateRoute } from '@/pages/organization/$organizationSlug/medical/manufacturers/create/create.route.tsx';
import { manifest as medicineEditManifest } from '@/pages/organization/$organizationSlug/medical/medicines/$medicineId/edit/edit.manifest.ts';
import { Component as MedicineEditRoute } from '@/pages/organization/$organizationSlug/medical/medicines/$medicineId/edit/edit.route.tsx';
import { manifest as medicineCreateManifest } from '@/pages/organization/$organizationSlug/medical/medicines/create/create.manifest.ts';
import { Component as MedicineCreateRoute } from '@/pages/organization/$organizationSlug/medical/medicines/create/create.route.tsx';
import { manifest as mrEditManifest } from '@/pages/organization/$organizationSlug/medical/mrs/$mrId/edit/edit.manifest.ts';
import { Component as MrEditRoute } from '@/pages/organization/$organizationSlug/medical/mrs/$mrId/edit/edit.route.tsx';
import { manifest as mrVisitCreateManifest } from '@/pages/organization/$organizationSlug/medical/mrs/$mrId/visits/create/create.manifest.ts';
import { Component as MrVisitCreateRoute } from '@/pages/organization/$organizationSlug/medical/mrs/$mrId/visits/create/create.route.tsx';
import { manifest as mrCreateManifest } from '@/pages/organization/$organizationSlug/medical/mrs/create/create.manifest.ts';
import { Component as MrCreateRoute } from '@/pages/organization/$organizationSlug/medical/mrs/create/create.route.tsx';
import { manifest as purchaseOrderEditManifest } from '@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/edit/edit.manifest.ts';
import { Component as PurchaseOrderEditRoute } from '@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/edit/edit.route.tsx';
import { manifest as purchaseOrderManifest } from '@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/purchase-order-id.manifest.ts';
import { Component as PurchaseOrderRoute } from '@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/purchase-order-id.route.tsx';
import { manifest as purchaseOrderReceiveManifest } from '@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/receive/receive.manifest.ts';
import { Component as PurchaseOrderReceiveRoute } from '@/pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/receive/receive.route.tsx';
import { manifest as purchaseOrderCreateManifest } from '@/pages/organization/$organizationSlug/medical/purchases/create/create.manifest.ts';
import { Component as PurchaseOrderCreateRoute } from '@/pages/organization/$organizationSlug/medical/purchases/create/create.route.tsx';
import { manifest as saleReturnManifest } from '@/pages/organization/$organizationSlug/medical/sales/$saleId/return/return.manifest.ts';
import { Component as SaleReturnRoute } from '@/pages/organization/$organizationSlug/medical/sales/$saleId/return/return.route.tsx';
import { manifest as saleManifest } from '@/pages/organization/$organizationSlug/medical/sales/$saleId/sale-id.manifest.ts';
import { Component as SaleRoute } from '@/pages/organization/$organizationSlug/medical/sales/$saleId/sale-id.route.tsx';
import { manifest as saleCreateManifest } from '@/pages/organization/$organizationSlug/medical/sales/create/create.manifest.ts';
import { Component as SaleCreateRoute } from '@/pages/organization/$organizationSlug/medical/sales/create/create.route.tsx';
import { manifest as supplierEditManifest } from '@/pages/organization/$organizationSlug/medical/suppliers/$supplierId/edit/edit.manifest.ts';
import { Component as SupplierEditRoute } from '@/pages/organization/$organizationSlug/medical/suppliers/$supplierId/edit/edit.route.tsx';
import { manifest as supplierCreateManifest } from '@/pages/organization/$organizationSlug/medical/suppliers/create/create.manifest.ts';
import { Component as SupplierCreateRoute } from '@/pages/organization/$organizationSlug/medical/suppliers/create/create.route.tsx';
import { manifest as offeringEditManifest } from '@/pages/organization/$organizationSlug/offerings/$offeringId/edit/edit.manifest.ts';
import { Component as OfferingEditRoute } from '@/pages/organization/$organizationSlug/offerings/$offeringId/edit/edit.route.tsx';
import { manifest as offeringCreateManifest } from '@/pages/organization/$organizationSlug/offerings/create/create.manifest.ts';
import { Component as OfferingCreateRoute } from '@/pages/organization/$organizationSlug/offerings/create/create.route.tsx';
import { manifest as offerEditManifest } from '@/pages/organization/$organizationSlug/offerings/offers/$offerId/edit/edit.manifest.ts';
import { Component as OfferEditRoute } from '@/pages/organization/$organizationSlug/offerings/offers/$offerId/edit/edit.route.tsx';
import { manifest as offerCreateManifest } from '@/pages/organization/$organizationSlug/offerings/offers/create/create.manifest.ts';
import { Component as OfferCreateRoute } from '@/pages/organization/$organizationSlug/offerings/offers/create/create.route.tsx';
import { manifest as patientCreateManifest } from '@/pages/organization/$organizationSlug/patients/create/create.manifest.ts';
import { Component as PatientCreateRoute } from '@/pages/organization/$organizationSlug/patients/create/create.route.tsx';
import { manifest as paymentEditManifest } from '@/pages/organization/$organizationSlug/payments/$paymentId/edit/edit.manifest.ts';
import { Component as PaymentEditRoute } from '@/pages/organization/$organizationSlug/payments/$paymentId/edit/edit.route.tsx';
import { manifest as dayCloseManifest } from '@/pages/organization/$organizationSlug/payments/day-close/day-close.manifest.ts';
import { Component as DayCloseRoute } from '@/pages/organization/$organizationSlug/payments/day-close/day-close.route.tsx';
import { manifest as payManifest } from '@/pages/organization/$organizationSlug/payments/pay/pay.manifest.ts';
import { Component as PaymentPayRoute } from '@/pages/organization/$organizationSlug/payments/pay/pay.route.tsx';
import { manifest as creditEditManifest } from '@/pages/organization/$organizationSlug/payments/pending/$creditId/edit/edit.manifest.ts';
import { Component as CreditEditRoute } from '@/pages/organization/$organizationSlug/payments/pending/$creditId/edit/edit.route.tsx';
import { manifest as pendingCreateManifest } from '@/pages/organization/$organizationSlug/payments/pending/create/create.manifest.ts';
import { Component as PendingCreateRoute } from '@/pages/organization/$organizationSlug/payments/pending/create/create.route.tsx';
import { manifest as receiveManifest } from '@/pages/organization/$organizationSlug/payments/receive/receive.manifest.ts';
import { Component as PaymentReceiveRoute } from '@/pages/organization/$organizationSlug/payments/receive/receive.route.tsx';
import { manifest as stockItemEditManifest } from '@/pages/organization/$organizationSlug/stock/items/$itemId/edit/edit.manifest.ts';
import { Component as StockItemEditRoute } from '@/pages/organization/$organizationSlug/stock/items/$itemId/edit/edit.route.tsx';
import { manifest as stockCheckManifest } from '@/pages/organization/$organizationSlug/stock/items/check/check.manifest.ts';
import { Component as StockCheckRoute } from '@/pages/organization/$organizationSlug/stock/items/check/check.route.tsx';
import { manifest as stockItemCreateManifest } from '@/pages/organization/$organizationSlug/stock/items/create/create.manifest.ts';
import { Component as StockItemCreateRoute } from '@/pages/organization/$organizationSlug/stock/items/create/create.route.tsx';
import { manifest as stockPurchaseEditManifest } from '@/pages/organization/$organizationSlug/stock/purchases/$purchaseId/edit/edit.manifest.ts';
import { Component as StockPurchaseEditRoute } from '@/pages/organization/$organizationSlug/stock/purchases/$purchaseId/edit/edit.route.tsx';
import { manifest as stockPurchaseCreateManifest } from '@/pages/organization/$organizationSlug/stock/purchases/create/create.manifest.ts';
import { Component as StockPurchaseCreateRoute } from '@/pages/organization/$organizationSlug/stock/purchases/create/create.route.tsx';
import { manifest as stockVendorEditManifest } from '@/pages/organization/$organizationSlug/stock/vendors/$vendorId/edit/edit.manifest.ts';
import { Component as StockVendorEditRoute } from '@/pages/organization/$organizationSlug/stock/vendors/$vendorId/edit/edit.route.tsx';
import { manifest as stockVendorCreateManifest } from '@/pages/organization/$organizationSlug/stock/vendors/create/create.manifest.ts';
import { Component as StockVendorCreateRoute } from '@/pages/organization/$organizationSlug/stock/vendors/create/create.route.tsx';
import { manifest as taskManifest } from '@/pages/organization/$organizationSlug/tasks/$taskId/task-id.manifest.ts';
import { Component as TaskRoute } from '@/pages/organization/$organizationSlug/tasks/$taskId/task-id.route.tsx';
import { manifest as taskCreateManifest } from '@/pages/organization/$organizationSlug/tasks/create/create.manifest.ts';
import { Component as TaskCreateRoute } from '@/pages/organization/$organizationSlug/tasks/create/create.route.tsx';
import { manifest as userEditManifest } from '@/pages/organization/$organizationSlug/users/$userId/edit/edit.manifest.ts';
import { Component as UserEditRoute } from '@/pages/organization/$organizationSlug/users/$userId/edit/edit.route.tsx';
import { manifest as branchEditManifest } from '@/pages/organization/$organizationSlug/users/branches/$branchId/edit/edit.manifest.ts';
import { Component as BranchEditRoute } from '@/pages/organization/$organizationSlug/users/branches/$branchId/edit/edit.route.tsx';
import { manifest as branchCreateManifest } from '@/pages/organization/$organizationSlug/users/branches/create/create.manifest.ts';
import { Component as BranchCreateRoute } from '@/pages/organization/$organizationSlug/users/branches/create/create.route.tsx';
import { manifest as userCreateManifest } from '@/pages/organization/$organizationSlug/users/create/create.manifest.ts';
import { Component as UserCreateRoute } from '@/pages/organization/$organizationSlug/users/create/create.route.tsx';
import { crossRoomNavigation } from '@/shared/app/app-referrer.ts';

/** A dialog route's lazily loaded half: the manifest its gate and title read, and its component. */
export interface DialogRoute {
  manifest: PageManifest;
  /** Renders nothing of its own — or only its child dialog's outlet. */
  Component: RouteComponent;
}

/** Every manifest-backed dialog route, by the name `dialogRoute(name)` in `routeTree.tsx` registers it under. */
export const DIALOG_ROUTES = {
  leadCreate: { manifest: leadCreateManifest, Component: LeadCreateRoute },
  lead: { manifest: leadManifest, Component: LeadRoute },
  appointmentCreate: {
    manifest: appointmentCreateManifest,
    Component: AppointmentCreateRoute,
  },
  appointment: { manifest: appointmentManifest, Component: AppointmentRoute },
  patientCreate: { manifest: patientCreateManifest, Component: PatientCreateRoute },
  paymentReceive: { manifest: receiveManifest, Component: PaymentReceiveRoute },
  paymentPay: { manifest: payManifest, Component: PaymentPayRoute },
  paymentEdit: { manifest: paymentEditManifest, Component: PaymentEditRoute },
  dayClose: { manifest: dayCloseManifest, Component: DayCloseRoute },
  pendingCreate: { manifest: pendingCreateManifest, Component: PendingCreateRoute },
  creditEdit: { manifest: creditEditManifest, Component: CreditEditRoute },
  invoiceCreate: { manifest: invoiceCreateManifest, Component: InvoiceCreateRoute },
  invoice: { manifest: invoiceManifest, Component: InvoiceRoute },
  invoiceEdit: { manifest: invoiceEditManifest, Component: InvoiceEditRoute },
  taskCreate: { manifest: taskCreateManifest, Component: TaskCreateRoute },
  task: { manifest: taskManifest, Component: TaskRoute },
  offeringCreate: { manifest: offeringCreateManifest, Component: OfferingCreateRoute },
  offeringEdit: { manifest: offeringEditManifest, Component: OfferingEditRoute },
  offerCreate: { manifest: offerCreateManifest, Component: OfferCreateRoute },
  offerEdit: { manifest: offerEditManifest, Component: OfferEditRoute },
  userCreate: { manifest: userCreateManifest, Component: UserCreateRoute },
  userEdit: { manifest: userEditManifest, Component: UserEditRoute },
  usersBranchCreate: { manifest: branchCreateManifest, Component: BranchCreateRoute },
  usersBranchEdit: { manifest: branchEditManifest, Component: BranchEditRoute },
  saleCreate: { manifest: saleCreateManifest, Component: SaleCreateRoute },
  sale: { manifest: saleManifest, Component: SaleRoute },
  saleReturn: { manifest: saleReturnManifest, Component: SaleReturnRoute },
  medicineCreate: { manifest: medicineCreateManifest, Component: MedicineCreateRoute },
  medicineEdit: { manifest: medicineEditManifest, Component: MedicineEditRoute },
  purchaseOrderCreate: {
    manifest: purchaseOrderCreateManifest,
    Component: PurchaseOrderCreateRoute,
  },
  purchaseOrder: { manifest: purchaseOrderManifest, Component: PurchaseOrderRoute },
  purchaseOrderEdit: {
    manifest: purchaseOrderEditManifest,
    Component: PurchaseOrderEditRoute,
  },
  purchaseOrderReceive: {
    manifest: purchaseOrderReceiveManifest,
    Component: PurchaseOrderReceiveRoute,
  },
  supplierCreate: { manifest: supplierCreateManifest, Component: SupplierCreateRoute },
  supplierEdit: { manifest: supplierEditManifest, Component: SupplierEditRoute },
  manufacturerCreate: {
    manifest: manufacturerCreateManifest,
    Component: ManufacturerCreateRoute,
  },
  manufacturerEdit: {
    manifest: manufacturerEditManifest,
    Component: ManufacturerEditRoute,
  },
  mrCreate: { manifest: mrCreateManifest, Component: MrCreateRoute },
  mrEdit: { manifest: mrEditManifest, Component: MrEditRoute },
  mrVisitCreate: { manifest: mrVisitCreateManifest, Component: MrVisitCreateRoute },
  stockItemCreate: { manifest: stockItemCreateManifest, Component: StockItemCreateRoute },
  stockItemEdit: { manifest: stockItemEditManifest, Component: StockItemEditRoute },
  stockCheck: { manifest: stockCheckManifest, Component: StockCheckRoute },
  stockPurchaseCreate: {
    manifest: stockPurchaseCreateManifest,
    Component: StockPurchaseCreateRoute,
  },
  stockPurchaseEdit: {
    manifest: stockPurchaseEditManifest,
    Component: StockPurchaseEditRoute,
  },
  stockVendorCreate: {
    manifest: stockVendorCreateManifest,
    Component: StockVendorCreateRoute,
  },
  stockVendorEdit: { manifest: stockVendorEditManifest, Component: StockVendorEditRoute },
} satisfies Record<string, DialogRoute>;

/**
 * A drawer another room owns, entered on its own route with a `from` naming
 * an allowed room other than its own (KICKOFF §4, A-P1) — a shared link, a
 * stale tab, a link that skipped `useAppNavigate` — goes to that room
 * instead: the room's page with the drawer named in its search, masked as the
 * drawer's own route, so the room stands behind the drawer, its guards run,
 * and the URL bar still shows the link. `dialogRoute(name)` in
 * `routeTree.tsx` calls it once the drawer's own gate has passed; any other
 * dialog route stays where it is.
 */
export function handOverToReferrer(location: ParsedLocation): void {
  const over = crossRoomNavigation(location);
  if (!over) return;
  throw redirect({
    href: over.href,
    // The router builds a mask from an href too; its type spells only `to`.
    mask: over.mask as Parameters<typeof redirect>[0]['mask'],
    replace: true,
    resetScroll: false,
  });
}
