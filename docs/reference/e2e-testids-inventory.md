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

| Test ID                          | Element                                                                       | File                                                  |
| -------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| `app-layout`                     | Authenticated shell                                                           | `AppLayout.tsx`                                       |
| `focus-shell`                    | Focus layout-variant shell                                                    | `AppLayout/variants/AppLayoutFocus.tsx`               |
| `sidebar`                        | Sidebar                                                                       | AppLayout                                             |
| `nav-dashboard`                  | Dashboard nav link (`nav-<id>` from the manifest's `nav.id`, `useAppNav`)     | `AppLayout.shared.tsx` (sidebar + mobile)             |
| `sidebar-quick-links`            | Persistent sidebar shortcuts group                                            | `AppLayout/components/SidebarQuickLinks/`             |
| `sidebar-search`                 | Command palette from sidebar                                                  | SidebarQuickLinks                                     |
| `sidebar-settings`               | Settings hash modal from sidebar                                              | SidebarQuickLinks                                     |
| `app-context-strip`              | Quick-access pill strip (settings sections + search)                          | `AppLayout/components/AppContextStrip/`               |
| `main-content`                   | Main content region (skip-link target)                                        | `AppLayout.shared.tsx`                                |
| `mobile-bottom-bar`              | Mobile nav bar                                                                | AppLayout                                             |
| `header`                         | Top bar                                                                       | AppLayout                                             |
| `brand-logo`                     | Product mark (+ wordmark in the section bar)                                  | `AppLayout.shared.tsx`                                |
| `section-chip`                   | Phone header: the current room's name in its tone                             | `AppLayout/components/SectionChip/`                   |
| `all-sections-trigger`           | Section bar: All sections compass (tinted when the current room is unpinned)  | `AppLayout/components/AllSections/`                   |
| `all-sections`                   | All sections popover (dialog)                                                 | `AppLayout/components/AllSections/`                   |
| `all-sections-sheet`             | All sections bottom sheet (phone)                                             | `AppLayout/components/AllSections/`                   |
| `all-sections-<id>`              | All sections row link per room                                                | `AppLayout/components/AllSections/`                   |
| `all-sections-pin-<id>`          | Pin / unpin toggle per room                                                   | `AppLayout/components/AllSections/`                   |
| `nav-more`                       | Section bar: "More" for folded pinned tabs                                    | `AppLayout/components/PinnedTabs/`                    |
| `nav-more-<id>`                  | A folded pinned tab inside "More"                                             | `AppLayout/components/PinnedTabs/`                    |
| `nav-more-sections`              | Phone tab bar: "More" (opens All sections)                                    | `AppLayout.shared.tsx (MobileNav)`                    |
| `branch-picker`                  | Header branch picker                                                          | `AppLayout/components/BranchPicker/`                  |
| `branch-picker-all`              | Branch picker: All branches                                                   | `AppLayout/components/BranchPicker/`                  |
| `branch-picker-<branchId>`       | Branch picker: one branch                                                     | `AppLayout/components/BranchPicker/`                  |
| `account-menu`                   | Account menu (section bar)                                                    | `AppLayout/components/AccountMenu/`                   |
| `account-menu-identity`          | Account menu identity block (opens profile)                                   | `AppLayout/components/AccountMenu/`                   |
| `account-menu-status-<presence>` | Status radio pill (online · away · busy)                                      | `AppLayout/components/AccountMenu/`                   |
| `account-menu-theme-<mode>`      | Appearance radio pill (light · dark · system)                                 | `AppLayout/components/AccountMenu/`                   |
| `account-menu-notifications`     | Account menu: Notifications row                                               | `AppLayout/components/AccountMenu/`                   |
| `account-menu-security`          | Account menu: Security row                                                    | `AppLayout/components/AccountMenu/`                   |
| `account-menu-billing`           | Account menu: Billing row                                                     | `AppLayout/components/AccountMenu/`                   |
| `account-menu-devices`           | Account menu: Devices row                                                     | `AppLayout/components/AccountMenu/`                   |
| `account-menu-shortcuts`         | Account menu: Keyboard shortcuts row                                          | `AppLayout/components/AccountMenu/`                   |
| `view-as-bar`                    | View-as pill ("Previewing as <role>")                                         | `AppLayout/components/NoticeStack/`                   |
| `view-as-exit`                   | View-as pill: Exit preview                                                    | `AppLayout/components/NoticeStack/`                   |
| `upload-tray`                    | Upload tray (bottom inline-end; shown while files upload)                     | `components/UploadTray/` (mounted by `AppLayout.tsx`) |
| `upload-tray-status`             | Upload tray live status (always mounted, visually hidden)                     | UploadTray                                            |
| `upload-tray-toggle`             | Upload tray: collapse / expand the file list                                  | UploadTray                                            |
| `upload-tray-row`                | One file (`data-status`: queued, uploading, attaching, done, failed)          | UploadTray                                            |
| `upload-tray-retry`              | Failed file: Retry (resumes at the step that failed)                          | UploadTray                                            |
| `upload-tray-remove`             | Failed file: Remove                                                           | UploadTray                                            |
| `today-page`                     | Clinic room page: Today                                                       | `pages/organization/$organizationSlug/today/`         |
| `leads-page`                     | Clinic room page: Leads                                                       | `pages/organization/$organizationSlug/leads/`         |
| `new-lead-drawer`                | New lead drawer — `/leads/create` opens it over the list (L-35)               | `pages/organization/$organizationSlug/leads/`         |
| `lead-drawer`                    | Lead drawer — `/leads/$leadId` opens it over the list (L-34b)                 | `pages/organization/$organizationSlug/leads/`         |
| `appointments-page`              | Clinic room page: Appointments                                                | `pages/organization/$organizationSlug/appointments/`  |
| `patients-page`                  | Clinic room page: Patients                                                    | `pages/organization/$organizationSlug/patients/`      |
| `payments-page`                  | Clinic room page: Payments                                                    | `pages/organization/$organizationSlug/payments/`      |
| `tasks-page`                     | Clinic room page: Tasks                                                       | `pages/organization/$organizationSlug/tasks/`         |
| `offerings-page`                 | Clinic room page: Offerings                                                   | `pages/organization/$organizationSlug/offerings/`     |
| `users-page`                     | Clinic room page: Users                                                       | `pages/organization/$organizationSlug/users/`         |
| `medical-sales-page`             | Medical › Sales                                                               | `pages/organization/$organizationSlug/medical/sales/` |
| `stock-items-page`               | Clinic stock › Items                                                          | `pages/organization/$organizationSlug/stock/items/`   |
| `sidebar-toggle`                 | Menu button                                                                   | AppLayout                                             |
| `search-trigger`                 | Command palette                                                               | AppLayout                                             |
| `user-menu-trigger`              | Avatar menu                                                                   | AppLayout                                             |
| `user-menu-settings`             | Settings item in avatar menu                                                  | `AppLayout.shared.tsx`                                |
| `logout-button`                  | Log out                                                                       | AppLayout                                             |
| `full-page-spinner`              | Bootstrap loading                                                             | `FullPageSpinner.tsx`                                 |
| `organization-switcher-trigger`  | Org switcher                                                                  | `OrganizationSwitcher.tsx`                            |
| `organization-switcher-create`   | Create org from switcher                                                      | OrganizationSwitcher                                  |
| `organization-switcher-caption`  | Product name under the org name — sidebar brand lockup only                   | OrganizationSwitcher                                  |
| `sidebar-brand`                  | Sidebar identity row (mark + switcher as one lockup; same height as `header`) | `AppLayoutSidebar.tsx`                                |
| `sidebar-scrim`                  | Scrim behind the open navigation drawer (below `lg`)                          | `AppLayoutSidebar.tsx`                                |
| `session-timeout-dialog`         | Inactivity warning (5 min idle, 90 s grace)                                   | `SessionTimeoutDialog.tsx`                            |
| `session-signout`                | "Sign out" on the inactivity warning — revokes server-side                    | SessionTimeoutDialog                                  |
| `session-stay`                   | "Stay signed in" — default focus; restarts the idle clock                     | SessionTimeoutDialog                                  |
| `consent-banner`                 | Cookie-consent card (bottom-start corner; undecided only)                     | `ConsentBanner.tsx`                                   |
| `consent-accept`                 | Grant analytics consent                                                       | ConsentBanner                                         |
| `consent-decline`                | Decline analytics consent                                                     | ConsentBanner                                         |

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
| `<tableId>-table-row`                             | Body row (`data-index`; `data-kfocus` under j / k)              | `DataTableRow.tsx`        |
| `<tableId>-table-select-all` / `-select-row`      | Selection boxes (`md` and up)                                   | `DataTableRow.tsx`        |
| `<tableId>-table-footer`                          | 44px footer (count, fold toggle, bulk bar)                      | `DataTableFooter.tsx`     |
| `<tableId>-table-fold-toggle`                     | "<N> columns in rows · Show all" ↔ "Fit to width"               | `DataTableFooter.tsx`     |
| `<tableId>-table-bulk-bar`                        | Bulk bar; `-bulk-select-all`, `-bulk-clear`, `-bulk-<actionId>` | `DataTableBulkBar/`       |
| `<tableId>-table-loading-more` / `-table-end`     | "Loading more …" rows / "All … loaded" end line                 | `DataTableTail.tsx`       |
| `<tableId>-row-action-<actionId>` / `-row-more`   | Row actions and the "More actions" menu                         | `DataTableRowActions/`    |
| `<tableId>-columns-trigger` / `-columns-show-all` | Columns chooser; options `-columns-option-<columnId>`           | `DataTableColumnChooser/` |
| `<tableId>-saved-views`                           | Saved views track                                               | `DataTableSavedViews/`    |

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

| Test ID                                                                               | Element                                                              | Source                                        |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| `empty-state`                                                                         | Empty-state root (`data-tone` on the illustrated room variant)       | `shared/components/EmptyState/EmptyState.tsx` |
| `empty-state-illustration`                                                            | 96px dashed-ring illustration (room tone)                            | `shared/components/EmptyState/EmptyState.tsx` |
| `empty-state-action`                                                                  | 36px primary create action (`EmptyStateAction`)                      | `shared/components/EmptyState/EmptyState.tsx` |
| `empty-state-clear-filters`                                                           | "Clear filters" in the filtered empty state                          | `shared/components/EmptyState/EmptyState.tsx` |
| `contact-card`                                                                        | Contact card (`role="dialog"`, "Contact")                            | `shared/components/PersonCard/ContactCard/`   |
| `contact-card-open-file`                                                              | Patient name → patient file                                          | `shared/components/PersonCard/ContactCard/`   |
| `contact-card-edit` · `contact-card-change` · `contact-card-claim`                    | Edit contact · Change contact (forms) · "Open · Claim"               | `shared/components/PersonCard/ContactCard/`   |
| `contact-card-new-lead` · `contact-card-new-appointment` · `contact-card-new-patient` | Footer "+ Lead" · "+ Appointment" · "+ Patient"                      | `shared/components/PersonCard/ContactCard/`   |
| `team-card` · `team-card-assign`                                                      | Team card (`role="dialog"`, named by the member) · its assign button | `shared/components/PersonCard/TeamCard/`      |
| `skeleton-rows` · `skeleton-row`                                                      | Flat skeleton block · one placeholder row                            | `shared/components/SkeletonRows/`             |
| `patient-badge` · `avatar-stack-more`                                                 | The "P" patient badge · an avatar stack's "+N" pill                  | `shared/components/Cells/`                    |

---

## E2E specs (existing)

| Spec                                       | Test IDs used                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `tests/e2e/auth.e2e.test.ts`               | Unified auth + `dashboard-page`                                                               |
| `tests/e2e/organization.e2e.test.ts`       | `organization-page`, `organization-picker-option-acme`                                        |
| `tests/e2e/dashboard.e2e.test.ts`          | `dashboard-page`, `dashboard-greeting`, header hybrid (`search-trigger`, `user-menu-trigger`) |
| `tests/e2e/settings.e2e.test.ts`           | `settings-modal` + `role=dialog`, nav sections, `user-menu-*`                                 |
| `tests/e2e/edge-cases.e2e.test.ts`         | Hash fallbacks, legacy billing remap, Stripe return cleanup, auth validation edges            |
| `tests/e2e/navigation.e2e.test.ts`         | Hybrid login guard + `not-found-page`                                                         |
| `tests/e2e/notifications.e2e.test.ts`      | `notification-bell` hybrid + list/mark-all                                                    |
| `tests/e2e/network-resilience.e2e.test.ts` | Hybrid login fill + `offline-indicator`                                                       |
| `tests/e2e/accessibility.e2e.test.ts`      | login + dashboard pages (axe)                                                                 |
| `tests/e2e/visual.e2e.test.ts`             | Screenshots                                                                                   |
| `tests/e2e/responsive.e2e.test.ts`         | Mobile overflow + settings                                                                    |
| `tests/e2e/org-switching.e2e.test.ts`      | Dual-URL org switcher                                                                         |
| `tests/e2e/routes-integration.e2e.test.ts` | Full live route matrix — public shells, guards, authenticated journey, logout                 |
| `tests/e2e/deployment-*.e2e.test.ts`       | Deployment mode matrix (personal-and-team / personal-only / team-only)                        |
| `tests/e2e/accept-invite.e2e.test.ts`      | `accept-invite-*` (expired token → error + login)                                             |
| `tests/e2e/onboarding.e2e.test.ts`         | `onboarding-page`, `onboarding-step-title`, `onboarding-next`                                 |

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
