---
name: fe-dependency-management
description: Safely add, update, remove, or pin npm dependencies in clinozy-fe — atomic lockfile commits, pnpm-workspace.yaml overrides for transitive pins, audit triage, and license plus bundle-impact checks. Use when acting on a fe-dependency-auditor finding or changing package.json / pnpm-lock.yaml.
---

# Dependency management

The procedural counterpart to the `fe-dependency-auditor` agent: the agent finds,
this skill fixes. Use it whenever `package.json` or the `overrides` in
`pnpm-workspace.yaml` change.

## The one hard rule — atomic lockfile

A `package.json` dependency (or `pnpm-workspace.yaml` `overrides`) change and its
`pnpm-lock.yaml` regeneration are **one commit**. Run `pnpm install` and stage
both together. A desynced lockfile fails every frozen-install CI job
(`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`) and reds open release-please PRs. The
before-commit guard blocks it locally via `pnpm run validate:lockfile`.

## Procedure

1. **Add / update:** `pnpm add <pkg>` (or edit the version), then `pnpm install`
   to regenerate the lockfile. Never hand-edit `pnpm-lock.yaml`.
2. **Pin a transitive/vulnerable dep:** add an `overrides` entry in
   `pnpm-workspace.yaml` (not a direct dependency; pnpm 11+ ignores the old
   `pnpm.overrides` field in `package.json`), then `pnpm install`. This is how a
   CVE in a nested package is resolved without waiting on the parent.
3. **Audit triage:** `pnpm deps:audit` (all) and `pnpm deps:audit:prod`
   (shipped). Fix high/critical. **The rule (same as clinozy-be): a fix exists →
   an `overrides` entry or a bump; NO fixed version published → its GHSA in
   `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`, under a comment naming
   `Package:`, `Path:`, `No fix:` and `Remove when:`, plus its row in the
   accepted-risk table of `docs/reference/dependency-upgrades.md`.** Never accept
   an advisory that has a fix, and never keep a second list: `bulk-audit.mjs`
   reads that one, reports each accepted advisory, and fails once a fix is
   published for it (remove the entry, then override or bump). Vulnerability
   policy and CI wiring live in `agent-os/skills/fe-code-quality-security/SKILL.md`.
4. **License + bundle impact of a new dep:** confirm the license is compatible
   and check the first-paint cost — if it is heavy or client-shipped, prefer a
   dynamic import and defer to `agent-os/skills/fe-bundle-performance/SKILL.md`.
5. **Remove:** `pnpm remove <pkg>` + `pnpm install`; run `pnpm knip` to catch
   now-dead code/exports the removal orphaned.
6. **A bump that moves `radix-ui`, `vaul` or `cmdk`** (Dependabot's npm-non-major
   group included) needs `pnpm dedupe` before it can merge. An incremental lockfile
   update leaves `vaul` / `cmdk` on older copies of the Radix dialog stack; each copy
   tracks `<body>` `pointer-events` on its own, so a menu-opened vaul sheet leaves the
   page unclickable on phones. `pnpm dedupe` only drops duplicates. Commit the
   lockfile (on a Dependabot PR, as a normal commit on its branch);
   `tests/ci/lockfile-single-radix.policy.test.ts` fails until every `@radix-ui/*`
   package resolves to one version. Detail: `docs/reference/dependency-upgrades.md`
   → One copy of Radix.

## Verify

### Compatibility regressions

Reproduce the failing CI command before attributing a failure to an upgrade.
Change one dependency resolution at a time in isolated diagnostics; record the
versions, failing suites, and result. An older resolution passing is compatibility
evidence, not proof of a defect in the upstream source.

When an exact compatibility pin is approved, document the reason and the tests
that must pass before removing it in `docs/reference/dependency-upgrades.md`.
Regenerate the lockfile normally. Test the installed graph without test-only
resolution hooks, then run both audits and the production bundle checks. Keep
existing security floors, coverage thresholds, and bundle budgets intact; report
any remaining blocker rather than treating the pin as completion.

- `pnpm run validate:lockfile` — lockfile in sync with `package.json`.
- `pnpm exec vitest run --project ci-policy tests/ci/lockfile-single-radix.policy.test.ts`
  — one copy of each Radix package (fix with `pnpm dedupe`).
- `pnpm deps:audit` — no unaccepted high/critical vulnerabilities.
- `pnpm knip` — no dead code left by a removal.

## Related

Skills: `fe-code-quality-security` (audit policy), `fe-platform-hygiene` (knip,
deploy validators), `fe-bundle-performance` (size impact). Agent:
`fe-dependency-auditor` (read-only finder).

---

## Advisory triage — a HIGH in a dev-only transitive dep still fails CI

`pnpm deps:audit` gates on **high+** across the whole tree, not just production
deps. A transitive advisory reached through a dev tool (an MCP server, a test
browser driver) reds the Security audit lane exactly like a runtime one.

Flow:

```bash
pnpm deps:audit                 # read the advisory + the vulnerable range
pnpm why <package>              # find which parent(s) pull it in
```

If no parent has published a fix, pin the transitive dep with an `overrides` entry
in `pnpm-workspace.yaml` — **not** a direct dependency, which would misrepresent the
dependency graph:

```yaml
overrides:
  ip-address: '>=10.4.0 <11'
```

Bound the range (`>=x <major+1`) so the override does not silently absorb a future
breaking major. Then `pnpm install`, and commit `pnpm-workspace.yaml` + `pnpm-lock.yaml`
**in the same commit** — a desynced lockfile fails every frozen-install job and
reds any open release-please PR.

Only when **no** version of the package itself fixes the advisory (the newest
release is still in the vulnerable range) is there nothing to pin: accept it in
`auditConfig.ignoreGhsas` as in step 3 of the procedure — never for an advisory
with a published fix.

Verify: `pnpm run validate:lockfile` then `pnpm deps:audit` (expect
`none at high+`, or `none other at high+` beside the accepted advisories it lists). If a lockfile error appears while the lockfile is fine, check
the Node version first — see `fe-before-commit-guard`.
