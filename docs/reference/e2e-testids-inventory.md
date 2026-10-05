# E2E `data-testid` inventory

Living catalog of stable Playwright selectors. **When you add or rename a testid, update this file** (see `agent-os/skills/fe-e2e-testids/SKILL.md`).

**Gate:** `pnpm validate:testids` checks page manifests, forms, and shell surfaces against this contract (not every DOM node).

Convention: `page.getByTestId('…')` in `tests/e2e/`.

---

## Auth (`AuthLayout` + unified form)

| Test ID                                                                      | Element                          | File                                              |
| ---------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------- |
| `auth-layout`                                                                | Auth shell                       | `shared/layouts/AuthLayout/AuthLayout.tsx`        |
| `auth-form-container`                                                        | Form column                      | `shared/layouts/AuthLayout/AuthLayout.shared.tsx` |
| `auth-mobile-logo`                                                           | Mobile logo link                 | `shared/layouts/AuthLayout/AuthLayout.shared.tsx` |
| `login-page`                                                                 | Unified auth page root           | `pages/login/LoginPage.tsx`                       |
| `auth-form`                                                                  | Unified auth root                | `shared/forms/AuthForm/AuthForm.tsx`              |
| `auth-continue-google` / `auth-continue-github`                              | OAuth                            | AuthForm                                          |
| `auth-continue-passkey`                                                      | Passkey                          | AuthForm                                          |
| `auth-email-panel`                                                           | Email OTP panel                  | `AuthEmailPanel.tsx`                              |
| `auth-email` / `auth-email-submit` / `auth-email-code` / `auth-email-verify` | Email OTP flow                   | AuthEmailPanel                                    |
| `auth-email-resend` / `auth-email-resend-countdown` / `auth-email-change`    | Resend link, timer, change email | AuthEmailPanel                                    |
| `mfa-form` / `mfa-code` / `mfa-submit`                                       | MFA                              | `MfaForm.tsx`                                     |

**Hybrid helpers:** `tests/utils/e2e-hybrid.ts` — `expectAuthScreenReady`, `expectLoginFormReady`, `fillTestId`, `clickTestId`, label constants.

---

## App shell

