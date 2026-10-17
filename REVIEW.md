# Code-review instructions for clinozy-fe

Highest-priority instructions for any agent reviewing a diff or PR in this repo
(`/code-review`, `/fe-pre-merge-review`, `/fe-prod-readiness`, `/review`, and review subagents).
These tune _review judgment_; the mechanical rules themselves live in `CLAUDE.md` and are enforced
by gates — do not re-litigate what a gate already proves. The same ladder and format as
clinozy-be's `REVIEW.md`, so one report can hold findings from both repositories.

## Severity definitions

| Severity     | Meaning                                                             | Examples in this repo                                                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **critical** | Security hole, session or tenant leak, data shown to the wrong user | An access token written to `localStorage` / `sessionStorage`; a second `/auth/refresh` caller beside `refreshAccessToken()` (parallel refreshes kill the session); organization context taken from anything but the URL; a CSP that allows inline or third-party script; a secret committed |
| **major**    | Correctness bug a user will hit                                     | A protected route without its `beforeLoad` gate; `forceLogout()` used to end a live session; a write that skips `apiClient` (no `X-Idempotency-Key`); a page importing another page; a reload that can land over a focused field                                                            |
| **minor**    | Contract or convention drift that gates may not catch               | A raw palette class instead of a semantic token; a user-facing string outside i18n; a digit in a name we own; a page or form without its `data-testid`; a new component without its colocated test                                                                                          |
| **nit**      | Style/preference — cap at 2 per review, or omit                     | Naming taste, comment phrasing                                                                                                                                                                                                                                                              |

## Findings format

Every reviewer — the `/fe-pre-merge-review` and `/fe-prod-readiness` agents, `/code-review`, a
review subagent — reports each finding on one line, in this shape, so one report can merge them:

```markdown
- **major** · `src/shared/auth/service.ts:88` · single refresh path — the new retry calls
  `/auth/refresh` directly, so two tabs refresh at once and the session dies → fix: fe-code-quality-security
```

- **Severity** — one of this file's four: `critical`, `major`, `minor`, `nit`. No other scale (no
  P0/P1, high/medium/low, blocking/optional, PASS/FAIL per finding).
- **Location** — `file:line` in the diff (or the closest line it breaks).
- **Check** — the rule it fails (a `CLAUDE.md` rule, a security-model control, or the reviewer's own).
- **Failure scenario** — the concrete input or state that goes wrong.
- **Fix** — the skill that fixes it (agent finds, skill fixes; the pipeline's `handoff`) or the exact
  change.

A reviewer may add a `Satisfied` list (check — reference) after its findings. The aggregate report
sorts findings by severity (critical first), merges the same `file:line` and check from two
reviewers into one line naming both, and keeps at most two `nit`s. `critical` and `major` block the
merge (or the release); `minor` and `nit` are the optional improvements.
