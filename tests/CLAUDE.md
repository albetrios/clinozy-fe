# Testing — clinozy-fe

Claude Code loads this file when it works in `tests/`. It holds sections moved out of the root [`CLAUDE.md`](../CLAUDE.md), which keeps a pointer to each; the root rules apply here too.

## Testing

**Full matrix:** [docs/reference/testing.md](../docs/reference/testing.md) · [tests/README.md](../tests/README.md)

- **Global tests, helpers:** **`tests/`** at project root
  - **Helpers:** `tests/utils/` — `renderWithProviders`, `e2e-hybrid`, `e2e-auth`, `axe-for-dialog`, `axe-label-in-name`; import as `@/tests/utils/...`
  - **Security:** `tests/security/` — Vitest security project (`*.security.test.ts`)
  - **Performance:** `tests/performance/` (optional) — Lighthouse, bundle-size
- **Colocated unit tests:** `src/**/*.test.{ts,tsx}` (+ `pages/**/__tests__/integration/` for cross-component flows)
- **E2E:** `tests/e2e/*.e2e.test.ts` (Playwright) — requires **clinozy-be** on `:3000` (`global-setup.ts` fails if down). Never `.spec.ts`.
- **Hybrid E2E selectors:** `data-testid` for actions, `getByRole`/`getByLabel` for a11y guards — `agent-os/skills/fe-playwright-e2e/SKILL.md`, `tests/utils/e2e-hybrid.ts`. A control mounted per breakpoint shares one test id, so reach it with `byTestId()` (visible + first); never `.catch()` an `isVisible()` / `isEnabled()` feature check (ESLint-enforced) — it can only hide a strict-mode violation and turn the spec into a silent skip. **Read the skipped count.**
- **Gates:** `pnpm validate:structure` (colocation), `pnpm validate:testids` (page/form/shell testids), `pnpm validate:theme-axis`, `pnpm coverage:patch` (PR changed-lines ≥ 90%)
- Unit/security: Vitest; E2E: Playwright (Chromium). Component tests require `vitest-axe`; portaled dialogs use `axeForDialog`; a control named by an `aria-label` must say the words it shows (`axeLabelInName`, WCAG 2.5.3).

**Dev API:** In development, Vite proxies `/api` to `VITE_DEV_API_URL` (default `http://localhost:3000`). The FE always uses `apiClient` / `authFetch` against **clinozy-be**. Unit tests stub modules with `vi.mock()` — no HTTP server.