| Test ID                          | Element                                                                                             | File                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `app-layout`                     | Authenticated shell                                                                                 | `AppLayout.tsx`                                               |
| `focus-shell`                    | Focus layout-variant shell                                                                          | `AppLayout/variants/AppLayoutFocus.tsx`                       |
| `sidebar`                        | Sidebar                                                                                             | AppLayout                                                     |
| `nav-dashboard`                  | Dashboard nav link (`nav-<id>` from the manifest's `nav.id`, `useAppNav`)                           | `AppLayout.shared.tsx` (sidebar + mobile)                     |
| `sidebar-quick-links`            | Persistent sidebar shortcuts group                                                                  | `AppLayout/components/SidebarQuickLinks/`                     |
| `sidebar-search`                 | Command palette from sidebar                                                                        | SidebarQuickLinks                                             |
| `sidebar-settings`               | Settings hash modal from sidebar                                                                    | SidebarQuickLinks                                             |
| `app-context-strip`              | Quick-access pill strip (settings sections + search)                                                | `AppLayout/components/AppContextStrip/`                       |
| `main-content`                   | Main content region (skip-link target)                                                              | `AppLayout.shared.tsx`                                        |
| `mobile-bottom-bar`              | Mobile nav bar                                                                                      | AppLayout                                                     |
| `header`                         | Top bar                                                                                             | AppLayout                                                     |
| `brand-logo`                     | Product mark (+ wordmark in the section bar)                                                        | `AppLayout.shared.tsx`                                        |
| `section-chip`                   | Phone header: the current room's name in its tone                                                   | `AppLayout/components/SectionChip/`                           |
| `all-sections-trigger`           | Section bar: All sections compass (tinted when the current room is unpinned)                        | `AppLayout/components/AllSections/`                           |
| `all-sections`                   | All sections popover (dialog)                                                                       | `AppLayout/components/AllSections/`                           |
| `all-sections-sheet`             | All sections bottom sheet (phone)                                                                   | `AppLayout/components/AllSections/`                           |
| `all-sections-<id>`              | All sections row link per room                                                                      | `AppLayout/components/AllSections/`                           |
| `all-sections-pin-<id>`          | Pin / unpin toggle per room                                                                         | `AppLayout/components/AllSections/`                           |
| `nav-more`                       | Section bar: "More" for folded pinned tabs                                                          | `AppLayout/components/PinnedTabs/`                            |
| `nav-more-<id>`                  | A folded pinned tab inside "More"                                                                   | `AppLayout/components/PinnedTabs/`                            |
| `nav-more-sections`              | Phone tab bar: "More" (opens All sections)                                                          | `AppLayout.shared.tsx (MobileNav)`                            |
| `branch-picker`                  | Header branch picker                                                                                | `AppLayout/components/BranchPicker/`                          |
| `branch-picker-all`              | Branch picker: All branches                                                                         | `AppLayout/components/BranchPicker/`                          |
| `branch-picker-<branchId>`       | Branch picker: one branch                                                                           | `AppLayout/components/BranchPicker/`                          |
| `account-menu`                   | Account menu (section bar)                                                                          | `AppLayout/components/AccountMenu/`                           |
| `account-menu-identity`          | Account menu identity block (opens profile)                                                         | `AppLayout/components/AccountMenu/`                           |
| `account-menu-status-<presence>` | Status radio pill (online · away · busy)                                                            | `AppLayout/components/AccountMenu/`                           |
| `account-menu-theme-<mode>`      | Appearance radio pill (light · dark · system)                                                       | `AppLayout/components/AccountMenu/`                           |
| `account-menu-notifications`     | Account menu: Notifications row                                                                     | `AppLayout/components/AccountMenu/`                           |
| `account-menu-security`          | Account menu: Security row                                                                          | `AppLayout/components/AccountMenu/`                           |
| `account-menu-billing`           | Account menu: Billing row                                                                           | `AppLayout/components/AccountMenu/`                           |
| `account-menu-devices`           | Account menu: Devices row                                                                           | `AppLayout/components/AccountMenu/`                           |
| `account-menu-shortcuts`         | Account menu: Keyboard shortcuts row                                                                | `AppLayout/components/AccountMenu/`                           |
| `view-as-bar`                    | View-as pill ("Previewing as <role>")                                                               | `AppLayout/components/NoticeStack/`                           |
| `view-as-exit`                   | View-as pill: Exit preview                                                                          | `AppLayout/components/NoticeStack/`                           |
| `upload-tray`                    | Upload tray (bottom inline-end; shown while files upload)                                           | `components/UploadTray/` (mounted by `AppLayout.tsx`)         |
| `upload-tray-status`             | Upload tray live status (always mounted, visually hidden)                                           | UploadTray                                                    |
| `upload-tray-toggle`             | Upload tray: collapse / expand the file list                                                        | UploadTray                                                    |
| `upload-tray-row`                | One file (`data-status`: queued, uploading, attaching, done, failed)                                | UploadTray                                                    |
| `upload-tray-retry`              | Failed file: Retry (resumes at the step that failed)                                                | UploadTray                                                    |
| `upload-tray-remove`             | Failed file: Remove                                                                                 | UploadTray                                                    |
| `today-page`                     | Clinic room page: Today                                                                             | `pages/organization/$organizationSlug/today/`                 |
| `leads-page`                     | Clinic room page: Leads                                                                             | `pages/organization/$organizationSlug/leads/`                 |
| `new-lead-drawer`                | New lead drawer — `/leads/create` opens it over the list (L-35)                                     | `pages/organization/$organizationSlug/leads/`                 |
| `lead-drawer`                    | Lead drawer — `/leads/$leadId` opens it over the list (L-34b)                                       | `pages/organization/$organizationSlug/leads/`                 |
| `leads-empty`                    | Leads list: "No leads match" (+ "Clear filters" / "New lead")                                       | `pages/organization/$organizationSlug/leads/`                 |
| `leads-claim`                    | Leads row: "Open to team · Claim / Join" (claims from the row)                                      | `leads/components/LeadsTable/`                                |
| `leads-hold-dot`                 | Leads row: the hold's release-today / tomorrow dot on the owner                                     | `leads/components/LeadsTable/`                                |
| `lead-drawer-chat`               | Lead drawer: the chat pane (the phone's Chat pane)                                                  | `leads/components/LeadDrawer/`                                |
| `lead-drawer-save`               | Lead drawer: "Save lead" (disabled until the draft changes)                                         | `leads/components/LeadDrawer/`                                |
| `lead-drawer-remove`             | Lead drawer: "Remove lead" (opens the reason confirm)                                               | `leads/components/LeadDrawer/`                                |
| `lead-drawer-people`             | Lead drawer: "Assigned & involved" (opens "People on this lead")                                    | `leads/components/LeadFormFields/`                            |
| `lead-drawer-resize`             | Lead drawer: the chat's resize handle (`role="separator"`)                                          | `leads/components/LeadDrawer/`                                |
| `new-lead-search`                | New lead: "Search by name or mobile" (the Contact step)                                             | `leads/components/NewLeadDrawer/`                             |
| `new-lead-preset-<id>`           | New lead: Quick start chip — `walkIn`, `phoneCall`, `instagramDm`                                   | `leads/components/NewLeadDrawer/`                             |
| `new-lead-hit-<kind>-<seq>`      | New lead: a search hit — `patient-3508` ("Re-create lead"), `lead-2365`                             | `leads/components/NewLeadDrawer/`                             |
| `new-lead-no-match`              | New lead: "No existing match"                                                                       | `leads/components/NewLeadDrawer/`                             |
| `new-lead-new-contact`           | New lead: "New contact" (opens the contact editor)                                                  | `leads/components/NewLeadDrawer/`                             |
| `new-lead-change`                | New lead: the person's strip — "Change"                                                             | `leads/components/NewLeadDrawer/`                             |
| `appointments-page`              | Clinic room page: Appointments                                                                      | `pages/organization/$organizationSlug/appointments/`          |
| `new-appointment-drawer`         | New appointment form — `/appointments/create` over the page (L-38)                                  | `pages/organization/$organizationSlug/appointments/`          |
| `appointment-drawer`             | Appointment form — `/appointments/$appointmentId` over the page (L-38)                              | `pages/organization/$organizationSlug/appointments/`          |
| `patients-page`                  | Clinic room page: Patients (toolbar and table ids: the shared ones, `patients-…`)                   | `pages/organization/$organizationSlug/patients/`              |
| `patient-drawer`                 | New patient drawer — `/patients/create` opens it over the list (L-32b)                              | `pages/organization/$organizationSlug/patients/`              |
| `patient-quick-add`              | Quick-add patient — the same form stacked on a picker's drawer (Q-P2)                               | `shared/components/PatientDrawer/`                            |
| `payments-page`                  | Clinic room page: Payments (toolbar and table ids: the shared ones, `payments-…`)                   | `pages/organization/$organizationSlug/payments/`              |
| `payments-pending-page`          | Payments › Pending (toolbar and table ids: the shared ones, `payments-pending-…`)                   | `payments/pending/`                                           |
| `receive-drawer`                 | Receive payment — `/payments/receive` over the ledger (L-39b)                                       | `pages/organization/$organizationSlug/payments/`              |
| `pay-drawer`                     | Send payment — `/payments/pay` over the ledger (L-39b)                                              | `pages/organization/$organizationSlug/payments/`              |
| `credit-drawer`                  | Add / Edit pending — over Payments › Pending (L-39c)                                                | `payments/pending/`                                           |
| `settle-credit-drawer`           | Give back / Got it back — stacked, no URL (L-39c)                                                   | `shared/components/SettleCreditDrawer/`                       |
| `day-close-drawer`               | Day close — `/payments/day-close` over the ledger (L-41)                                            | `pages/organization/$organizationSlug/payments/`              |
| `invoice-drawer`                 | New / Edit invoice — `/invoices/create` · `/invoices/$invoiceId/edit` (L-40)                        | `shared/components/InvoiceDrawer/`                            |
| `invoice-preview`                | Print preview — `/invoices/$invoiceId` (L-40; `-close`, `-print`)                                   | `shared/components/PrintPreview/`                             |
| `tasks-page`                     | Clinic room page: Tasks (its own ids: the Tasks room section below)                                 | `pages/organization/$organizationSlug/tasks/`                 |
| `new-task-drawer`                | New task — `/tasks/create` opens it over the list (L-47d)                                           | `pages/organization/$organizationSlug/tasks/`                 |
| `task-drawer`                    | Task drawer — `/tasks/$taskId` opens it over the list (L-47c)                                       | `pages/organization/$organizationSlug/tasks/`                 |
| `patient-file-layout`            | Patient file — `/patients/$patientId/<section>` (L-42; ids below)                                   | `pages/…/patients/$patientId/`                                |
| `offerings-page`                 | Clinic room page: the Offerings tab (`offerings-…` ids, `offerings-new-button`)                     | `pages/organization/$organizationSlug/offerings/`             |
| `offering-drawer`                | Offering drawer — `/offerings/create`, `…/$offeringId/edit` over the list (L-30c)                   | `pages/organization/$organizationSlug/offerings/`             |
| `offers-page`                    | Clinic room page: the Offers tab (`offers-…` ids, `offers-new-button`)                              | `offerings/offers/` (child of the above)                      |
| `offer-drawer`                   | Offer drawer — `/offers/create`, `…/$offerId/edit` over the Offers tab (L-30d)                      | `offerings/offers/` (child of the above)                      |
| `offering-quick-create`          | Stacked "New offering" — over the Invoice drawer's line picker (L-30e, L-40)                        | `shared/components/OfferingQuickCreate/`                      |
| `users-page`                     | Clinic room page: Users                                                                             | `pages/organization/$organizationSlug/users/`                 |
| `users-team-table`               | Users › Team table (toolbar and table ids: the shared ones, `users-team-…`)                         | `pages/organization/$organizationSlug/users/`                 |
| `user-drawer`                    | User drawer — `/users/create` (New user) and `/users/$userId/edit` (L-31b)                          | `pages/organization/$organizationSlug/users/`                 |
| `users-roles-page`               | Users › Roles & access page — `/users/roles` (L-31c)                                                | `pages/organization/$organizationSlug/users/roles/`           |
| `users-roles-panel`              | Roles & access card: role list and role page (also behind a drawer opened there)                    | `pages/organization/$organizationSlug/users/shared/`          |
| `users-branches-page`            | Users › Branches page — `/users/branches` (L-31d)                                                   | `pages/…/users/branches/`                                     |
| `users-branches-table`           | Users › Branches table (toolbar and table ids: the shared `users-branches-…`)                       | `pages/…/users/branches/`                                     |
| `branch-drawer`                  | Branch drawer — `/users/branches/create` and `…/$branchId/edit` (L-31d)                             | `pages/…/users/branches/`                                     |
| `medical-sales-page`             | Medical › Sales (toolbar and table ids: the shared ones, `medical-sales-…`)                         | `pages/organization/$organizationSlug/medical/sales/`         |
| `medical-medicines-page`         | Medical › Medicines (`medical-medicines-…`)                                                         | `pages/organization/$organizationSlug/medical/medicines/`     |
| `medical-purchases-page`         | Medical › Purchases (`medical-purchases-…`)                                                         | `pages/organization/$organizationSlug/medical/purchases/`     |
| `medical-suppliers-page`         | Medical › Suppliers (`medical-suppliers-…`)                                                         | `pages/organization/$organizationSlug/medical/suppliers/`     |
| `medical-manufacturers-page`     | Medical › Manufacturers (`medical-manufacturers-…`)                                                 | `pages/organization/$organizationSlug/medical/manufacturers/` |
| `medical-mrs-page`               | Medical › MRs (`medical-mrs-…`)                                                                     | `pages/organization/$organizationSlug/medical/mrs/`           |
| `medical-payments-page`          | Medical › Payments (`medical-payments-…`)                                                           | `pages/organization/$organizationSlug/medical/payments/`      |
| `medical-<tab>-view-action-<id>` | A Medical tab’s view action — `reorder`, `discount`, `prescriptions`, `pay-received`                | `shared/components/RoomToolbar/RoomViewAction/`               |
| `medicine-drawer`                | Medicine drawer — `/medical/medicines/create`, `…/$medicineId/edit` over the list (L-50b)           | `pages/organization/$organizationSlug/medical/shared/`        |
| `supplier-drawer`                | Supplier drawer — `/medical/suppliers/create`, `…/$supplierId/edit` (L-50b)                         | `pages/organization/$organizationSlug/medical/shared/`        |
| `manufacturer-drawer`            | Manufacturer drawer — `/medical/manufacturers/create`, `…/$manufacturerId/edit` (L-50b)             | `pages/organization/$organizationSlug/medical/shared/`        |
| `rep-drawer`                     | MR drawer — `/medical/mrs/create`, `…/$mrId/edit` (L-50b)                                           | `pages/organization/$organizationSlug/medical/shared/`        |
| `rep-visit-drawer`               | Log MR visit — `/medical/mrs/$mrId/visits/create` (L-50b)                                           | `pages/organization/$organizationSlug/medical/mrs/`           |
| `<kind>-drawer-stacked`          | A Medical drawer stacked on another — `manufacturer`, `supplier`, `rep` (an MR), `medicine` (L-50b) | `pages/organization/$organizationSlug/medical/shared/`        |
| `purchase-order-drawer`          | New / Edit purchase order — `/medical/purchases/create`, `…/$purchaseOrderId/edit` (L-50c)          | `pages/organization/$organizationSlug/medical/purchases/`     |
| `receive-goods-drawer`           | Receive goods — `/medical/purchases/$purchaseOrderId/receive` (L-50c)                               | `pages/organization/$organizationSlug/medical/purchases/`     |
| `purchase-order-view-drawer`     | Purchase order (view) — `/medical/purchases/$purchaseOrderId`; `-save` is "Pay ₹X" (L-50c)          | `pages/organization/$organizationSlug/medical/purchases/`     |
| `sale-drawer`                    | Sale (view) — `/medical/sales/$saleId`; `-save` Collect / Return medicines, `-delete` Void (L-50c)  | `pages/organization/$organizationSlug/medical/sales/`         |
| `sale-return-drawer`             | Return from patient — `/medical/sales/$saleId/return` (L-50c)                                       | `pages/organization/$organizationSlug/medical/sales/`         |
| `expiring-return-drawer`         | Return expiring stock — Medicines’ row action, no URL (L-50c)                                       | `pages/organization/$organizationSlug/medical/medicines/`     |
| `prescriptions-to-fill`          | Prescriptions to fill — Sales’ view action list (`-panel`, options) (L-50c)                         | `pages/organization/$organizationSlug/medical/sales/`         |
| `stock-items-page`               | Clinic stock › Items (`stock-items-…`)                                                              | `pages/organization/$organizationSlug/stock/items/`           |
| `stock-purchases-page`           | Clinic stock › Purchases (`stock-purchases-…`)                                                      | `pages/organization/$organizationSlug/stock/purchases/`       |
| `stock-movements-page`           | Clinic stock › Movements (`stock-movements-…`)                                                      | `pages/organization/$organizationSlug/stock/movements/`       |
| `stock-vendors-page`             | Clinic stock › Vendors (`stock-vendors-…`; Q-K1)                                                    | `pages/organization/$organizationSlug/stock/vendors/`         |
| `stock-items-view-action-check`  | Clinic stock › Items — "Stock check"                                                                | `shared/components/RoomToolbar/RoomViewAction/`               |
| `stock-item-drawer`              | Item drawer — `/stock/items/create`, `…/$itemId/edit` over the list (L-51b)                         | `pages/organization/$organizationSlug/stock/shared/`          |
| `stock-check-drawer`             | Stock check — `/stock/items/check`; `-counter`, `-row`, `-count`, `-same`, `-difference` (L-51b)    | `pages/organization/$organizationSlug/stock/shared/`          |
| `stock-movement-drawer`          | Log usage / Receive stock / Adjust stock — a row action, no URL (L-51b)                             | `pages/organization/$organizationSlug/stock/shared/`          |
| `stock-use-popover`              | The Use popover at a row's Use button (L-51b)                                                       | `pages/organization/$organizationSlug/stock/shared/`          |
| `stock-purchase-drawer`          | Purchase drawer — `/stock/purchases/create` (`?reorder=low`), `…/$purchaseId/edit` (L-51b)          | `pages/organization/$organizationSlug/stock/shared/`          |
| `stock-vendor-drawer`            | Clinic vendor drawer — `/stock/vendors/create`, `…/$vendorId/edit` (L-51b)                          | `pages/organization/$organizationSlug/stock/shared/`          |
| `stock-<kind>-drawer-stacked`    | A child stacked on a stock drawer — `vendor`, `new-item` (L-51b)                                    | `pages/organization/$organizationSlug/stock/shared/`          |
| `sidebar-toggle`                 | Menu button                                                                                         | AppLayout                                                     |
| `search-trigger`                 | Command palette                                                                                     | AppLayout                                                     |
| `user-menu-trigger`              | Avatar menu                                                                                         | AppLayout                                                     |
| `user-menu-settings`             | Settings item in avatar menu                                                                        | `AppLayout.shared.tsx`                                        |
| `logout-button`                  | Log out                                                                                             | AppLayout                                                     |
| `full-page-spinner`              | Bootstrap loading                                                                                   | `FullPageSpinner.tsx`                                         |
| `organization-switcher-trigger`  | Org switcher                                                                                        | `OrganizationSwitcher.tsx`                                    |
| `organization-switcher-create`   | Create org from switcher                                                                            | OrganizationSwitcher                                          |
| `organization-switcher-caption`  | Product name under the org name — sidebar brand lockup only                                         | OrganizationSwitcher                                          |
| `sidebar-brand`                  | Sidebar identity row (mark + switcher as one lockup; same height as `header`)                       | `AppLayoutSidebar.tsx`                                        |
| `sidebar-scrim`                  | Scrim behind the open navigation drawer (below `lg`)                                                | `AppLayoutSidebar.tsx`                                        |
| `session-timeout-dialog`         | Inactivity warning (5 min idle, 90 s grace)                                                         | `SessionTimeoutDialog.tsx`                                    |
| `session-signout`                | "Sign out" on the inactivity warning — revokes server-side                                          | SessionTimeoutDialog                                          |
| `session-stay`                   | "Stay signed in" — default focus; restarts the idle clock                                           | SessionTimeoutDialog                                          |
| `consent-banner`                 | Cookie-consent card (bottom-start corner; undecided only)                                           | `ConsentBanner.tsx`                                           |
| `consent-accept`                 | Grant analytics consent                                                                             | ConsentBanner                                                 |
| `consent-decline`                | Decline analytics consent                                                                           | ConsentBanner                                                 |

---

## Command menu (⌘K, `CommandPalette`)

Groups and rows render only for what the access in force (View-as included) may see.

| Test ID                                  | Element                                                                                      | File                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `command-palette`                        | The dialog ("Command menu"; 12vh from the top, `min(640px, 100% − 32px)`)                    | `components/CommandPalette/CommandPaletteShell` |
| `command-palette-search`                 | The search input ("Search or jump to…", name "Search")                                       | `CommandPalette.tsx`                            |
| `command-palette-searching`              | Spinner while the search waits out its 250ms debounce or loads                               | `CommandPalette.tsx`                            |
| `command-palette-group-<id>`             | A group: `actions`, `go-to`, `patients`, `leads`, `invoices`; platform `settings`, `theme` … | `CommandPaletteGroup.tsx`                       |
| `command-palette-action-<action>`        | Action row: `new-lead`, `new-appointment`, `new-patient`, `new-receipt`, `open-tasks`        | `clinic-command-groups.ts`                      |
| `command-palette-go-to-<navId>`          | "Go to" room row (`nav.id` of the room's manifest)                                           | `clinic-command-groups.ts`                      |
| `command-palette-patient-<patientId>`    | Patient result ("#3508 · •••• 3212")                                                         | `clinic-command-groups.ts`                      |
| `command-palette-lead-<leadId>`          | Lead result ("#2352 · Clinic visited")                                                       | `clinic-command-groups.ts`                      |
| `command-palette-invoice-<invoiceId>`    | Invoice result ("Clinic invoice #787")                                                       | `clinic-command-groups.ts`                      |
| `command-palette-org-<slug \| personal>` | Workspace switch row                                                                         | `CommandPaletteOrgGroup.tsx`                    |
| `command-palette-item-spinner`           | A row's own work in flight (workspace switch)                                                | `CommandPaletteItem.tsx`                        |
| `command-palette-empty`                  | Empty line ("No matches. Try a name, phone or #ID." in an organization)                      | `CommandPalette.tsx`                            |
| `command-palette-footer`                 | Footer: ↑ ↓ move · ↵ open                                                                    | `CommandPaletteFooter.tsx`                      |
| `command-palette-hint`                   | "Type 2+ letters to search patients, leads and invoices" (until two letters)                 | `CommandPaletteFooter.tsx`                      |
| `command-palette-pending`                | Skeleton list while the command engine chunk loads                                           | `CommandPaletteLazy.tsx`                        |
| `command-palette-error`                  | The chunk failed to load (Retry)                                                             | `CommandPaletteLazy.tsx`                        |

---

## Shared confirm (`ConfirmDialog`)

The plain confirm and the reason confirm (`reason` set) share the first three ids; the
reason confirm carries `data-layout="panel"` from `md` and `data-layout="sheet"` below.

| Test ID                  | Element                                                                      | File                                        |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------- |
| `confirm-dialog`         | The confirm (`role="alertdialog"`) — centred, the end panel or the sheet     | `shared/components/ConfirmDialog/`          |
| `confirm-cancel`         | Dismiss — "Cancel" (plain) / "Keep it" (reason); initial focus on the reason | ConfirmDialog, `ReasonConfirm.tsx`          |
| `confirm-accept`         | The action — `aria-disabled` until a reason (and an "Other" note) is in      | ConfirmDialog, `ReasonConfirm.tsx`          |
| `confirm-close`          | × — outside the panel's start edge from `md`, inside the sheet below         | `ReasonConfirm.tsx`                         |
| `confirm-record`         | The record pill under the title                                              | `ReasonConfirm.tsx`                         |
| `confirm-reason-<value>` | One reason chip (radio), value kebab-cased (`confirm-reason-not-needed`)     | `ReasonConfirm.tsx` (`confirmReasonTestId`) |
| `confirm-note`           | The note textarea                                                            | `ReasonConfirm.tsx`                         |
| `confirm-note-error`     | The server's note message (422)                                              | `ReasonConfirm.tsx`                         |
| `confirm-reasons-error`  | The server's reason message (422)                                            | `ReasonConfirm.tsx`                         |
| `confirm-hint`           | Footer hint — "Pick a reason to continue" / "Add a short note for “Other”"   | `ReasonConfirm.tsx`                         |

---

## Toasts (`AppToaster` + `notify`)

Bottom-centre by default, the top layer above every drawer, sheet and dialog, and on a
phone 16px above the bottom stack (`--floating-bottom-offset` + notice + "New" + safe area).

| Test ID         | Element                                                            | File                                              |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| `app-toast`     | One toast (`data-toast-pending` while the immediate host shows it) | `shared/notify/CustomToast.tsx`, `AppToaster.tsx` |
| `toast-action`  | Its action — "Undo" (`notify.undo`, 10s) or the caller's ("Retry") | CustomToast, AppToaster                           |
| `toast-dismiss` | Dismiss ×                                                          | CustomToast, AppToaster                           |

---

## Shared data table

Every list table carries these, prefixed by its `tableId` (`patients-table-row`); a table without
one uses `data` (`data-table-row`). A control mounted per row shares one id — reach it by
index or scope it to its row.

| Test ID                                           | Element                                                         | File                      |
| ------------------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| `<tableId>-table`                                 | Table card                                                      | `DataTable/DataTable.tsx` |
| `<tableId>-table-header`                          | Header row (`md` and up)                                        | `DataTableHeaderRow.tsx`  |
| `<tableId>-table-row`                             | Body row (`data-row-index`; `data-kfocus` under j / k)          | `DataTableRow.tsx`        |
| `<tableId>-table-select-all` / `-select-row`      | Selection boxes (`md` and up)                                   | `DataTableRow.tsx`        |
| `<tableId>-table-footer`                          | 44px footer (count, fold toggle, bulk bar)                      | `DataTableFooter.tsx`     |
| `<tableId>-table-fold-toggle`                     | "<N> columns in rows · Show all" ↔ "Fit to width"               | `DataTableFooter.tsx`     |
| `<tableId>-table-bulk-bar`                        | Bulk bar; `-bulk-select-all`, `-bulk-clear`, `-bulk-<actionId>` | `DataTableBulkBar/`       |
| `<tableId>-table-loading-more` / `-table-end`     | "Loading more …" rows / "All … loaded" end line                 | `DataTableTail.tsx`       |
| `<tableId>-row-action-<actionId>` / `-row-more`   | Row actions and the "More actions" menu                         | `DataTableRowActions/`    |
| `<tableId>-columns-trigger` / `-columns-show-all` | Columns chooser; options `-columns-option-<columnId>`           | `DataTableColumnChooser/` |
| `<tableId>-saved-views`                           | Saved views track                                               | `DataTableSavedViews/`    |

---

## Room toolbar (`RoomToolbar`)

A room list's toolbar, prefixed by the same `tableId` (`patients-filters-trigger`). The floating
"New" exists only below `md` (`data-slot="fab"`, portalled to `body`); from `md` the same action
ids sit in the toolbar. A room's own Filters (the `filtersSlot`, Appointments) keeps the
`<tableId>-filters-trigger` / `-filters-clear` / `-filters` ids.

| Test ID                                            | Element                                                                     | File                          |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------- |
| `<tableId>-toolbar`                                | Toolbar row (`data-layout` `default` / `leads` / `actions` / `tasks`)       | `RoomToolbar/RoomToolbar.tsx` |
| `<tableId>-tabs` / `-tab-<tabId>`                  | Tab track (room tabs `nav`, or view tabs `tablist`) and each tab            | `RoomToolbar/RoomTabs/`       |
| `<tableId>-tabs-more`                              | "More ⌄" (folded tabs); its list `-tabs-more-panel`, rows `-option-<tabId>` | `RoomToolbar/RoomTabs/`       |
| `<tableId>-search`                                 | List search (`data-expanded`)                                               | `RoomToolbar/RoomSearch/`     |
| `<tableId>-filters-trigger` / `-filters-clear`     | Filters button / joined × "Clear all filters"                               | `RoomToolbar/RoomFilters/`    |
| `<tableId>-filters`                                | Filters popover (bottom sheet below `md`)                                   | `RoomToolbar/RoomFilters/`    |
| `<tableId>-filters-clear-all` / `-save` / `-apply` | "Clear all" · "Save as view" / "Saved as view" · "Apply filter"             | `RoomToolbar/RoomFilters/`    |
| `filter-<fieldKey>-from` / `-to`                   | A date section's custom-range pickers                                       | `RoomToolbar/RoomFilters/`    |
| `<tableId>-<actionId>` / `<tableId>-new-menu`      | Primary action(s) (`new-patient`, `pay`) / the split "⌄" menu               | `RoomToolbar/RoomPrimary/`    |
| `<tableId>-fab`                                    | Floating "New" group (phone)                                                | `RoomToolbar/RoomPrimary/`    |
| `<tableId>-view-bar` / `-view-<viewId>`            | View bar under the toolbar, and each sub-view tab                           | `RoomToolbar/RoomViewBar/`    |

---

## Tasks room (`/tasks`, L-47b · New task L-47d · task drawer L-47c)

The toolbar carries the room toolbar's ids with the `tasks` prefix (`tasks-toolbar` with
`data-layout="tasks"`, `tasks-tab-queue` / `-snoozed` / `-done`, `tasks-search`, `tasks-new`,
`tasks-fab`). The list is the room's own grouped list, not the shared table.

| Test ID                                                | Element                                                                                                 | File                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `tasks-scope-tabs` / `tasks-scope-tab-<scope>`         | "Mine · Everyone" (`mine`, `everyone`)                                                                  | `components/TasksToolbar/`     |
| `tasks-type-trigger` / `-clear` / `-panel`             | Type dropdown ("All types" · a rule · "<n> types"), its clear ×, its list                               | `components/TaskTypePicker/`   |
| `tasks-rules-trigger` / `tasks-rules`                  | "Rules" and the Task rules popover (bottom sheet below `md`)                                            | `components/TaskRulesPopover/` |
| `tasks-rule-<rule>` / `-switch` / `-handle`            | One rule's line (`data-on`), its switch, "Let Clinozy handle" ↔ "Clinozy handles it"                    | `components/TaskRulesPopover/` |
| `tasks-list`                                           | The list (`role="table"`, `data-tab`; `aria-busy` while a new view loads)                               | `components/TaskList/`         |
| `tasks-group-<group>`                                  | A group: `overdue`, `today`, `later` (To do), `snoozed`, `done`                                         | `components/TaskList/`         |
| `tasks-row`                                            | A task row (`data-task-id`, `data-overdue`)                                                             | `components/TaskRow/`          |
| `tasks-empty` / `tasks-empty-new`                      | A view's empty line; To do's "New task"                                                                 | `components/TaskList/`         |
| `new-task-drawer-…`                                    | New task's record drawer parts (`-title`, `-step-<what\|when\|how>`, `-save`, `-dismiss`, `-summary` …) | `components/NewTaskDrawer/`    |
| `new-task-for`                                         | "For" — the picker over patients and leads (`-trigger`, `-panel`, `-search`)                            | `components/NewTaskDrawer/`    |
| `new-task-type-<type>`                                 | Type chips (`call_back`, `follow_up`, `send_price`, `ask_for_photos`, `feedback`, `payment_reminder`)   | `components/NewTaskDrawer/`    |
| `new-task-title` / `new-task-notes`                    | Title and Notes                                                                                         | `components/NewTaskDrawer/`    |
| `new-task-due-<preset>`                                | Due chips (`today`, `tomorrow`, `inThreeDays`, `nextWeek`)                                              | `components/NewTaskDrawer/`    |
| `new-task-due-date` / `new-task-due-time`              | The due date and "Due time" pickers                                                                     | `components/NewTaskDrawer/`    |
| `new-task-owner`                                       | "Assign to" — the team picker                                                                           | `components/NewTaskDrawer/`    |
| `new-task-priority-<priority>` / `new-task-remind`     | Normal · High chips; "Remind 15 min before"                                                             | `components/NewTaskDrawer/`    |
| `task-drawer-title` / `-due` / `-owner`                | The task drawer's header: title (focused on open), due label, "Assigned to" chip                        | `components/TaskDrawer/`       |
| `task-drawer-person` / `-source`                       | Who: the person under the contact card; the source button ("Open appointment · Appt #…")                | `components/TaskDrawer/`       |
| `task-drawer-quote` / `-tiles` / `-how`                | The quoted message, the context tiles, "2 · How"                                                        | `components/TaskDrawer/`       |
| `task-drawer-automation` / `-automation-action`        | "Clinozy can do this" and "Let Clinozy do it"                                                           | `components/TaskDrawer/`       |
| `task-drawer-outcome-<outcome>` / `task-drawer-note`   | An outcome button (the rule's outcome id); the outcome note                                             | `components/TaskDrawer/`       |
| `task-drawer-snooze` / `-assign` / `-was` / `-dismiss` | Footer: Snooze menu, Assigned picker (`-panel`, `-option-<id>`), "Was A → B", Close                     | `components/TaskDrawer/`       |
| `task-drawer-chat` / `task-drawer-close`               | The chat column (not on a phone); the ×                                                                 | `components/TaskDrawer/`       |
| `whats-next-drawer` (`-save`, `-dismiss` …)            | "What’s next for <first>?" over the list after a closing outcome                                        | `components/WhatsNextSheet/`   |
| `whats-next-step-<step>` / `whats-next-when-<when>`    | Next step chips (`callAgain` …) and When chips (`inThreeHours` …)                                       | `components/WhatsNextSheet/`   |
| `whats-next-owner` / `whats-next-note`                 | "Assigned to" and Note                                                                                  | `components/WhatsNextSheet/`   |

---

## Today (`/today`, L-48)

The room's own layout (no room toolbar): the greeting row, the lane tiles, the selected lane's
panel and the work queue aside. A work-queue booking follow-on opens the shared appointment
form over the page (`appointment-form-…` ids, below).

| Test ID                                     | Element                                                                                            | File                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `today-greeting` / `today-pulse`            | The greeting (the page's h1) and the pulse line                                                    | `components/TodayGreeting/`                         |
| `today-new-booking` / `today-walk-in`       | "New booking" (hidden without Leads Create) and "Walk-in" (⌘K)                                     | `components/TodayGreeting/`                         |
| `today-lanes` / `today-lane-<lane>`         | The tiles' group; a tile (`enquiries` … `with-doctor` … `pharmacy`; `aria-pressed`, `data-dimmed`) | `components/LaneTiles/`                             |
| `today-panel`                               | The selected lane's panel (`data-lane`)                                                            | `components/LanePanel/`                             |
| `today-card` / `today-card-open`            | A visit card (`data-card-id`) and its name area (opens the lead or the patient file)               | `components/LanePanel/`                             |
| `today-card-action` / `today-empty`         | The lane action (`data-action`: `book`, `checkIn`, `sendIn`, …); "No one here right now."          | `components/LanePanel/`                             |
| `today-queue` / `today-queue-scope-<scope>` | The work queue aside; "Mine" · "Everyone" (`mine`, `everyone`)                                     | `components/WorkQueue/`                             |
| `today-queue-card` / `today-queue-outcome`  | A task card (`data-task-id`, `data-closed`); an outcome button (`data-outcome`)                    | `components/WorkQueue/`                             |
| `today-queue-empty` / `today-booking-error` | The To do line when nothing is left; the stacked booking form's load failure                       | `components/WorkQueue/`, `components/TodayBooking/` |

The lane actions "Open consult" · "Open session" · "Checkout" open the Visit sheet (below) on
their tab; when it closes, focus goes back to the card's action (`today.focus.ts`).

## Visit sheet (`/visits/$visitId`, L-49)

A full-screen sheet over the room it opened from (`?tab=history|consult|treatment|checkout`),
one Visit model with Today's floor and the patient file's flow (D18). Paths are under
`pages/organization/$organizationSlug/visits/components/`.

| Test ID                                                                        | Element                                                                                                                         | Source                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `visit-page` · `visit-close-strip`                                             | The sheet (the dialog) · its 12px strip that closes it                                                                          | `VisitSheet/VisitSheet.tsx`          |
| `visit-name` · `visit-meta` · `visit-chip`                                     | The person's name (the dialog title) · "PT-… · phone" · a chip (`data-chip`: pack, due, consent, stage)                         | `VisitSheet/visit-header.tsx`        |
| `visit-full-profile` · `visit-close`                                           | "Full profile" (the patient file's Overview) · "Close · Esc"                                                                    | `VisitSheet/visit-header.tsx`        |
| `visit-tab-<tab>` · `visit-saved`                                              | A tab (`history` · `consult` · `treatment` · `checkout`) · the saved line (`data-state`)                                        | `VisitSheet/VisitSheet.tsx`          |
| `visit-needs-patient`                                                          | A lead's visit in a write tab: "Create the patient record first…"                                                               | `VisitSheet/needs-patient.tsx`       |
| `visit-history` · `visit-history-filter-<filter>`                              | The History tab · a filter (`all` · `clinical` · `money` · `messages` · `audit`; `aria-pressed`)                                | `VisitHistory/VisitHistory.tsx`      |
| `visit-history-row` · `visit-next-<tab>`                                       | A row (`data-kind`) · a "Next for this visit" jump (`consult` · `treatment` · `checkout`)                                       | `VisitHistory/VisitHistory.tsx`      |
| `visit-consult` · `visit-complaint` · `visit-findings`                         | The Consult & Rx tab · the complaint and findings fields                                                                        | `VisitConsult/`                      |
| `visit-diagnosis` · `visit-plan`                                               | A diagnosis chip (`aria-pressed`) · the plan field                                                                              | `VisitConsult/consult-note.tsx`      |
| `visit-copy-rx` · `visit-rx-add` · `visit-approve`                             | "Copy {date} prescription" · an "Add" chip · "Approve · print · send to pharmacy" (`aria-disabled` until every line has a dose) | `VisitConsult/VisitConsult.tsx`      |
| `visit-rx-line` · `visit-rx-review` · `visit-rx-dose` · `visit-rx-remove`      | An Rx line · its "Set dose" (a line without one; `aria-expanded`) or ✓ review (`aria-pressed`) · the dose editor · remove       | `VisitConsult/rx-lines.tsx`          |
| `visit-rx-approved`                                                            | The approved box with "Print"                                                                                                   | `VisitConsult/VisitConsult.tsx`      |
| `visit-treatment` · `visit-setting-<key>` · `visit-area`                       | The Treatment tab (pack bar segments carry `data-segment`) · a setting's "today" field · an area pill                           | `VisitTreatment/`                    |
| `visit-complete-session` · `visit-session-recorded` · `visit-reverse-session`  | "Complete session k of m" · the recorded box · "Reverse with reason"                                                            | `VisitTreatment/VisitTreatment.tsx`  |
| `visit-photo` · `visit-capture`                                                | A comparison photo · the "Capture today" tile                                                                                   | `VisitTreatment/visit-photos.tsx`    |
| `visit-checkout` · `visit-bill-line` · `visit-create-bill` · `visit-bill-made` | The Checkout tab · a bill line · "Create bill" · the finalised line (Cancel bill · Credit note)                                 | `VisitCheckout/`                     |
| `visit-mode-<mode>` · `visit-amount` · `visit-receive`                         | A payment mode (`upi` · `cash` · `card` · `split`; `aria-checked`) · the amount · "Receive ₹… by …"                             | `VisitCheckout/checkout-payment.tsx` |
| `visit-complete`                                                               | "✓ Complete visit" when nothing is left to pay                                                                                  | `VisitCheckout/checkout-payment.tsx` |

---

## Dashboard (`/`)

| Test ID              | Element                                                  | File                |
| -------------------- | -------------------------------------------------------- | ------------------- |
| `dashboard-page`     | Page root (placeholder — REPLACE_WITH_MODULE after auth) | `DashboardPage.tsx` |
| `dashboard-greeting` | Placeholder heading                                      | `DashboardPage.tsx` |

> The dashboard is a placeholder stub — add widget test ids (stat cards, charts,
> activity, team) here when the module is built. `widget-error-*` is available from `shared/components/`
> for future modules.

---

## Onboarding, invite, org, settings

See grep in `src/` or sections above for: `onboarding-*`, `accept-invite-*`, `organization-*`, `settings-*`, `organizations-*`, `create-organization-*`.

### Accept invite

| Test ID                 | Element       |
| ----------------------- | ------------- |
| `accept-invite-page`    | Page root     |
| `accept-invite-loading` | Spinner state |
| `accept-invite-success` | Success state |
| `accept-invite-error`   | Error state   |
| `accept-invite-login`   | Go to sign in |

---

## System routes

| Test ID                | Route          |
| ---------------------- | -------------- |
| `not-found-page`       | 404            |
| `unauthorized-page`    | 403            |
| `route-error-boundary` | Error boundary |

---

## Shared clinic primitives (launch L-21)

Rendered inside any room; scope them to the room's own container in a spec.

| Test ID                                                                               | Element                                                                                                  | Source                                        |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `empty-state`                                                                         | Empty-state root (`data-tone` on the illustrated room variant; `data-variant="card"` on the dashed card) | `shared/components/EmptyState/EmptyState.tsx` |
| `empty-state-illustration`                                                            | 96px dashed-ring illustration (room tone)                                                                | `shared/components/EmptyState/EmptyState.tsx` |
| `empty-state-action`                                                                  | 36px primary create action (`EmptyStateAction`)                                                          | `shared/components/EmptyState/EmptyState.tsx` |
| `empty-state-clear-filters`                                                           | "Clear filters" in the filtered empty state                                                              | `shared/components/EmptyState/EmptyState.tsx` |
| `contact-card`                                                                        | Contact card (`role="dialog"`, "Contact")                                                                | `shared/components/PersonCard/ContactCard/`   |
| `contact-card-open-file`                                                              | Patient name → patient file                                                                              | `shared/components/PersonCard/ContactCard/`   |
| `contact-card-edit` · `contact-card-change` · `contact-card-claim`                    | Edit contact · Change contact (forms) · "Open · Claim"                                                   | `shared/components/PersonCard/ContactCard/`   |
| `contact-card-new-lead` · `contact-card-new-appointment` · `contact-card-new-patient` | Footer "+ Lead" · "+ Appointment" · "+ Patient"                                                          | `shared/components/PersonCard/ContactCard/`   |
| `team-card` · `team-card-assign`                                                      | Team card (`role="dialog"`, named by the member) · its assign button                                     | `shared/components/PersonCard/TeamCard/`      |
| `skeleton-rows` · `skeleton-row`                                                      | Flat skeleton block · one placeholder row                                                                | `shared/components/SkeletonRows/`             |
| `patient-badge` · `avatar-stack-more`                                                 | The "P" patient badge · an avatar stack's "+N" pill                                                      | `shared/components/Cells/`                    |

---

## Boot splash (launch L-52)

The HTML `#app-splash` (no test id of its own — `role="status"`, "Loading Clinozy") and the
greeting block the React slot renders into it. Gone once the splash exits.

| Test ID                                   | Element                                                               | Source                             |
| ----------------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| `app-splash-mark` · `app-splash-wordmark` | The 64px mark with its halo · the wordmark (frames 1–4, CSS)          | `index.html`                       |
| `app-splash-block`                        | The greeting block (frame 5); carries `--app-splash-block-delay`      | `shared/components/AppSplashSlot/` |
| `app-splash-greeting`                     | "Good morning, <first name>" (org layout's first load, session ready) | `shared/components/AppSplashSlot/` |
| `app-splash-progress`                     | Bar + ticker (online)                                                 | `shared/components/AppSplashSlot/` |
| `app-splash-bar` · `app-splash-ticker`    | The bar's fill · the ticker's moving reel                             | `shared/components/AppSplashSlot/` |
| `app-splash-offline` · `app-splash-retry` | Offline notice (`role="alert"`) · its Retry (reloads the boot URL)    | `shared/components/AppSplashSlot/` |

---

## Clinic rooms — page roots and dialog-route drawers (launch L-55)

Every room's route root and the drawers its dialog routes open (`<d>` of the record drawer above;
each `*.manifest.ts` names its `testId`). A room list's toolbar and table carry the room toolbar's
and the shared table's ids under the prefix in the third column. The smoke
(`clinic-rooms.e2e.test.ts`) opens each room from the shell: `nav-<room>` (the header's tab from
`md`, the phone's tab bar) for a pinned room, `all-sections-<room>` from All sections
(`all-sections-trigger` · `all-sections`, or the phone's `nav-more-sections` · `all-sections-sheet`)
for the rest.

| Room (`nav` id) | Route root(s) → page id                                                                                                                               | Toolbar / table prefix                           | Dialog-route drawers                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `today`         | `/today` → `today-page`                                                                                                                               | — (its own layout, Today above)                  | —                                                                                                                                                                                                                                                    |
| `leads`         | `/leads` → `leads-page`                                                                                                                               | `leads`                                          | `new-lead-drawer` (`create`), `lead-drawer` (`$leadId`)                                                                                                                                                                                              |
| `appointments`  | `/appointments` → `appointments-page`                                                                                                                 | `appointments`                                   | `new-appointment-drawer` (`create`), `appointment-drawer` (`$appointmentId`)                                                                                                                                                                         |
| `patients`      | `/patients` → `patients-page`; the file `/patients/$patientId/<section>` → `patient-file-layout` + `patient-section-<section>`                        | `patients`                                       | `patient-drawer` (`create`, `$patientId/edit`), `patient-photo-viewer` · `patient-photo-details` (Photos)                                                                                                                                            |
| `medical`       | `/medical` → `medical-page` (layout); `sales` · `medicines` · `purchases` · `suppliers` · `manufacturers` · `mrs` · `payments` → `medical-<tab>-page` | `medical-<tab>`                                  | `invoice-drawer` (`sales/create`), `sale-drawer`, `sale-return-drawer`, `medicine-drawer`, `purchase-order-drawer`, `purchase-order-view-drawer`, `receive-goods-drawer`, `supplier-drawer`, `manufacturer-drawer`, `rep-drawer`, `rep-visit-drawer` |
| `stock`         | `/stock` → `stock-page` (layout); `items` · `purchases` · `movements` · `vendors` → `stock-<tab>-page`                                                | `stock-<tab>`                                    | `stock-item-drawer`, `stock-check-drawer` (`items/check`), `stock-purchase-drawer`, `stock-vendor-drawer`                                                                                                                                            |
| `payments`      | `/payments` → `payments-page`; `/payments/pending` → `payments-pending-page`                                                                          | `payments`                                       | `receive-drawer` (`receive`, `$paymentId/edit`), `pay-drawer`, `day-close-drawer`, `credit-drawer` (`pending/…`); over the ledger, the invoice routes' `invoice-drawer` and `invoice-preview` (`invoices/…`)                                         |
| `tasks`         | `/tasks` → `tasks-page`                                                                                                                               | `tasks` (its own grouped list, Tasks room above) | `new-task-drawer` (`create`), `task-drawer` (`$taskId`)                                                                                                                                                                                              |
| `offerings`     | `/offerings` → `offerings-page`; `/offerings/offers` → `offers-page`                                                                                  | `offerings`                                      | `offering-drawer`, `offer-drawer`                                                                                                                                                                                                                    |
| `users`         | `/users` → `users-page`; `/users/roles` → `users-roles-page`; `/users/branches` → `users-branches-page`                                               | `users-team`                                     | `user-drawer` (`create`, `$userId/edit`), `branch-drawer`                                                                                                                                                                                            |

An unknown record id on a dialog route stays on the room with one `app-toast` ("<Record> not found ·
it may have been deleted"); an unknown path inside the organization goes to the role home with
"Page not found" (`S:115`).

---

## E2E specs (existing)

| Spec                                         | Test IDs used                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/auth.e2e.test.ts`                 | Unified auth (`auth-continue-google`; `auth-continue-github` absent) + `dashboard-page`                                                                                                                                                                                                                                                                                                |
| `tests/e2e/organization.e2e.test.ts`         | `organization-page`, `organization-switcher-trigger` / `-option-<slug>` (Account menu)                                                                                                                                                                                                                                                                                                 |
| `tests/e2e/dashboard.e2e.test.ts`            | `dashboard-page`, `dashboard-greeting`, header hybrid (`search-trigger`, `user-menu-trigger`), `all-sections-trigger`, `account-menu`, `user-menu-settings`                                                                                                                                                                                                                            |
| `tests/e2e/settings.e2e.test.ts`             | `settings-modal` + `role=dialog`, nav sections, `user-menu-*`                                                                                                                                                                                                                                                                                                                          |
| `tests/e2e/edge-cases.e2e.test.ts`           | Hash fallbacks, legacy billing remap, Stripe return cleanup, auth validation edges                                                                                                                                                                                                                                                                                                     |
| `tests/e2e/navigation.e2e.test.ts`           | Hybrid login guard + `not-found-page`; an in-org unknown path → login with the redirect                                                                                                                                                                                                                                                                                                |
| `tests/e2e/notifications.e2e.test.ts`        | `account-menu-notifications` → `notification-popover` + list/mark-all                                                                                                                                                                                                                                                                                                                  |
| `tests/e2e/network-resilience.e2e.test.ts`   | Hybrid login fill + `offline-indicator`                                                                                                                                                                                                                                                                                                                                                |
| `tests/e2e/accessibility.e2e.test.ts`        | login + dashboard pages (axe)                                                                                                                                                                                                                                                                                                                                                          |
| `tests/e2e/visual.e2e.test.ts`               | Screenshots                                                                                                                                                                                                                                                                                                                                                                            |
| `tests/e2e/responsive.e2e.test.ts`           | Mobile overflow + settings                                                                                                                                                                                                                                                                                                                                                             |
| `tests/e2e/org-switching.e2e.test.ts`        | Account menu › Switch clinic (`organization-switcher-trigger`, `-option-<slug \| personal>`)                                                                                                                                                                                                                                                                                           |
| `tests/e2e/routes-integration.e2e.test.ts`   | Full live route matrix — public shells, guards, authenticated journey, logout                                                                                                                                                                                                                                                                                                          |
| `tests/e2e/deployment-*.e2e.test.ts`         | Deployment mode matrix (personal-and-team / personal-only / team-only)                                                                                                                                                                                                                                                                                                                 |
| `tests/e2e/accept-invite.e2e.test.ts`        | `accept-invite-*` (expired token → error + login)                                                                                                                                                                                                                                                                                                                                      |
| `tests/e2e/onboarding.e2e.test.ts`           | `onboarding-page`, `onboarding-step-title`, `onboarding-next`                                                                                                                                                                                                                                                                                                                          |
| `tests/e2e/boot-splash.e2e.test.ts`          | `#app-splash` + `app-splash-*` (frames, greeting → `today-page`, offline Retry, reduced motion)                                                                                                                                                                                                                                                                                        |
| `tests/e2e/theme.e2e.test.ts`                | `account-menu-theme-<light \| dark \| system>` (Account menu › Appearance)                                                                                                                                                                                                                                                                                                             |
| `tests/e2e/clinic-rooms.e2e.test.ts`         | Every room's page root (below) at desktop and phone; `nav-<room>`, `all-sections-trigger`, `nav-more-sections`, `all-sections` / `-sheet`, `all-sections-<room>`; the happy paths' ids (`today-lane-arriving`, `today-panel`, `today-card-action`, `toast-action`, `<table>-table-row`, the New buttons, the drawers' `<d>` / `<d>-close`, `patient-file-layout`, `patient-file-back`) |
| `tests/e2e/clinic-dialog-routes.e2e.test.ts` | A sample of the dialog routes (below): page root + drawer `<d>` on a cold load or a reload; `app-toast` for an unknown id or path                                                                                                                                                                                                                                                      |

**Planned E2E (testids ready):** org tabs, settings tabs, team URL `?team=`, passwordless buttons, full onboarding wizard steps.

## Organization routing (added 2026-06-11)

| Test ID                             | Element                                                       | Source                                                             |
| ----------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `organization-page`                 | Organization picker page                                      | `pages/organization/OrganizationPickerPage.tsx`                    |
| `organization-picker-option-<slug>` | Picker card per organization                                  | `pages/organization/OrganizationPickerPage.tsx`                    |
| `organization-picker-create`        | Picker create-organization button                             | `pages/organization/OrganizationPickerPage.tsx`                    |
| `suspended-page`                    | Suspended-organization blocked state                          | `pages/organization/$organizationSlug/suspended/SuspendedPage.tsx` |
| `suspended-switch-organization`     | Switch-organization button                                    | `pages/organization/$organizationSlug/suspended/SuspendedPage.tsx` |
| `settings-modal`                    | Global settings modal (hash-driven)                           | `shared/components/SettingsModal/SettingsModal.tsx`                |
| `settings-nav-<scope>-<section>`    | Settings nav items (e.g. `settings-nav-organization-members`) | `shared/components/SettingsModal/SettingsNav.tsx`                  |
| `settings-members-open-users`       | Settings › Members' link to the Team once Users holds it      | `shared/components/SettingsModal/organization/UsersRoomLink.tsx`   |
| `settings-roles-open-users`         | Settings › Roles' link to Users › Roles & access (D17)        | `shared/components/SettingsModal/organization/UsersRoomLink.tsx`   |

## Shared pickers (`shared/components/Picker/`)

Every picker derives its ids from one base id the caller passes (`testId`; default `picker`,
`date-picker`, `time-picker`, `calendar-picker`). The panel id is the same whether it opens as
the popover (from `md`) or the bottom sheet (`data-picker-surface="popover" | "sheet"`).

| Test ID                           | Element                                                     | Source                                    |
| --------------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| `<base>`                          | Field-style trigger (a custom `renderTrigger` sets its own) | `Picker/PickerTrigger/PickerTrigger.tsx`  |
| `<base>-clear`                    | Clear × beside the chevron (`clearable`)                    | `Picker/PickerTrigger/PickerTrigger.tsx`  |
| `<base>-panel`                    | Popover or bottom sheet                                     | `Picker/PickerSheet/PickerSheet.tsx`      |
| `<base>-search`                   | Search input (remote, creatable, or more than 7 options)    | `Picker/PickerPanel/PickerPanel.tsx`      |
| `<base>-option-<key>`             | One option row (`aria-checked` = picked)                    | `Picker/PickerPanel/PickerOptionItem.tsx` |
| `<base>-create`                   | Dashed "Create “<query>”" row                               | `Picker/PickerPanel/PickerPanel.tsx`      |
| `<base>-create-full`              | Footer "<New thing> · “<query>”" · "full details"           | `Picker/PickerPanel/PickerPanel.tsx`      |
| `<base>-empty`                    | "Nothing to pick yet" / "No results for “<query>”"          | `Picker/PickerPanel/PickerPanel.tsx`      |
| `<base>-loading`                  | Four skeleton rows (first load or a remote search)          | `Picker/PickerPanel/PickerPanel.tsx`      |
| `<base>-loading-more`             | Two "Loading more" rows while the next page loads           | `Picker/PickerPanel/PickerPanel.tsx`      |
| `date-picker-option-<YYYY-MM-DD>` | One date in the date dropdown                               | `Picker/DatePicker/DatePicker.tsx`        |
| `time-picker-option-<HH:mm>`      | One time tile                                               | `Picker/TimePicker/TimePicker.tsx`        |

## Record drawer (shared, launch L-17)

Every room's create / show / edit drawer is a `RecordDrawer`; the screen passes its own root id
(`testId`, e.g. `patient-drawer`, default `record-drawer`) and the parts derive theirs from it.
Below, `<d>` is that root id.

| Test ID                                                | Element                                                                    | Source                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------- |
| `<d>`                                                  | Drawer panel (`role="dialog"`, named by its title)                         | `shared/components/RecordDrawer/`      |
| `<d>-title` / `<d>-tag` / `<d>-badges`                 | Title (focused on open), tag pill, badge strip                             | RecordDrawer                           |
| `<d>-close`                                            | × — floating outside the edge from `md` up, inside the header on a phone   | RecordDrawer                           |
| `<d>-body`                                             | Scrolling body                                                             | RecordDrawer                           |
| `<d>-quick-fill` / `<d>-quick-fill-<id>`               | "Quick fill" row and one preset chip                                       | `shared/components/QuickFillRow/`      |
| `<d>-steps` / `<d>-step-<id>`                          | Step accordion and one card (`data-status`: open · done · missing · later) | `shared/components/DrawerSteps/`       |
| `<d>-step-<id>-trigger` / `-peek` / `-next`            | Card head, collapsed peek, the "Next: … →" button                          | DrawerSteps                            |
| `<d>-footer` / `<d>-summary`                           | Footer and its summary                                                     | `shared/components/DrawerFooter/`      |
| `<d>-dismiss`                                          | Cancel / Back (stacked child) / Close (read-only)                          | DrawerFooter                           |
| `<d>-delete` / `<d>-save-and-add` / `<d>-save`         | Delete, "Save & add another" (never on a phone), primary                   | DrawerFooter                           |
| `<d>-not-saved`                                        | "Not saved · your changes are kept" after a failed save                    | DrawerFooter                           |
| `confirm-dialog` / `confirm-accept` / `confirm-cancel` | "Discard changes?" prompt of a dirty drawer (Discard / Keep editing)       | `shared/hooks/useUnsavedChangesGuard/` |

### Patient drawer (shared, launch L-32b)

New patient, Edit patient and quick-add are one `PatientDrawer`; `<d>` is `patient-drawer`
(quick-add: `patient-quick-add`). Its steps are `contact` and `clinic`. A chip group's chips are
`<group>-<value>` (`patient-drawer-types-lhr`, `patient-drawer-status-new`).

| Test ID                                                             | Element                                                          | Source                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| `<d>-first-name` / `<d>-last-name` / `<d>-mobile` / `<d>-phone2`    | Step 1's name and mobile fields                                  | `shared/components/PatientDrawer/` |
| `<d>-address` / `<d>-home-branch` / `<d>-gender` / `<d>-birth-date` | Address, Home branch chips (several branches only), Gender, date | PatientDrawer                      |
| `<d>-duplicate` / `<d>-duplicate-action`                            | "Same mobile as … · #…" and its "Open file" / "Use existing"     | PatientDrawer                      |
| `<d>-types` / `<d>-status` / `<d>-conversion` / `<d>-referrer-type` | Step 2's chip groups                                             | PatientDrawer                      |
| `<d>-referred-by` / `<d>-notes` / `<d>-consent`                     | Referred by, Notes, the Consent chips                            | PatientDrawer                      |
| `<d>-follow-up-date` / `<d>-follow-up-time` / `<d>-follow-up-<id>`  | Follow-up pickers and a quick chip (`tomorrow` … `month`)        | PatientDrawer                      |
| `<d>-photos` / `<d>-photos-input`                                   | First photos drop zone and its file input                        | PatientDrawer                      |

### Contact editor (shared, launch L-35)

The contact editor is one `ContactEditor` (`shared/forms/ContactEditor/`), a child drawer over New
lead or the lead drawer; `<c>` is `contact-editor`. Its steps are `identity` and `preferences`
(`<c>-step-<id>`, as the drawer steps above). Rows count from 1.

| Test ID                                                                 | Element                                                            | Source                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| `<c>`                                                                   | The editor (`role="dialog"`, "Edit contact")                       | `shared/forms/ContactEditor/` |
| `<c>-close` / `<c>-done`                                                | The floating × · "Done" (the only way anything is kept)            | ContactEditor                 |
| `<c>-band` / `<c>-new-lead` / `<c>-new-appointment` / `<c>-new-patient` | The tinted band and its "+ Lead" · "+ Appointment" · "+ Patient"   | ContactEditor                 |
| `<c>-id` / `<c>-name`                                                   | The record's ID chip (click to copy) · Name                        | ContactEditor                 |
| `<c>-mobile-<n>` / `<c>-primary-<n>` / `<c>-whatsapp-<n>`               | A number, its "★ Primary" / "☆ Set primary", its WhatsApp checkbox | ContactEditor                 |
| `<c>-remove-number-<n>` / `<c>-add-number`                              | "×" (two numbers or more) · "+ Add number"                         | ContactEditor                 |
| `<c>-add-instagram` / `<c>-handle-<n>` / `<c>-add-handle`               | "+ Instagram" · a handle · "+ Add handle"                          | ContactEditor                 |
| `<c>-channel-<channel>`                                                 | Default channel — `whatsapp`, `call`, `sms`, `instagram`           | ContactEditor                 |
| `<c>-preferences-<slug>`                                                | A preference — `noCalls` … `textFirst`; a custom one `custom-<n>`  | ContactEditor                 |
| `<c>-custom` / `<c>-custom-input`                                       | "+ Custom" and its "Type a preference" field                       | ContactEditor                 |
| `<c>-linked`                                                            | "Linked to … · channels and preferences reused" with its Undo      | ContactEditor                 |

### Offering drawer (Offerings room, launch L-30c)

New offering and Edit offering are one `OfferingDrawer`; `<d>` is `offering-drawer`. Its steps
are `main` and `time`, plus `details` while an offer that has not ended names the offering. A
chip group's chips are `<group>-<value>` (`offering-drawer-category-lhr`,
`offering-drawer-branches-all`), a swatch is `<d>-colour-<tone>`, and a stepper's parts are
`<field>-decrease` / `-increase` / `-quick-<value>` (`offering-drawer-sessions-quick-6`).

| Test ID                                                     | Element                                                                        | Source                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| `<d>-name` / `<d>-category` / `<d>-colour` / `<d>-branches` | Step 1: Name, Category chips, Colour swatches, Available at (several branches) | `offerings/components/OfferingDrawer/` |
| `<d>-price` / `<d>-offer-price` / `<d>-sessions`            | Price and Offer price (₹ fields), the Sessions stepper                         | OfferingDrawer                         |
| `<d>-gst-rate` / `<d>-gst`                                  | GST rate ("%") and the Inclusive / Exclusive toggle                            | OfferingDrawer                         |
| `<d>-floor-toggle` / `<d>-floor`                            | Lowest price toggle (`floor` ability) and its ₹ field while Shown              | OfferingDrawer                         |
| `<d>-billed-today` / `<d>-offer-<offerId>`                  | "Billed today" and one "Offers on this" box                                    | OfferingDrawer                         |
| `<d>-duration` / `<d>-validity`                             | Duration and Validity steppers                                                 | OfferingDrawer                         |
| `<d>-search-terms` / `<d>-description` / `<d>-status`       | Search terms, Description, the Status toggle                                   | OfferingDrawer                         |
| `<d>-skeleton`                                              | Edit offering while a deep-linked offering loads                               | OfferingDrawer                         |

### Offer drawer (Offerings room, launch L-30d)

New offer and Edit offer are one `OfferDrawer`; `<o>` is `offer-drawer`. Its steps are `offer`,
`where` and `notes`. The Type chips are `<o>-kind-<kind>` (`percent`, `amount`, `fixed`, `extra`),
a swatch is `<o>-colour-<tone>`, the Offerings picker's options `<o>-offerings-option-<offeringId>`
(its list `<o>-offerings-panel`), and a stepper's quick picks `<o>-value-quick-<value>`. The Offers
tab's rows add `offers-row-action-edit` / `-pause` / `-resume` beside `-delete`.

| Test ID                                                           | Element                                                                | Source                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| `<o>-name` / `<o>-code` / `<o>-kind` / `<o>-value` / `<o>-colour` | Step 1: Name, Code, Type chips, the value (stepper or ₹ field), Colour | `offers/components/OfferDrawer/` |
| `<o>-offerings` / `<o>-branches`                                  | Step 2: the Offerings picker, Branches chips (several branches)        | OfferDrawer                      |
| `<o>-starts` / `<o>-ends`                                         | Starts and Ends date pickers (empty = "Now" / "no end")                | OfferDrawer                      |
| `<o>-preview-<offeringId>`                                        | One picked offering's preview box ("₹1,200 → ₹1,080")                  | OfferDrawer                      |
| `<o>-note` / `<o>-status`                                         | Step 3: Note and the Live / Paused toggle                              | OfferDrawer                      |
| `<o>-skeleton`                                                    | Edit offer while a deep-linked offer loads                             | OfferDrawer                      |

### Stacked New offering (shared, launch L-30e)

The Invoice drawer's line picker stacks one `OfferingQuickCreate` (component state, no URL); `<n>` is
`offering-quick-create` and its steps are `offering`, `details` and `payment`. The Category chips are
`<n>-category-<category>`.

| Test ID                                                    | Element                                                                 | Source                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| `<n>-name` / `<n>-duration` / `<n>-category` / `<n>-price` | Name (prefilled from the picker), the Duration stepper, Category, Price | `shared/components/OfferingQuickCreate/` |

### User drawer (Users room, launch L-31b)

New user and Edit user are one `UserDrawer` (`pages/organization/$organizationSlug/users/components/UserDrawer/`);
`<d>` is `user-drawer`. Its steps are `profile` and `hours`. A chip group's chips are
`<group>-<value>` (`user-drawer-roles-front_desk`, `user-drawer-days-sat`, `user-drawer-colour-sky`).
The Team's toolbar and table carry the shared ids with the `tableId` `users-team` (`users-team-toolbar`,
`users-team-search`, `users-team-filters-trigger`, `users-team-new-user`, `users-team-fab`,
`users-team-table-row`); the room's tabs are `users-tabs` and `users-tab-<tab>`.

| Test ID                                        | Element                                                             | Source             |
| ---------------------------------------------- | ------------------------------------------------------------------- | ------------------ |
| `<d>-name` / `<d>-mobile` / `<d>-email`        | Step 1's Name, Mobile ("+91") and Email (read-only once joined)     | `UserDrawerFields` |
| `<d>-colour` / `<d>-colour-<tone>`             | Colour swatches (`DrawerSwatches`); the picked one shows initials   | `UserDrawerFields` |
| `<d>-roles` / `<d>-access` / `<d>-branches`    | Roles chips (pick order), "Gets access to", Branches (several only) | `UserDrawerFields` |
| `<d>-days` / `<d>-from` / `<d>-to`             | Step 2's Days chips and the From / To time pickers                  | `UserDrawerFields` |
| `<d>-commission` / `<d>-commission-quick-<n>`  | Commission stepper (`-decrease`, `-increase`) and its quick picks   | `UserDrawerFields` |
| `<d>-status` / `<d>-invitation` / `<d>-resend` | Status toggle; an invited member's expiry and "Resend invitation"   | `UserDrawerFields` |
| `<d>-delete` · `users-team-row-action-leave`   | On your own drawer and row (never the owner's): "Leave clinic"      | `UserDrawer`       |

### Roles & access (Users room, launch L-31c)

The family-shared `RolesAccess` (`pages/organization/$organizationSlug/users/shared/components/RolesAccess/`).
Its toolbar carries the shared ids with the `tableId` `users-roles` (`users-roles-toolbar`,
`users-roles-new-role`, `users-roles-fab`). `<section>` is a matrix section (`leads` … `users`),
`<action>` one of `view`, `create`, `edit`, `delete`, `<ability>` a special permission (`disc` … `perms`).

| Test ID                                             | Element                                                            | Source          |
| --------------------------------------------------- | ------------------------------------------------------------------ | --------------- |
| `users-roles-list` / `users-roles-item-<role>`      | The role list and one role (`aria-current` when on screen)         | `RoleList`      |
| `users-role-page` / `users-roles-back`              | The role page; "Back to roles" (a phone only)                      | `RolePage`      |
| `users-role-name`                                   | A custom role's name box (Enter or leaving it renames)             | `RolePage`      |
| `users-role-copy` / `users-role-copy-option-<role>` | "Copy access from" and one of its roles                            | `RolePage`      |
| `users-role-preview` / `users-role-delete`          | "Preview as <role>"; "Delete role" (a custom role nobody holds)    | `RolePage`      |
| `users-role-person`                                 | A "People with this role" pill — the member's drawer over the page | `RolePage`      |
| `users-role-matrix`                                 | The matrix's bordered, sideways-scrolling box                      | `RoleMatrix`    |
| `users-role-matrix-<section>`                       | One section row                                                    | `RoleMatrix`    |
| `users-role-matrix-<section>-<action>`              | One box (`role="checkbox"`, named "Front desk can view · Leads")   | `RoleMatrix`    |
| `users-role-matrix-<section>-row`                   | The Row pill ("Full" / "Some" / "None")                            | `RoleMatrix`    |
| `users-role-ability-<ability>`                      | A special permission's switch card (`role="switch"`)               | `RoleAbilities` |
| `users-role-description`                            | A custom role's description box (Settings' role dialog, relocated) | `RolePage`      |
| `users-role-workspace` / `users-role-code-<code>`   | Workspace permissions; one clinozy-be code's switch card (L-31f)   | `RoleWorkspace` |

### Branch drawer (Users room, launch L-31d)

New branch and Edit branch are one `BranchDrawer`
(`pages/organization/$organizationSlug/users/branches/components/BranchDrawer/`); `<d>` is
`branch-drawer`. Its steps are `place`, `contact` and `people`. A chip group's chips are
`<group>-<value>` (`branch-drawer-days-sun`, `branch-drawer-colour-mint`). The list's toolbar and
table carry the shared ids with the `tableId` `users-branches` (`users-branches-toolbar`,
`users-branches-filters-trigger`, `users-branches-new-branch`, `users-branches-fab`,
`users-branches-table-row`).

| Test ID                                             | Element                                                                 | Source               |
| --------------------------------------------------- | ----------------------------------------------------------------------- | -------------------- |
| `<d>-name` / `<d>-colour` / `<d>-colour-<tone>`     | Step 1's Name and the Colour swatches                                   | `BranchDrawerFields` |
| `<d>-main` / `<d>-status`                           | The Main branch and Status toggles (`role="switch"`)                    | `BranchDrawerFields` |
| `<d>-line1` / `<d>-line2` / `<d>-area` / `<d>-city` | The address fields                                                      | `BranchDrawerFields` |
| `<d>-pin` / `<d>-state`                             | PIN code (digits only) and State                                        | `BranchDrawerFields` |
| `<d>-phone` / `<d>-email` / `<d>-gstin`             | Step 2's Phone ("+91"), Email and GSTIN (upper-cased)                   | `BranchDrawerFields` |
| `<d>-days` / `<d>-opens` / `<d>-closes`             | The Days chips and the Opens / Closes time pickers                      | `BranchDrawerFields` |
| `<d>-team` / `<d>-team-option-<profile id>`         | Step 3's Team picker and one person in it                               | `BranchDrawerFields` |
| `<d>-default-<role>`                                | A default person's picker (`doctor`, `desk`, `therapist`, `pharmacist`) | `BranchDrawerFields` |

### Patient file (launch L-42)

`pages/organization/$organizationSlug/patients/$patientId/`: the layout is `patient-file-layout`
(`data-activity`: `open` · `closed`). `<s>` is a section slug (`timeline` · `overview` · `visits` ·
`prescriptions` · `treatments` · `images` · `reports` · `invoices` · `payments` · `packages` ·
`notes`); `<item>` an Add-to-record item (`prescription` · `treatment` · `invoice` · `payment` ·
`photo` · `appointment` · `report` · `note`).

| Test ID                                                                                     | Element                                                                                                                                       | Source                                            |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `patient-file-back`                                                                         | Back to the Patients list (Esc)                                                                                                               | `components/PatientFileBar/`                      |
| `patient-file-tab-<s>`                                                                      | A pinned section tab (`role="tab"`); the open unpinned one carries its dot                                                                    | `components/PatientFileBar/`                      |
| `patient-file-add` · `patient-file-start-visit` · `patient-file-activity`                   | "+" (Add to record) · "Start visit" · the Activity toggle (`aria-pressed`, unread badge)                                                      | `components/PatientFileBar/`                      |
| `patient-file-sections` · `patient-file-sections-panel`                                     | The folder button · the section popover (a bottom sheet on a phone)                                                                           | `components/PatientSectionsPopover/`              |
| `patient-file-sections-tile-<s>` · `patient-file-sections-pin-<s>`                          | A section tile (`aria-current` when open) · its pin (`aria-pressed`)                                                                          | `components/PatientSectionsPopover/`              |
| `patient-file-add-menu` · `patient-file-add-menu-<item>`                                    | The Add-to-record menu ("+" and a section's "⌄") · one item                                                                                   | `shared/components/PatientAddMenu/`               |
| `patient-file-activity-column`                                                              | The Activity column's card (the `chat-…` ids inside)                                                                                          | `components/PatientActivity/`                     |
| `patient-rail`                                                                              | The rail (`<aside>`, named by the patient)                                                                                                    | `components/PatientRail/`                         |
| `patient-rail-copy-id` · `patient-rail-edit`                                                | "#3508" (copies the ID) · Edit contact (Patients edit only)                                                                                   | `components/PatientRail/`                         |
| `patient-rail-book` · `patient-rail-collect` · `patient-rail-feedback`                      | Up next: Book / Reschedule · Collect · the Feedback row                                                                                       | `components/PatientRail/`                         |
| `patient-rail-due` · `patient-rail-due-eye`                                                 | What they owe ("₹ ••••" while masked) · its eye (`aria-pressed` when shown)                                                                   | `components/PatientRail/`                         |
| `patient-section-<s>`                                                                       | A section's root (`<section>`, named by its title)                                                                                            | `<s>/`                                            |
| `patient-section-primary` · `patient-section-more`                                          | The split "New …" · its "⌄" (the Add menu for this patient)                                                                                   | `shared/components/PatientSection/`               |
| `patient-drawer`                                                                            | Edit patient — `/patients/$patientId/edit` over the `?from=` section                                                                          | `shared/components/PatientDrawer/`                |
| `patient-photos` · `patient-photos-input`                                                   | Photos: the drop zone (dashed outline while files hover) · the hidden file picker                                                             | `images/` · `shared/hooks/usePatientPhotoUpload/` |
| `patient-photos-tab-<album>` · `patient-photos-visit-filter` · `patient-photos-size-<size>` | The album tabs (`general` · `private` · `lhr`) · the visit filter · S / M / L (`small` · `medium` · `large`)                                  | `images/components/PhotoToolbar/`                 |
| `patient-photos-day` · `patient-photo-tile` · `patient-photo-edit` · `patient-photo-delete` | A day group · a tile (its button "Open <name>") · its Edit details · its Delete photo                                                         | `images/components/PhotoGrid/`                    |
| `patient-photos-load-more` · `patient-photos-empty`                                         | "Load more · 4 left" · "No photos in General yet"                                                                                             | `images/`                                         |
| `patient-photo-viewer` · `patient-photo-viewer-<part>`                                      | The photo viewer (`role="dialog"`); parts `stage` · `previous` · `next` · `zoom-out` · `zoom-reset` · `zoom-in` · `edit` · `delete` · `close` | `images/$imageId/components/PhotoViewer/`         |
| `patient-photo-details` · `patient-photo-details-<field>`                                   | Photo details (the shared drawer's root); fields `name` · `date` · `album-<album>` · `body-part-<part>` · `visit-<id or none>`                | `images/$imageId/edit/`                           |

### Patient file records (launch L-45)

The record drawers are `RecordDrawer`s — their parts take the Record drawer ids above, `<d>`
being the root: `rx-drawer`, `treatment-drawer`, `report-drawer`, `report-view`,
`package-drawer`. Their dialog routes render nothing; the section opens them (Add package has no
route). Paths are under `pages/organization/$organizationSlug/patients/$patientId/`.

| Test ID                                                                          | Element                                                                                                         | Source                                          |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `rx-drawer-date` · `rx-drawer-doctor`                                            | New / Edit prescription (1040): step 1's Date and Doctor                                                        | `prescriptions/components/PrescriptionDrawer/`  |
| `rx-drawer-quick-fill-<id>`                                                      | Quick fill: `print` (edit) · `repeat` (new) · the kits `hairFall` · `postPeel` · `pigmentation`                 | PrescriptionDrawer                              |
| `rx-quick-line` · `rx-quick-line-<part>`                                         | The medicines' quick line (Quick line ids below)                                                                | PrescriptionDrawer                              |
| `rx-items` · `rx-items-<part>`                                                   | The medicines (Items field ids; columns `medicineName` · `dose` · `when` · `where` · `qty`)                     | PrescriptionDrawer                              |
| `rx-items-dose-<time>` · `rx-items-dose-sos`                                     | A line's dose taps (`morning` · `afternoon` · `night`) · SOS                                                    | `PrescriptionDrawer/rx-item-cells.tsx`          |
| `rx-items-when-<meal>` · `rx-items-when-more`                                    | A line's meal chips (`before` · `after`) · "More timings"                                                       | `PrescriptionDrawer/rx-item-cells.tsx`          |
| `rx-drawer-advice` · `rx-drawer-lab-report` · `rx-drawer-procedure-today`        | Step 3's Notes, Lab report, Today's procedure                                                                   | PrescriptionDrawer                              |
| `rx-print-preview` · `rx-print-preview-close` · `rx-print-preview-print`         | The print preview (`$prescriptionId`, 820) · Close · "Print / Save PDF"                                         | `prescriptions/components/RxPrintPreview/`      |
| `treatment-drawer-template-<template>`                                           | The Type switch (`skin` · `dental` · `physio` · `gynac` · `general`)                                            | `treatments/components/TreatmentDrawer/`        |
| `treatment-drawer-quick-fill-<id>`                                               | Quick fill: `check-in` (edit — the stacked check-in drawer) · `next` (new) · `package-<packageId>`              | TreatmentDrawer                                 |
| `treatment-drawer-name` · `-name-quick` · `-session` · `-doctor` · `-therapist`  | New / Edit treatment (680), step 1                                                                              | TreatmentDrawer                                 |
| `treatment-drawer-<param>` · `-areas` · `-tooth-<fdi>` · `-anaesthesia` · `-lmp` | Step 2 by template (a param kebab-cased: `skin-type`, `pain-before`)                                            | `TreatmentDrawer/treatment-template-fields.tsx` |
| `treatment-drawer-remark` · `-call` · `-feedback`                                | Step 3: Remark, the Aftercare call chips, "Feedback on this treatment"                                          | TreatmentDrawer                                 |
| `report-drawer-type-<type>` · `report-drawer-name` · `report-drawer-date`        | Upload report (560): Type (`lab` · `scan` · `consent` · `other`), Name, Date                                    | `reports/components/ReportDrawer/`              |
| `report-drawer-file` · `report-drawer-file-input` · `report-drawer-note`         | The File drop zone · its hidden picker · Note                                                                   | ReportDrawer                                    |
| `report-view-<field>`                                                            | Report view (560, read only; "Download" is `report-view-save`): `type` · `date` · `added-by` · `file` · `notes` | `reports/components/ReportView/`                |
| `package-drawer-offering-<offeringId>` · `package-drawer-empty`                  | Add package (560): one chip per multi-session offering · "No multi-session offerings yet"                       | `packages/components/AddPackageDrawer/`         |

### Patient file feedback (launch L-43)

Clinical notes (`overview/`) and the check-in and review drawers over the file. The drawers
and the picker are `RecordDrawer`s — their parts take the Record drawer ids above, `<d>` being
the root: `check-in-drawer`, `review-drawer`, `log-feedback-picker`. Their routes render the
section behind and the drawer. Paths are under
`pages/organization/$organizationSlug/patients/$patientId/`.

| Test ID                                                                                | Element                                                                                  | Source                                   |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| `clinical-card-<field>`                                                                | A chip card: `complaints` · `diagnosis` · `treatment-suggestions` · `future-suggestions` | `overview/components/ClinicalChipCard/`  |
| `clinical-card-<field>-chip` · `-new` · `-input`                                       | Its chips (`data-fresh` when added this visit) · the "1 new" pill · the dashed input     | ClinicalChipCard                         |
| `feedback-card` · `-toggle` · `-log`                                                   | The Feedback card · its header (expands) · "Log feedback ⌄"                              | `overview/components/FeedbackCard/`      |
| `feedback-card-type-<type>`                                                            | A type chip: `all` · `visit` · `treatment` · a review source                             | FeedbackCard                             |
| `feedback-card-item` · `-item-edit` · `-item-remove`                                   | A card · its Edit · Remove                                                               | `FeedbackCard/FeedbackItemCard.tsx`      |
| `feedback-card-item-log-action` · `-item-action-<kind>` · `-item-action`               | "Log action ⌄" · a follow-up (`doctor_called` …) · the logged "✓ …" pill                 | `FeedbackCard/FeedbackItemCard.tsx`      |
| `feedback-card-previous` · `-next` · `-load-more` · `-empty`                           | The carousel's ‹ › · "Load more" · "No feedback yet"                                     | FeedbackCard                             |
| `log-feedback-picker-check-in-visit` · `-treatment-<treatmentId>` · `-review-<source>` | Log feedback (560, stacked): Consultation · "After …" · a review source                  | `overview/components/LogFeedbackPicker/` |
| `check-in-drawer-feel-<feel>` · `-score-<n>` · `-now`                                  | Visit / Aftercare check-in (680), step 1: the feel chips, the score 1–10, In their words | `shared/components/CheckInDrawer/`       |
| `check-in-drawer-followed-<followed>` · `-details`                                     | Step 2: Followed the advice, Details                                                     | CheckInDrawer                            |
| `check-in-drawer-plan` · `-offerings`                                                  | Step 3: Plan, Add to offering suggestions (a Picker: `-offerings-option-<offeringId>`)   | CheckInDrawer                            |
| `review-drawer-where-<source>` · `-rating-<n>`                                         | Log a review (560), step 1: Where, Rating 5 … 1                                          | `shared/components/ReviewDrawer/`        |
| `review-drawer-link` · `-files` · `-files-input` · `-attached` · `-text`               | Link · the drop zone · its picker · a saved review's files · What they said              | ReviewDrawer                             |

### Patient file sections (launch L-43b)

The section tables, the package cards and Team notes. Each table is the shared `DataTable` with
`<t>` its id — `patient-visits` · `patient-prescriptions` · `patient-treatments` ·
`patient-reports` · `patient-invoices` · `patient-payments` — so its parts take the Data table
ids above (`<t>-table`, `<t>-table-row`, `<t>-table-select-all`, `<t>-table-bulk-export`,
`<t>-columns-trigger` …). Paths are under
`pages/organization/$organizationSlug/patients/$patientId/`.

| Test ID                                                  | Element                                                                    | Source                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| `patient-prescriptions-row-action-<id>`                  | A prescription's `print` · `preview` · `copy` · `sell` · `edit` · `delete` | `prescriptions/hooks/usePrescriptionRowActions/` |
| `patient-treatments-row-action-<id>`                     | A treatment's `check-in` · `copy` · `edit` · `delete`                      | `treatments/hooks/useTreatmentRowActions/`       |
| `patient-reports-row-action-<id>`                        | A report's `open` · `delete`                                               | `reports/PatientReportsPage.tsx`                 |
| `patient-invoices-row-action-<id>`                       | An invoice's `print` · `preview` · `pay` · `edit` · `delete`               | `invoices/hooks/useInvoiceRowActions/`           |
| `patient-package-<packageId>` · `-use` · `-book`         | A package card · "Use a session" · "Book next"                             | `packages/PatientPackagesPage.tsx`               |
| `patient-notes-input` · `patient-notes-add`              | Team notes' composer · "Add note"                                          | `notes/PatientNotesPage.tsx`                     |
| `patient-note-<noteId>` · `patient-note-delete-<noteId>` | A note's card · its × "Delete note"                                        | `notes/PatientNotesPage.tsx`                     |

### Patient file Overview (launch L-46)

The default section's bento and activity timeline. `<c>` is a card — `clinical` · `visits` ·
`photos` · `packages` · `prescriptions` · `treatments` · `billing` · `reports` · `notes`. Paths
are under `pages/organization/$organizationSlug/patients/$patientId/timeline/components/`.

| Test ID                                                       | Element                                                                                                                 | Source                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `overview-bento`                                              | The grid of cards                                                                                                       | `OverviewBento/OverviewBento.tsx`  |
| `overview-card-<c>` · `-open` · `-new` · `-row` · `-empty`    | A card · "Open <card>" · its "New …" · a listed record · its empty line                                                 | `OverviewBento/bento-card.tsx`     |
| `overview-card-visits-book` · `overview-card-photos-upload`   | Visits' "Book" / "Reschedule" · Photos' "Upload"                                                                        | `OverviewBento/`                   |
| `overview-card-photos-thumb` · `overview-card-packages-use`   | A photo (opens its album) · a package's "Use session"                                                                   | `OverviewBento/`                   |
| `overview-card-prescriptions-latest`                          | The latest prescription                                                                                                 | `OverviewBento/bento-care.tsx`     |
| `overview-card-billing-eye` · `overview-card-billing-collect` | Show / Hide amounts (`aria-pressed`) · "Collect payment"                                                                | `OverviewBento/bento-files.tsx`    |
| `overview-smart-note` · `overview-smart-note-add`             | The smart note · its "Add"                                                                                              | `OverviewBento/bento-clinical.tsx` |
| `overview-note-input` · `overview-note-post`                  | Team notes' composer · "Post"                                                                                           | `OverviewBento/bento-files.tsx`    |
| `overview-activity` · `overview-activity-filter-<kind>`       | The activity card · a filter chip (`all` · `visit` · `rx` · `treat` · `inv` · `pay` · `photo` · `note`; `aria-pressed`) | `ActivityTimeline/`                |
| `overview-activity-row`                                       | A row (`data-kind`) — a record, or a day's photos                                                                       | `ActivityTimeline/`                |

### Patient file visit flow (launch L-49)

`timeline?visit=open` while the patient has an open visit (D18): the flow takes the Overview's
place. The file bar's `patient-file-start-visit` starts one; its "Visit in progress · Resume"
pill returns to it. Paths are under `…/timeline/components/VisitFlow/`.

| Test ID                                                   | Element                                                                           | Source           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------- |
| `visit-flow` · `visit-flow-pause` · `visit-flow-complete` | The flow · "Pause" (back to the Overview, the visit open) · "✓ Complete visit"    | `VisitFlow.tsx`  |
| `visit-flow-step-<step>`                                  | A step card (`checks` · `rx` · `treatment` · `invoice` · `collect`; `data-state`) | `VisitFlow.tsx`  |
| `visit-flow-check-<check>`                                | A safety check tile (`consent` · `photos` · `allergies`; role `checkbox`)         | `flow-steps.tsx` |
| `visit-flow-kit` · `visit-flow-write-rx`                  | A one-tap Rx kit (`data-kit`) · "Write prescription"                              | `flow-steps.tsx` |
| `visit-flow-repeat` · `visit-flow-new-treatment`          | "⚡ Repeat · … · session n" · "New treatment"                                     | `flow-steps.tsx` |
| `visit-flow-create-invoice` · `visit-flow-custom-invoice` | "Create invoice from visit" · "Custom invoice"                                    | `flow-steps.tsx` |
| `visit-flow-collect-<mode>` · `visit-flow-share`          | Collect the oldest due (`upi` · `cash` · `card`) · "Share Rx, invoice & photos"   | `flow-steps.tsx` |

## Quick line (shared, launch L-45)

`shared/components/QuickLine/`: one line of shorthand that fills a list, with Browse — a
grammar-agnostic shell (the screen brings the parser; the item lines share `useQuickLineTerms`:
`20` qty · `+2` free · `@180` rate · `10%` discount). `<q>` is its root id (`rx-quick-line`,
`invoice-drawer-quick-line`, and the purchase drawers' `purchase-order-drawer-quick-line` and
`stock-purchase-drawer-quick-line` — their Items quick line, Low stock chips and Browse).

| Test ID                                                     | Element                                                                                     | Source                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| `<q>` · `<q>-input`                                         | The row · its input (a combobox over the matches)                                           | `shared/components/QuickLine/`  |
| `<q>-matches` · `<q>-option` · `<q>-typed` · `<q>-no-match` | The matches list · a match · the typed name ("Not in the list · add as typed") · "No match" | QuickLine                       |
| `<q>-frequent`                                              | The frequent chips under the row                                                            | QuickLine                       |
| `<q>-browse` · `<q>-browse-panel`                           | "Browse" · its panel                                                                        | QuickLine                       |
| `<q>-browse-group-<id>` · `<q>-browse-tile`                 | A group button (`aria-pressed`) · a tile with its stepper                                   | `QuickLine/QuickLineBrowse.tsx` |
| `<q>-browse-new` · `<q>-browse-done`                        | "Add new" field · "Done"                                                                    | `QuickLine/QuickLineBrowse.tsx` |

A drawer's upload field (`shared/components/DrawerField/drawer-files-field.tsx`) is `<z>` with
its hidden picker `<z>-input` — `report-drawer-file`, `patient-drawer-photos`.

## Items field (shared, launch L-17a)

A drawer's item rows (invoice lines, sale / PO / purchase items, Rx medicines, Mode · Amount) are
an `ItemsField`; the screen passes its own root id (`testId`, e.g. `invoice-items`, default
`items-field`). Every row repeats the same ids — scope a spec to one row with `nth()` /
`within(row)`. Below, `<f>` is the root id and `<col>` a column id.

| Test ID                                      | Element                                                                    | Source                             |
| -------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| `<f>`                                        | Field root (the optional quick line above, the frame, the array's message) | `shared/forms/ItemsField/`         |
| `<f>-table`                                  | The rows (`role="table"`, named by the field's label)                      | ItemsField                         |
| `<f>-header`                                 | 34px column header row (not rendered on a phone)                           | ItemsField                         |
| `<f>-row`                                    | One item row (cells carry `data-column="<col>"`)                           | ItemsField                         |
| `<f>-remove` / `<f>-note`                    | A row's × ("Remove row") · its dashed note input                           | ItemsField                         |
| `<f>-add` / `<f>-total`                      | Footer "+ <add label>" · the total at the inline end                       | ItemsField                         |
| `<f>-error`                                  | The array's own message ("Add at least one item"), `role="alert"`          | ItemsField                         |
| `<f>-<col>`                                  | A bound cell's control: input, stepper count, or the picker trigger        | `ItemsField/items-field-cells.tsx` |
| `<f>-<col>-decrease` / `<f>-<col>-increase`  | The quantity stepper's "−" / "+"                                           | `ItemsField/items-field-cells.tsx` |
| `<f>-<col>-panel` / `<f>-<col>-option-<key>` | A picker cell's list and one option (the shared picker ids)                | `shared/components/Picker/`        |

## Clinic print templates (added 2026-10-03, L-22)

| Test ID                    | Element                                                                          | Source                                               |
| -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `print-root`               | Print-only host `printDocument()` mounts at the end of `<body>` until afterprint | `shared/components/PrintTemplate/print-document.ts`  |
| `invoice-print`            | A4 invoice / sale sheet                                                          | `shared/components/PrintTemplate/InvoicePrint/`      |
| `invoice-print-items`      | Invoice items table (lines + totals row)                                         | `shared/components/PrintTemplate/InvoicePrint/`      |
| `invoice-print-summary`    | Payment Summary (total, overall discount, bill, balance due)                     | `shared/components/PrintTemplate/InvoicePrint/`      |
| `prescription-print`       | A4 prescription sheet                                                            | `shared/components/PrintTemplate/PrescriptionPrint/` |
| `prescription-print-items` | Medicines & Dosage table                                                         | `shared/components/PrintTemplate/PrescriptionPrint/` |
| `print-footer`             | Sheet footer: thank-you line, branch phone, GSTIN                                | `shared/components/PrintTemplate/PrintTemplate.tsx`  |

## Chat column (shared, launch L-34)

The conversation column of the lead drawer and the patient file (`shared/components/ChatColumn/`).
Scope a spec to `chat-column` — a room can show one beside its list.

| Test ID                                     | Element                                                                                                           | Source                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `chat-column`                               | Column root (`<section>`, named by the contact)                                                                   | `ChatColumn/ChatColumn.tsx` |
| `chat-column-header`                        | Contact header: avatar, name, phone, contact-card trigger                                                         | `ChatColumn/ChatColumn.tsx` |
| `chat-thread`                               | Thread (`role="log"`, "Messages"), newest at the bottom                                                           | `ChatColumn/ChatThread/`    |
| `chat-thread-divider`                       | "Lead created · … · via …" / "Patient · chat only · no lead"                                                      | `ChatColumn/ChatThread/`    |
| `chat-history-chip`                         | One contact-history line (a button when the host opens records)                                                   | `ChatColumn/ChatThread/`    |
| `chat-system-line`                          | System line ("Status → Contacted (first reply)")                                                                  | `ChatColumn/ChatThread/`    |
| `chat-bubble`                               | One message (`data-kind`: `in` · `out` · `call` · `note`)                                                         | `ChatColumn/ChatThread/`    |
| `chat-bubble-retry`                         | "Retry" beside "Not sent"                                                                                         | `ChatColumn/ChatThread/`    |
| `chat-starter`                              | One starter chip in the empty card (`empty-state`, `data-variant="card"`)                                         | `ChatColumn/ChatThread/`    |
| `chat-composer`                             | Composer (`data-mode` = the selected tab)                                                                         | `ChatColumn/ChatComposer/`  |
| `chat-modes` · `chat-mode-<mode>`           | "Send via" tab list · one tab (`whatsapp` · `instagram` · `call` · `note`)                                        | `ChatColumn/ChatComposer/`  |
| `chat-textarea` · `chat-send`               | Message box · its Send button                                                                                     | `ChatColumn/ChatComposer/`  |
| `chat-suggest` · `chat-book`                | Suggestions toggle · "Book an appointment"                                                                        | `ChatColumn/ChatComposer/`  |
| `chat-suggestions` · `chat-suggestion-chip` | Suggestions popover (`role="dialog"`) · one smart suggestion                                                      | `ChatColumn/ChatComposer/`  |
| `chat-template-<kind>`                      | One template row (`greeting` · `price` · `slots` · `location` · `reminder` · `aftercare` · `followUp` · `review`) | `ChatColumn/ChatComposer/`  |
| `chat-fill-in`                              | "Fill in" row for a picked template's placeholders                                                                | `ChatColumn/ChatComposer/`  |
| `chat-mode-mismatch`                        | "Anaya wrote on Instagram · Switch" (the contact wrote on another channel)                                        | `ChatColumn/ChatComposer/`  |

## Offering suggestions (shared, launch L-37b)

The plan card of the appointment form and the patient file (`shared/components/OfferingSuggestions/`).
A row's status picker carries the shared picker ids; Remove opens the shared reason confirm
(`confirm-*`, reasons `mistake` · `duplicate` · `plan-changed` · `other`).

| Test ID                         | Element                                                                   | Source                    |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------- |
| `offering-suggestions`          | Card root (`<section>`, "Offering suggestions") — a size container        | `OfferingSuggestions.tsx` |
| `offering-suggestions-toggle`   | Header: title, sub line, chevron (`aria-expanded`)                        | `OfferingSuggestions.tsx` |
| `offering-suggestions-prices`   | The 32px price eye ("Show prices" / "Hide prices", `aria-pressed`)        | `OfferingSuggestions.tsx` |
| `offering-suggestions-row`      | One suggested offering (`data-status`): stepper, price, status, by, links | `SuggestionRows.tsx`      |
| `offering-suggestions-idea`     | One idea row with its "+ Add"                                             | `SuggestionRows.tsx`      |
| `offering-suggestions-add`      | The dashed "Add offering" (edit only)                                     | `OfferingSuggestions.tsx` |
| `offering-suggestions-purchase` | One "<first>’s last purchases" line                                       | `SuggestionTables.tsx`    |
| `offering-suggestions-activity` | One "Contact activity" line                                               | `SuggestionTables.tsx`    |

## Appointments room (launch L-36b, L-37)

`pages/organization/$organizationSlug/appointments/`. The toolbar and the Agenda also carry the
shared ids above with the `tableId` `appointments` (`appointments-toolbar`, `appointments-tab-agenda`,
`appointments-search`, `appointments-filters-trigger`, `appointments-table-row`). An Agenda day
header is its own row (`role="row"`, `data-slot="data-table-group"`) between the body rows.

| Test ID                                                                     | Element                                                                    | Source                                 |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| `appointments-today`                                                        | "Today" · "This week" · "This month" (`aria-pressed` on the current one)   | `components/AppointmentsToolbar/`      |
| `appointments-period-previous` · `-period-next` · `-period-label`           | Period arrows · the period's name                                          | `components/AppointmentsToolbar/`      |
| `appointments-day-group`                                                    | Agenda day header: date tile, "Today" / weekday, sub line, counts          | `components/AppointmentsAgenda/`       |
| `appointments-empty` · `appointments-book-one`                              | "No appointments here · book one" · its "book one" (Create only)           | `components/AppointmentsAgenda/`       |
| `appointments-quick-view`                                                   | Row eye — pins the booking card (not on a phone)                           | `components/AppointmentsAgenda/`       |
| `appointments-status-button`                                                | Row "Change status" button (Edit only; otherwise the status alone)         | `components/AppointmentsAgenda/`       |
| `appointments-status-popover`                                               | Change status popover (`role="dialog"`)                                    | `components/AppointmentStatusPopover/` |
| `appointments-status-option-<move>`                                         | One move — a status or `reschedule`; `aria-disabled` + reason when guarded | `components/AppointmentStatusPopover/` |
| `appointments-cancel-reason-<reason>` · `appointments-status-back`          | Cancel view: one reason · Back                                             | `components/AppointmentStatusPopover/` |
| `appointment-card`                                                          | Booking card (hover card, quick view, phone tap)                           | `components/AppointmentCard/`          |
| `appointment-card-next` · `-open` · `-move-<move>`                          | Card: next action · Open · Reschedule / Cancel                             | `components/AppointmentCard/`          |
| `appointments-filters-calendar` · `-filters-day`                            | Filters month calendar · one day (`aria-pressed` when picked)              | `components/AppointmentFilters/`       |
| `appointments-filters-upcoming` · `-filters-month-previous` · `-month-next` | "Upcoming (default)" · the month arrows                                    | `components/AppointmentFilters/`       |
| `appointments-filters-doctors`                                              | "Appointed to" doctor picker                                               | `components/DoctorPicker/`             |
| `appointments-filters-status-<value>`                                       | Status chip (`all` · `active` · a status)                                  | `components/AppointmentFilters/`       |
| `appointments-calendar`                                                     | A calendar's card (`data-view` = `day` · `week` · `month`)                 | `components/CalendarGrid/`             |
| `appointments-block`                                                        | A booking on a calendar — block, Month chip or popover row (`data-status`) | `components/CalendarBlock/`            |
| `appointments-day-column` · `appointments-now-line`                         | A day's column (`data-date`) · the 2px now line (today only)               | `components/CalendarGrid/`             |
| `appointments-day-slots`                                                    | The Day column's empty surface — a press books its slot (Create only)      | `components/CalendarGrid/`             |
| `appointments-day-header` · `appointments-day-doctors`                      | Day header (`md` and up) · its doctor picker                               | `components/AppointmentsDay/`          |
| `appointments-day-strip` · `-day-strip-option`                              | Phone Doctor strip (`role="radiogroup"`) · one pill (`role="radio"`)       | `components/AppointmentsDay/`          |
| `appointments-week-day`                                                     | A Week day header (`data-date`) — opens the day in Day                     | `components/AppointmentsWeek/`         |
| `appointments-month-cell` · `appointments-month-more`                       | A Month cell (`data-date`) · its "+<n> more"                               | `components/AppointmentsMonth/`        |
| `appointments-month-popover` · `appointments-month-open-day`                | The Month day popover (`role="dialog"`) · its "Open day"                   | `components/AppointmentsMonth/`        |

## Appointment form (shared, launch L-38)

`shared/forms/AppointmentForm/` on the record drawer: `new-appointment-drawer` (New, a stacked
booking) or `appointment-drawer` (Edit, Reschedule), with the drawer's derived ids (`<drawer>-title`,
`-close`, `-save` — `data-incomplete` while who, date or time is missing — `-dismiss`, `-summary`,
`-main`, `-aside`). The type, length and status chips carry `<id>-<value>`; the treatment, package
and doctor pickers the shared picker ids; Cancel visit and Delete photo the shared reason confirm.

| Test ID                                                                                | Element                                                                           | Source                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------- |
| `appointment-form`                                                                     | The form's sections (a size container — under 520px the fields stack)             | `AppointmentForm.tsx`       |
| `appointment-form-who-search` · `-who-hit` · `-who-create`                             | Person search · one hit · "+ Create contact “<query>”"                            | `WhoSection.tsx`            |
| `appointment-form-who-card` · `-who-mobile`                                            | The person's card · a new contact's "+91" mobile                                  | `WhoSection.tsx`            |
| `appointment-form-who-edit` · `-who-edit-name` · `-who-edit-mobile` · `-who-edit-save` | The inline Name · Mobile editor ("Edit" on the contact card) and its Save         | `WhoSection.tsx`            |
| `appointment-form-connected-lead` · `appointment-form-lead-option`                     | A "Connected lead" chip · a "Lead" radio (two or more open leads)                 | `WhoSection.tsx`            |
| `appointment-form-status` · `-status-<status>` · `-status-hint`                        | Visit status (Edit): the section · one tile (`data-step`) · the hint line         | `VisitStatusSection.tsx`    |
| `appointment-form-cancelled` · `-restore` · `-rescheduled`                             | Cancelled banner · its Restore · the "Rescheduled · was …" note                   | `VisitStatusSection.tsx`    |
| `appointment-form-plan` · `-copy` · `-rebook` · `-cancel-visit`                        | Plan flag · Copy (Rebook for a No-show) · Cancel visit                            | `VisitStatusSection.tsx`    |
| `appointment-form-details` · `-details-toggle`                                         | Step 1 Appointment (`data-open`) · its head                                       | `AppointmentFormBlocks.tsx` |
| `appointment-form-type` · `-treatment` · `-package` · `-package-as-treatment`          | Type chips · treatment picker · package radios · "Book as treatment"              | `AppointmentDetails.tsx`    |
| `appointment-form-doctor` · `-length` · `-reason` · `-notes`                           | Doctor picker · length chips · Reason · Notes                                     | `AppointmentDetails.tsx`    |
| `appointment-form-slot` · `-slot-toggle`                                               | Step 2 Date & time (`data-open`; locked after check-in) · its head                | `AppointmentFormBlocks.tsx` |
| `appointment-form-quick-<today\|tomorrow\|next-week>`                                  | Quick dates (`aria-pressed`)                                                      | `DateTimeStep.tsx`          |
| `appointment-form-calendar` · `-calendar-day` · `-calendar-previous` · `-next`         | Month calendar · one day (`data-day`, `aria-pressed`) · the month arrows          | `DateTimeStep.tsx`          |
| `appointment-form-slot-step` · `-slot-hour` · `-slot-time`                             | "30 min" · "15 min" · one hour row · one start (`data-time`; disabled when taken) | `DateTimeStep.tsx`          |
| `appointment-form-not-patient` · `-create-patient`                                     | Step 3 "Not a patient yet" · "Create patient record" (stacks `patient-quick-add`) | `PatientSections.tsx`       |
| `appointment-form-photos` · `-photos-check-in` · `-photos-upload`                      | Visit photos · "Check in now" · "Upload photos"                                   | `PatientSections.tsx`       |
| `appointment-form-photo` · `appointment-form-photo-delete`                             | One photo tile · its Delete                                                       | `PatientSections.tsx`       |
| `appointment-form-chat`                                                                | The chat column (Edit, `md` and up)                                               | `AppointmentForm.tsx`       |

---

## Invoice drawer (shared, launch L-40)

`shared/components/InvoiceDrawer/` on the record drawer, root `invoice-drawer` — New invoice, New
sale (Medical) and Edit invoice — with the drawer's derived ids (`invoice-drawer-title`, `-tag`,
`-close`, `-save`, `-delete`, `-dismiss`, `-badges`, `-footer`, `-header-strip`, `-footer-strip`),
the step ids (`invoice-drawer-step-<party|items|payment>` and its `-trigger`) and the quick-fill
chips (`invoice-drawer-quick-fill-<repeat|consultation|rx|print>`). The items and "Paid now" rows
are `ItemsField`s (ids above); the pickers carry the shared picker ids; Delete is the shared reason
confirm.

| Test ID                                                                   | Element                                                                   | Source                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| `invoice-drawer-type` · `-type-<clinic\|medical\|consultation>`           | The type switch (`role="radiogroup"`, New invoice only) · one type        | `InvoiceTypeSwitch.tsx`           |
| `invoice-drawer-branch` · `-patient` · `-customer` · `-team`              | Branch · Patient (the patient picker) · Medical's Customer · Team pickers | `InvoicePartyFields.tsx`          |
| `invoice-drawer-mobile`                                                   | A walk-in customer's mobile                                               | `InvoicePartyFields.tsx`          |
| `invoice-drawer-quick-line` · `-input` · `-option` · `-typed`             | The quick line ("corn 2 10%") · its input · a match · the typed line      | `shared/components/QuickLine/`    |
| `invoice-drawer-quick-line-browse` · `-browse-panel` · `-browse-tile`     | Browse · its panel (All · Often billed · groups) · one item               | `shared/components/QuickLine/`    |
| `invoice-drawer-items` · `-items-<item\|qty\|rate\|discount\|gst\|final>` | The item rows (`ItemsField`) · one cell's control                         | `InvoiceItemsField.tsx`           |
| `invoice-drawer-overall-discount` · `-decrease` · `-increase`             | Overall discount % — the shared stepper (Q-G7)                            | `InvoicePaymentFields.tsx`        |
| `invoice-drawer-payment-fill`                                             | "Paid now" quick fill: Full · Split · None                                | `InvoicePaymentFields.tsx`        |
| `invoice-drawer-paid-now` · `-paid-now-<mode\|amount>`                    | "Paid now" Mode · Amount rows (`ItemsField`)                              | `InvoicePaymentFields.tsx`        |
| `invoice-drawer-remark`                                                   | Remark — the one note that prints                                         | `InvoicePaymentFields.tsx`        |
| `invoice-drawer-totals` · `-totals-<subtotal\|discount-gst\|bill\|due>`   | The totals strip · one figure                                             | `InvoiceTotals.tsx`               |
| `invoice-preview` · `-close` · `-print`                                   | Print preview (820) · Close · "Print / Save PDF"                          | `shared/components/PrintPreview/` |

---

## Payments room (launch L-39)

`pages/organization/$organizationSlug/payments/`. Both tabs carry the shared toolbar and table ids
above — the ledger under the `tableId` `payments` (`payments-toolbar`, `payments-tab-ledger`,
`payments-tab-pending`, `payments-search`, `payments-filters-trigger`, `payments-pay`,
`payments-receive`, `payments-fab`, `payments-table-row`, `payments-row-action-<edit|delete>`,
`payments-table-bulk-export`), Pending under `payments-pending` (`payments-pending-add`,
`payments-pending-new-menu`, `payments-pending-table-row`,
`payments-pending-row-action-<settle|use-on-bill|edit|delete>` — `settle` reads Give back or
Got it back). Delete uses the shared confirm's ids.

| Test ID                                 | Element                                           | Source                               |
| --------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| `payments-day-close`                    | Ledger toolbar "Day close" (row 2 on a phone)     | `shared/components/PaymentsToolbar/` |
| `payments-pending-day-close`            | Pending toolbar "Day close"                       | `shared/components/PaymentsToolbar/` |
| `payments-pending-new-menu-option-give` | Add pending "⌄" menu: Give · `-option-take`: Take | `RoomToolbar/RoomPrimary/`           |

Receive payment (`receive-drawer`, L-39b) and Send payment (`pay-drawer`) carry the record
drawer's ids under their root (`-title`, `-tag`, `-badges`, `-quick-fill-<id>`, `-save`,
`-save-and-add`, `-delete`, `-step-<id>`); their fields:

| Test ID                                                                      | Element                                                                 | Source                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| `receive-drawer-branch-<branchId>`                                           | Branch chip (two or more open branches)                                 | `components/ReceivePaymentDrawer/` |
| `receive-drawer-patient`                                                     | Patient field (`PatientPicker`; options `-option-<id>`)                 | `shared/components/PatientPicker/` |
| `receive-drawer-invoice` · `-invoice-<invoiceId>`                            | Against invoice: the inert chip, or one open invoice's chip             | `components/ReceivePaymentDrawer/` |
| `receive-drawer-splits` · `-splits-row` · `-splits-amount` · `-splits-total` | The Mode · Amount rows (`SplitRowsField`), a row, its amount, the total | `shared/forms/SplitRowsField/`     |
| `receive-drawer-reference` · `-note`                                         | Reference · Note                                                        | `components/ReceivePaymentDrawer/` |
| `pay-drawer-bill` · `-oldest-<md\|is>:<id>`                                  | Supplier bill picker · a "Pending longest" chip                         | `components/SendPaymentDrawer/`    |
| `pay-drawer-category-<category>` · `-mode-<mode>`                            | Category chip · Mode chip                                               | `components/SendPaymentDrawer/`    |
| `pay-drawer-paid-to` · `-paid-to-quick-<name>`                               | Paid to · a quick name                                                  | `components/SendPaymentDrawer/`    |
| `pay-drawer-amount` · `-amount-quick-<rupees>`                               | Amount · a quick amount                                                 | `components/SendPaymentDrawer/`    |
| `pay-drawer-date` · `-note` · `-files` · `-files-input`                      | Date · Note · the bill photo zone and its file input                    | `components/SendPaymentDrawer/`    |

Add / Edit pending (`credit-drawer`, L-39c) and Give back / Got it back
(`settle-credit-drawer`) carry the record drawer's ids the same way (`-dismiss` reads "Back"
on both); their fields:

| Test ID                                                                                                             | Element                                                                             | Source                             |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `credit-drawer-way-<give\|take>`                                                                                    | Which way chip                                                                      | `pending/components/CreditDrawer/` |
| `credit-drawer-who` · `-who-search` · `-who-option-<key>` · `-who-create`                                           | Who: the picker, its search, a row (`patient:<id>` or `name:<slug>`), "Add “q”"     | `pending/components/CreditDrawer/` |
| `credit-drawer-amount`                                                                                              | Amount                                                                              | `pending/components/CreditDrawer/` |
| `credit-drawer-reason-<reason>`                                                                                     | A Reason chip (`charged_twice` … `other`)                                           | `pending/components/CreditDrawer/` |
| `credit-drawer-invoice` · `-invoice-option-<invoiceId>`                                                             | For invoice (a patient with invoices) · one invoice                                 | `pending/components/CreditDrawer/` |
| `credit-drawer-settle-by` · `-note`                                                                                 | Settle by · Note                                                                    | `pending/components/CreditDrawer/` |
| `settle-credit-drawer-splits` · `-splits-row` · `-splits-mode` · `-splits-amount` · `-splits-add` · `-splits-total` | The Mode · Amount rows, a row, its mode and amount, "+ Add another mode", the total | `shared/forms/SplitRowsField/`     |

### Day close (launch L-41)

`components/DayCloseDrawer/`, opened by the ledger for `/payments/day-close`. Every id sits
under the drawer's root, `day-close-drawer`:

| Test ID                                                                                       | Element                                                                | Source                |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| `day-close-drawer-close`                                                                      | The header's inline ×                                                  | `DayCloseDrawer.tsx`  |
| `day-close-drawer-day` · `-day-option-<YYYY-MM-DD>`                                           | The day dropdown (`DatePicker`) · a day                                | `DayCloseBar.tsx`     |
| `day-close-drawer-status` · `-entries`                                                        | The status pill · "6 entries on Oct 3"                                 | `DayCloseBar.tsx`     |
| `day-close-drawer-open-day-<YYYY-MM-DD>`                                                      | Yesterday's open-day chip (while today shows)                          | `DayCloseBar.tsx`     |
| `day-close-drawer-previous` · `-previous-list` · `-previous-<YYYY-MM-DD>`                     | "Previous closes" · its chips · one close                              | `DayCloseBar.tsx`     |
| `day-close-drawer-close-day`                                                                  | "Close day" (the working day, `dayclose`)                              | `DayCloseBar.tsx`     |
| `day-close-drawer-loading`                                                                    | The day's loading skeleton                                             | `DayCloseDrawer.tsx`  |
| `day-close-drawer-gate` · `-gate-amount` · `-gate-source` · `-gate-recount` · `-gate-accept`  | The gate: card, amount, source, Recount, Accept                        | `DayCloseGate.tsx`    |
| `day-close-drawer-strip` · `-strip-opening` · `-strip-cash` · `-strip-count` · `-strip-modes` | The working strip and its four cells                                   | `DayCloseWorking.tsx` |
| `day-close-drawer-strip-count-input` · `-strip-difference`                                    | Counted cash · the difference pill                                     | `DayCloseWorking.tsx` |
| `day-close-drawer-strip-mode-<mode>` · `-strip-staff-<memberId>`                              | A mode's net pill · a member's receipts chip                           | `DayCloseWorking.tsx` |
| `day-close-drawer-report` · `-report-reopen` · `-report-strip`                                | The report card · Reopen · its strip                                   | `DayCloseReport.tsx`  |
| `day-close-drawer-report-<opening\|collected\|paid\|counted\|difference>`                     | A report cell                                                          | `DayCloseReport.tsx`  |
| `day-close-drawer-report-log` · `-report-log-<accepted\|reviewed\|counted\|closed>`           | "What happened" · one line                                             | `DayCloseReport.tsx`  |
| `day-close-drawer-review` · `-review-toggle` · `-review-progress` · `-review-empty`           | "Review every entry": card, toggle, progress, "No entries on this day" | `DayCloseReview.tsx`  |
| `day-close-drawer-review-row` · `-review-check-<paymentId>`                                   | An entry · its "Mark as checked" box                                   | `DayCloseReview.tsx`  |
| `day-close-drawer-review-<seq>-row-action-<edit\|delete>`                                     | An open day's entry's Edit · Delete                                    | `DataTableRowActions` |
