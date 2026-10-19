# Test Utilities

## renderWithProviders

Renders a component with TanStack Query and TanStack Router (memory history).

```tsx
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

test('renders component', () => {
  const { getByText } = renderWithProviders(<MyComponent />);
  expect(getByText('Hello')).toBeInTheDocument();
});
```

### Options

- `initialEntries?: string[]` — initial route entries (default: `['/']`)
- `queryClient?: QueryClient` — custom client (default: fresh, no retries)

## renderWithQueryClient

The same fresh QueryClient without the router — synchronous, for a unit that needs
the client but no route (anything that renders the shared `Picker`, whose data hooks
read it).

```tsx
import { renderWithQueryClient } from '@/tests/utils/renderWithProviders.tsx';

renderWithQueryClient(<DateTimePrefsCard />);
expect(screen.getByTestId('time-zone-select')).toBeInTheDocument();
```

### Isolating HTTP in unit tests

Stub `apiClient` or module dependencies with `vi.mock()` and `vi.fn()` at the top of the test file — unit tests never start a server.

```tsx
const getMock = vi.fn();
vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: { get: getMock, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
```

## E2E helpers

### `e2e-hybrid.ts` (hybrid selectors)

Playwright specs use **`data-testid` for actions** and **`getByRole` / `getByLabel` for a11y guards**. See `agent-os/skills/fe-playwright-e2e/SKILL.md`.

### `e2e-clinic-setup.ts`

A new clinic opens its setup drawer by itself over the first room. `exploreClinicSetupFirst(page)` —
called by `gotoApp` and `establishSessionInPage`, so every spec gets it — answers the page's setup
reads as deferred ("Explore first"), writing nothing; `letClinicSetupOpen(page)` lets a spec about
the setup meet the drawer as a new owner does.

### `e2e-faker.ts`

Faker-backed disposable data for Playwright/API E2E (emails stay on `@acme.test` for mail_outbox).

| Helper                        | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `uniqueE2eEmail(label?)`      | Unique mailbox (`label.user.123@acme.test`) |
| `e2eDisplayName()`            | Onboarding / profile full name              |
| `e2eOrganizationName()`       | Workspace / org display name                |
| `e2eOrganizationSlug(label?)` | URL-safe org slug                           |
| `e2eTeamOrgProfile(opts?)`    | `{ name, slug }` pair for team org creation |
| `e2eRoleName()`               | Custom RBAC role name for tenancy API E2E   |

### `e2e-auth.ts`

Requires **clinozy-be** on `:3000` — Vite proxies `/api` in dev.

| Helper                                     | Purpose                                                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSessionViaEmailCode(api)`           | API helper — send-code + login; needs `DATABASE_URL` (reads code from `auth.mail_outbox`)                                                     |
| `authenticateViaEmailCode(page)`           | Browser/API helper — same flow via Playwright request (needs `DATABASE_URL`)                                                                  |
| `authenticateViaSignup(page)`              | Alias of `authenticateViaEmailCode` (legacy signup route removed)                                                                             |
| `completeOnboardingWizard(page)`           | Walk onboarding when `needsOnboarding`                                                                                                        |
| `registerNewUserAndGoToToday(page)`        | Email-code login + onboarding when needed → Today in a clinic the user owns (one is made through the API when onboarding lands on the picker) |
| `loginViaEmailCodeUI(page)`                | Email-code login via `/login` UI only (needs `DATABASE_URL`)                                                                                  |
| `authenticateViaEmailCodeAndLand(page)`    | API session + `/` resolver hydrate, ending on Today (needs `DATABASE_URL`)                                                                    |
| `registerNewUserOnPersonalWorkspace(page)` | A new user left on their personal workspace — the organization picker (D44); skips where personal workspaces are off                          |
| `createTeamOrgViaApi(page)`                | Create a team org through the API (cookie refresh → token); skips when team orgs are off                                                      |
| `createTeamOrgAndOpenToday(page)`          | `createTeamOrgViaApi`, then open that clinic's home in the app — Today, its owner's role home                                                 |
| `openOrganizationSwitcher(page)`           | Open the switcher — Account menu › "Switch clinic" in the section bar, else the header's                                                      |
| `selectOrganizationInSwitcher(page, slug)` | Switch active org through that switcher                                                                                                       |

### `e2e-hybrid.ts` — the section-bar shell

The clinic shell has no sidebar, bell or header theme toggle: the Account menu (the avatar,
`user-menu-trigger`) holds them.

| Helper                         | Purpose                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `expectAppHeaderReady(page)`   | Header, search ("Search or jump to") and avatar ("<name> · <status>")      |
| `openAccountMenu(page)`        | Open the Account menu (`account-menu`, named "Account")                    |
| `openNotificationCenter(page)` | Account menu › Notifications → `notification-popover`                      |
| `chooseThemeMode(page, mode)`  | Account menu › Appearance pills (`account-menu-theme-<mode>`), then closes |

### `e2e-app.ts` — the clinic rooms

| Helper                                | Purpose                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `openNewClinic(page)`                 | A new owner of a new clinic (team org) via `page.request`, standing on their role home (Today); skips when team orgs are off |
| `openRoomFromShell(page, room, tier)` | Open a room as a member does: pinned tab (header / phone tab bar) or All sections (popover / "More" sheet)                   |
| `expectRoomReady(page, room)`         | The room's URL, page root and its `h1` (a11y guard)                                                                          |
| `APP_ROOMS` · `APP_VIEWPORTS`         | The ten rooms in nav order · desktop 1440×900 and phone 375×812                                                              |
| `hideDevtools(page)`                  | Hide the React Query devtools (`VITE_DEVTOOLS`) — their toggle covers the phone tab bar's "More"                             |

### `e2e-tenancy.ts`

| Helper                               | Purpose                                   |
| ------------------------------------ | ----------------------------------------- |
| `createTeamOrganization(api, token)` | Create TEAM org (+ optional token switch) |
| `bearerHeaders(token, withIdem?)`    | Authorization header for API E2E          |

### `global-setup.ts`

Playwright runs `tests/e2e/global-setup.ts` before any spec — probes `GET http://localhost:3000/readyz` and fails if clinozy-be is not running.

### `axe-for-dialog.ts` (unit dialog a11y)

Radix dialogs portal outside the render container — use `axeForDialog` instead of `axe(container)`:

```ts
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
```

### `bidi-marks.ts` (isolated data tokens)

A data token inside a translated sentence is wrapped in invisible bidi marks
(`src/lib/bidi-isolate.ts`). `fsi(text)` / `lri(text)` build the expected text
from literal marks; `withoutBidiMarks(text)` strips them when a test checks only
the words and their order:

```ts
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

expect(row).toHaveTextContent(`Patient ${fsi('#3508')} · last visit`);
expect(withoutBidiMarks(chip.textContent)).toBe('Appointment #2740 · Peel');
```

### `workflow-jobs.ts` (CI policy tests)

The one way a `tests/ci` policy slices a GitHub Actions workflow into its top-level jobs, line by
line: `jobBlock(workflow, name)` is one job (`''` when absent), `jobBlocks(workflow)` every job as
`[name, block]`:

```ts
import { jobBlock } from '@/tests/utils/workflow-jobs.ts';

expect(jobBlock(workflow, 'release-please')).toContain('release-please-action');
```

## Test fixtures (`tests/fixtures/`)

Static shapes for unit tests only — never imported from `src/`.

```tsx
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/tests/fixtures/notification-fixtures.ts';
```
