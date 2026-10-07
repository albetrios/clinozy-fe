# SonarQube hand-off — delete this folder once the issues are fixed

Temporary hand-off for the next session (any account, Mac or cloud). The pre-push SonarQube gate
(`pnpm sonar:scan`, project `clinozy-fe`) scanned `feat/clinic-launch-build` at `f2436e5f` on
7 Oct 2026 and found **325 issues** — the first scan of the whole launch build. The gate
prints only 50; [`issues.json`](issues.json) holds all of them (rule, severity, file, line,
message, status), so the next session can start fixing without re-scanning.

- **By rule:** S6819 162, S6767 54, S6606 51, S6478 15, S1874 8, S2871 6, S4325 4, S4043 4, S3863 4, S6481 3, S2301 3, S4782 3, S5850 2, S2004 1, S6551 1, S6582 1, S3735 1, S6754 1, S6749 1.
- **By area:** src/pages 147, src/shared/components 124, rest of src/shared 54 — split by files so parallel
  fixers never touch the same file.
- **Status:** 178 issues sit in files that a stopped partial fix edited (verify
  them), 147 are untouched. Whether the partial fixes landed on the branch is in
  the git log (`git log --oneline --grep sonar`).

How to fix: S6819 → the native element where the ARIA role has one (button, ul / li, fieldset,
output, hr, nav, header, section); S6478 → hoist the component to module scope; S6481 → memoise the
context value; S6606 → `??` only where an empty string, 0 or false must not fall back; S6767 →
remove unused typed props; the rest per Sonar's message. Behaviour, test ids, accessible names and
visuals stay unchanged; `NOSONAR(<rule>): <reason>` only where the native element cannot work.
Confirm with one `pnpm sonar:scan` (0 issues), push through the pre-push hook (never
`--no-verify`), then **delete `handoff/`** in the same push.
