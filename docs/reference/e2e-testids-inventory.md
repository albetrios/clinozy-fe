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

| Test ID                          | Element                                                                           | File                                                  |
| -------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `app-layout`                     | Authenticated shell                                                               | `AppLayout.tsx`                                       |
| `focus-shell`                    | Focus layout-variant shell                                                        | `AppLayout/variants/AppLayoutFocus.tsx`               |
| `sidebar`                        | Sidebar                                                                           | AppLayout                                             |
| `nav-dashboard`                  | Dashboard nav link (`nav-<id>` from the manifest's `nav.id`, `useAppNav`)         | `AppLayout.shared.tsx` (sidebar + mobile)             |
| `sidebar-quick-links`            | Persistent sidebar shortcuts group                                                | `AppLayout/components/SidebarQuickLinks/`             |
| `sidebar-search`                 | Command palette from sidebar                                                      | SidebarQuickLinks                                     |
| `sidebar-settings`               | Settings hash modal from sidebar                                                  | SidebarQuickLinks                                     |
| `app-context-strip`              | Quick-access pill strip (settings sections + search)                              | `AppLayout/components/AppContextStrip/`               |
| `main-content`                   | Main content region (skip-link target)                                            | `AppLayout.shared.tsx`                                |
| `mobile-bottom-bar`              | Mobile nav bar                                                                    | AppLayout                                             |
| `header`                         | Top bar                                                                           | AppLayout                                             |
| `brand-logo`                     | Product mark (+ wordmark in the section bar)                                      | `AppLayout.shared.tsx`                                |
| `section-chip`                   | Phone header: the current room's name in its tone                                 | `AppLayout/components/SectionChip/`                   |
| `all-sections-trigger`           | Section bar: All sections compass (tinted when the current room is unpinned)      | `AppLayout/components/AllSections/`                   |
| `all-sections`                   | All sections popover (dialog)                                                     | `AppLayout/components/AllSections/`                   |
| `all-sections-sheet`             | All sections bottom sheet (phone)                                                 | `AppLayout/components/AllSections/`                   |
| `all-sections-<id>`              | All sections row link per room                                                    | `AppLayout/components/AllSections/`                   |
| `all-sections-pin-<id>`          | Pin / unpin toggle per room                                                       | `AppLayout/components/AllSections/`                   |
| `nav-more`                       | Section bar: "More" for folded pinned tabs                                        | `AppLayout/components/PinnedTabs/`                    |
| `nav-more-<id>`                  | A folded pinned tab inside "More"                                                 | `AppLayout/components/PinnedTabs/`                    |
| `nav-more-sections`              | Phone tab bar: "More" (opens All sections)                                        | `AppLayout.shared.tsx (MobileNav)`                    |
| `branch-picker`                  | Header branch picker                                                              | `AppLayout/components/BranchPicker/`                  |
| `branch-picker-all`              | Branch picker: All branches                                                       | `AppLayout/components/BranchPicker/`                  |
| `branch-picker-<branchId>`       | Branch picker: one branch                                                         | `AppLayout/components/BranchPicker/`                  |
| `account-menu`                   | Account menu (section bar)                                                        | `AppLayout/components/AccountMenu/`                   |
| `account-menu-identity`          | Account menu identity block (opens profile)                                       | `AppLayout/components/AccountMenu/`                   |
| `account-menu-status-<presence>` | Status radio pill (online · away · busy)                                          | `AppLayout/components/AccountMenu/`                   |
| `account-menu-theme-<mode>`      | Appearance radio pill (light · dark · system)                                     | `AppLayout/components/AccountMenu/`                   |
| `account-menu-notifications`     | Account menu: Notifications row                                                   | `AppLayout/components/AccountMenu/`                   |
| `account-menu-security`          | Account menu: Security row                                                        | `AppLayout/components/AccountMenu/`                   |
| `account-menu-billing`           | Account menu: Billing row                                                         | `AppLayout/components/AccountMenu/`                   |
| `account-menu-devices`           | Account menu: Devices row                                                         | `AppLayout/components/AccountMenu/`                   |
| `account-menu-shortcuts`         | Account menu: Keyboard shortcuts row                                              | `AppLayout/components/AccountMenu/`                   |
| `view-as-bar`                    | View-as pill ("Previewing as <role>")                                             | `AppLayout/components/NoticeStack/`                   |
| `view-as-exit`                   | View-as pill: Exit preview                                                        | `AppLayout/components/NoticeStack/`                   |
| `upload-tray`                    | Upload tray (bottom inline-end; shown while files upload)                         | `components/UploadTray/` (mounted by `AppLayout.tsx`) |
| `upload-tray-status`             | Upload tray live status (always mounted, visually hidden)                         | UploadTray                                            |
| `upload-tray-toggle`             | Upload tray: collapse / expand the file list                                      | UploadTray                                            |
| `upload-tray-row`                | One file (`data-status`: queued, uploading, attaching, done, failed)              | UploadTray                                            |
| `upload-tray-retry`              | Failed file: Retry (resumes at the step that failed)                              | UploadTray                                            |
| `upload-tray-remove`             | Failed file: Remove                                                               | UploadTray                                            |
| `today-page`                     | Clinic room page: Today                                                           | `pages/organization/$organizationSlug/today/`         |
| `leads-page`                     | Clinic room page: Leads                                                           | `pages/organization/$organizationSlug/leads/`         |
| `new-lead-drawer`                | New lead drawer — `/leads/create` opens it over the list (L-35)                   | `pages/organization/$organizationSlug/leads/`         |
| `lead-drawer`                    | Lead drawer — `/leads/$leadId` opens it over the list (L-34b)                     | `pages/organization/$organizationSlug/leads/`         |
| `leads-empty`                    | Leads list: "No leads match" (+ "Clear filters" / "New lead")                     | `pages/organization/$organizationSlug/leads/`         |
| `leads-claim`                    | Leads row: "Open to team · Claim / Join" (claims from the row)                    | `leads/components/LeadsTable/`                        |
| `leads-hold-dot`                 | Leads row: the hold's release-today / tomorrow dot on the owner                   | `leads/components/LeadsTable/`                        |
| `lead-drawer-chat`               | Lead drawer: the chat pane (the phone's Chat pane)                                | `leads/components/LeadDrawer/`                        |
| `lead-drawer-save`               | Lead drawer: "Save lead" (disabled until the draft changes)                       | `leads/components/LeadDrawer/`                        |
| `lead-drawer-remove`             | Lead drawer: "Remove lead" (opens the reason confirm)                             | `leads/components/LeadDrawer/`                        |
| `lead-drawer-people`             | Lead drawer: "Assigned & involved" (opens "People on this lead")                  | `leads/components/LeadFormFields/`                    |
| `lead-drawer-resize`             | Lead drawer: the chat's resize handle (`role="separator"`)                        | `leads/components/LeadDrawer/`                        |
| `new-lead-search`                | New lead: "Search by name or mobile" (the Contact step)                           | `leads/components/NewLeadDrawer/`                     |
| `new-lead-preset-<id>`           | New lead: Quick start chip — `walkIn`, `phoneCall`, `instagramDm`                 | `leads/components/NewLeadDrawer/`                     |
| `new-lead-hit-<kind>-<seq>`      | New lead: a search hit — `patient-3508` ("Re-create lead"), `lead-2365`           | `leads/components/NewLeadDrawer/`                     |
| `new-lead-no-match`              | New lead: "No existing match"                                                     | `leads/components/NewLeadDrawer/`                     |
| `new-lead-new-contact`           | New lead: "New contact" (opens the contact editor)                                | `leads/components/NewLeadDrawer/`                     |
| `new-lead-change`                | New lead: the person's strip — "Change"                                           | `leads/components/NewLeadDrawer/`                     |
| `appointments-page`              | Clinic room page: Appointments                                                    | `pages/organization/$organizationSlug/appointments/`  |
| `new-appointment-drawer`         | New appointment form — `/appointments/create` over the page (L-38)                | `pages/organization/$organizationSlug/appointments/`  |
| `appointment-drawer`             | Appointment form — `/appointments/$appointmentId` over the page (L-38)            | `pages/organization/$organizationSlug/appointments/`  |
| `patients-page`                  | Clinic room page: Patients (toolbar and table ids: the shared ones, `patients-…`) | `pages/organization/$organizationSlug/patients/`      |
| `patient-drawer`                 | New patient drawer — `/patients/create` opens it over the list (L-32b)            | `pages/organization/$organizationSlug/patients/`      |
| `patient-quick-add`              | Quick-add patient — the same form stacked on a picker's drawer (Q-P2)             | `shared/components/PatientDrawer/`                    |
| `payments-page`                  | Clinic room page: Payments                                                        | `pages/organization/$organizationSlug/payments/`      |
| `tasks-page`                     | Clinic room page: Tasks (its own ids: the Tasks room section below)               | `pages/organization/$organizationSlug/tasks/`         |
| `new-task-drawer`                | New task — `/tasks/create` opens it over the list (L-47d)                         | `pages/organization/$organizationSlug/tasks/`         |
| `task-drawer`                    | Task drawer — `/tasks/$taskId` opens it over the list (L-47c)                     | `pages/organization/$organizationSlug/tasks/`         |
| `offerings-page`                 | Clinic room page: the Offerings tab (`offerings-…` ids, `offerings-new-button`)   | `pages/organization/$organizationSlug/offerings/`     |
| `offering-drawer`                | Offering drawer — `/offerings/create`, `…/$offeringId/edit` over the list (L-30c) | `pages/organization/$organizationSlug/offerings/`     |
| `offers-page`                    | Clinic room page: the Offers tab (`offers-…` ids, `offers-new-button`)            | `offerings/offers/` (child of the above)              |
| `offer-drawer`                   | Offer drawer — `/offers/create`, `…/$offerId/edit` over the Offers tab (L-30d)    | `offerings/offers/` (child of the above)              |
| `offering-quick-create`          | Stacked "New offering" — over the Invoice drawer's line picker (L-30e, L-40)      | `shared/components/OfferingQuickCreate/`              |
| `users-page`                     | Clinic room page: Users                                                           | `pages/organization/$organizationSlug/users/`         |
| `users-team-table`               | Users › Team table (toolbar and table ids: the shared ones, `users-team-…`)       | `pages/organization/$organizationSlug/users/`         |
| `user-drawer`                    | User drawer — `/users/create` (New user) and `/users/$userId/edit` (L-31b)        | `pages/organization/$organizationSlug/users/`         |
| `users-roles-page`               | Users › Roles & access page — `/users/roles` (L-31c)                              | `pages/organization/$organizationSlug/users/roles/`   |
| `users-roles-panel`              | Roles & access card: role list and role page (also behind a drawer opened there)  | `pages/organization/$organizationSlug/users/shared/`  |
| `medical-sales-page`             | Medical › Sales                                                                   | `pages/organization/$organizationSlug/medical/sales/` |
| `stock-items-page`               | Clinic stock › Items                                                              | `pages/organization/$organizationSlug/stock/items/`   |
| `sidebar-toggle`                 | Menu button                                                                       | AppLayout                                             |
| `search-trigger`                 | Command palette                                                                   | AppLayout                                             |
| `user-menu-trigger`              | Avatar menu                                                                       | AppLayout                                             |
| `user-menu-settings`             | Settings item in avatar menu                                                      | `AppLayout.shared.tsx`                                |
| `logout-button`                  | Log out                                                                           | AppLayout                                             |
| `full-page-spinner`              | Bootstrap loading                                                                 | `FullPageSpinner.tsx`                                 |
| `organization-switcher-trigger`  | Org switcher                                                                      | `OrganizationSwitcher.tsx`                            |
| `organization-switcher-create`   | Create org from switcher                                                          | OrganizationSwitcher                                  |
| `organization-switcher-caption`  | Product name under the org name — sidebar brand lockup only                       | OrganizationSwitcher                                  |
| `sidebar-brand`                  | Sidebar identity row (mark + switcher as one lockup; same height as `header`)     | `AppLayoutSidebar.tsx`                                |
| `sidebar-scrim`                  | Scrim behind the open navigation drawer (below `lg`)                              | `AppLayoutSidebar.tsx`                                |
| `session-timeout-dialog`         | Inactivity warning (5 min idle, 90 s grace)                                       | `SessionTimeoutDialog.tsx`                            |
| `session-signout`                | "Sign out" on the inactivity warning — revokes server-side                        | SessionTimeoutDialog                                  |
| `session-stay`                   | "Stay signed in" — default focus; restarts the idle clock                         | SessionTimeoutDialog                                  |
| `consent-banner`                 | Cookie-consent card (bottom-start corner; undecided only)                         | `ConsentBanner.tsx`                                   |
| `consent-accept`                 | Grant analytics consent                                                           | ConsentBanner                                         |
| `consent-decline`                | Decline analytics consent                                                         | ConsentBanner                                         |

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
| `<tableId>-toolbar`                                | Toolbar row (`data-layout` `default` / `leads` / `tasks`)                   | `RoomToolbar/RoomToolbar.tsx` |
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

## E2E specs (existing)

| Spec                                       | Test IDs used                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `tests/e2e/auth.e2e.test.ts`               | Unified auth + `dashboard-page`                                                                 |
| `tests/e2e/organization.e2e.test.ts`       | `organization-page`, `organization-picker-option-acme`                                          |
| `tests/e2e/dashboard.e2e.test.ts`          | `dashboard-page`, `dashboard-greeting`, header hybrid (`search-trigger`, `user-menu-trigger`)   |
| `tests/e2e/settings.e2e.test.ts`           | `settings-modal` + `role=dialog`, nav sections, `user-menu-*`                                   |
| `tests/e2e/edge-cases.e2e.test.ts`         | Hash fallbacks, legacy billing remap, Stripe return cleanup, auth validation edges              |
| `tests/e2e/navigation.e2e.test.ts`         | Hybrid login guard + `not-found-page`                                                           |
| `tests/e2e/notifications.e2e.test.ts`      | `notification-bell` hybrid + list/mark-all                                                      |
| `tests/e2e/network-resilience.e2e.test.ts` | Hybrid login fill + `offline-indicator`                                                         |
| `tests/e2e/accessibility.e2e.test.ts`      | login + dashboard pages (axe)                                                                   |
| `tests/e2e/visual.e2e.test.ts`             | Screenshots                                                                                     |
| `tests/e2e/responsive.e2e.test.ts`         | Mobile overflow + settings                                                                      |
| `tests/e2e/org-switching.e2e.test.ts`      | Dual-URL org switcher                                                                           |
| `tests/e2e/routes-integration.e2e.test.ts` | Full live route matrix — public shells, guards, authenticated journey, logout                   |
| `tests/e2e/deployment-*.e2e.test.ts`       | Deployment mode matrix (personal-and-team / personal-only / team-only)                          |
| `tests/e2e/accept-invite.e2e.test.ts`      | `accept-invite-*` (expired token → error + login)                                               |
| `tests/e2e/onboarding.e2e.test.ts`         | `onboarding-page`, `onboarding-step-title`, `onboarding-next`                                   |
| `tests/e2e/boot-splash.e2e.test.ts`        | `#app-splash` + `app-splash-*` (frames, greeting → `today-page`, offline Retry, reduced motion) |

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
