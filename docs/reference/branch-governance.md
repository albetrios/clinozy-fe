# Branch governance mode (personal ↔ team)

A single switch that puts the repo into one of two **human-review** postures and
keeps the two source-of-truth files that encode it consistent.

The automated gates (`Quality gate` + `Checks`) block **every** merge in both
modes — this switch only governs the human review requirement on top of them.

## Why it exists

The review fields are **coupled**, and the wrong combination deadlocks the
maintainer: GitHub forbids self-approval, so `preventSelfReview` with a single
reviewer locks the shipper out entirely. Hand-editing the ruleset and the
production environment separately invites exactly that. The tool flips every
coupled field across both files **atomically** and refuses any combination that
would deadlock or that `team` cannot satisfy (fewer than two owners).

## The two modes

| Field                             | File                                   | `personal`  | `team`          |
| --------------------------------- | -------------------------------------- | ----------- | --------------- |
| `required_approving_review_count` | `.github/rulesets/main.json`           | 0           | 1               |
| `require_code_owner_review`       | `.github/rulesets/main.json`           | false       | true            |
| `require_last_push_approval`      | `.github/rulesets/main.json`           | false       | true            |
| `dismiss_stale_reviews_on_push`   | `.github/rulesets/main.json`           | false       | true            |
| `requiredReviewers.users`         | `.github/environments/production.json` | first owner | all owners (≤6) |
| `preventSelfReview`               | `.github/environments/production.json` | false       | true            |

Everything else in both files — required status checks, `bypass_actors`, linear
history, signatures, merge method, deployment branch policy — is **untouched**.
That is what keeps the tool portable and safe.

## Architecture

```text
.github/CODEOWNERS ─────────────┐  (roster: who MAY review — read-only)
.github/rulesets/main.json ─────┼─▶  pnpm github:tool:governance-mode <mode>  ─▶ edits the 2 JSON files
.github/environments/production.json ─┘         │
                                                ▼
                                  pnpm github:sync  ─▶  PUT ruleset + env protection to GitHub
                                                ▲
   tests/ci/governance-mode.policy.test.ts (runs in the ci-policy lane of Quality gate)
   + pnpm github:tool:governance-mode:check  ─▶  fail on any inconsistent / deadlocking combo
```

The trunk ruleset file is resolved dynamically from `git.defaultBranch` in
`tooling/setup/setup.config.json` — no branch name is hardcoded.

## Operating it

```bash
pnpm github:tool:governance-mode          # status: current mode + roster + next step
pnpm github:tool:governance-mode team     # apply four-eyes (needs ≥2 CODEOWNERS users)
pnpm github:tool:governance-mode personal # apply solo
pnpm github:sync                          # push ruleset + environment to GitHub
pnpm github:tool:governance-mode:check    # exit non-zero on any inconsistency
```

Switching is two steps: edit the files with the tool, then apply them to GitHub
with `pnpm github:sync`. The tool only rewrites local files; it never calls the
GitHub API itself.

## Invariants (enforced by the tool and the ci-policy test)

- The ruleset `pull_request` params match a recognized preset — not a
  hand-mangled hybrid.
- The ruleset mode equals the production-environment mode (they cannot disagree).
- `team` ⇒ ≥2 CODEOWNERS **users** and ≥2 production reviewers.
- Production reviewers are a subset of CODEOWNERS users (single roster source).
- Deadlock guards: `preventSelfReview` ⇒ ≥2 reviewers; `require_code_owner_review`
  ⇒ ≥2 owners.
- `applyGovernanceMode('team')` throws (writes nothing) when the roster has fewer
  than two users.

## Prerequisites and caveats

- **`team` needs a second owner first.** `.github/CODEOWNERS` currently lists a
  single user (`@nikunjmavani`), so the repo is in `personal` mode and the tool
  refuses `team`. Add a second individual `@user` handle to CODEOWNERS to unlock
  it. Team handles (`@org/team`) only resolve on organization repos and are not
  counted as reviewers for self-review.
- **Rulesets need a paid plan on private repos.** Repository rulesets require
  GitHub Pro / Team / Enterprise on private repos; `pnpm github:sync` surfaces
  the 403 verbatim.
- **No admin break-glass.** `bypass_actors` is intentionally **empty** — a PR with a
  failing or pending required check (`Quality gate`, `Checks`) cannot be merged by anyone,
  the repo owner included (no `--admin` / merge-API override). `required_signatures` is
  likewise absent: branch commits are unsigned, and the squash-merge commit GitHub creates
  on `main` is signed regardless. Pinned by `tests/ci/rulesets.policy.test.ts`; this tool
  never touches either.

## Related

- Branch ruleset (committed): [`.github/rulesets/main.json`](../../.github/rulesets/main.json)
- Environment protection IaC: [`.github/environments/README.md`](../../.github/environments/README.md)
- Trunk workflow: [trunk-based-workflow.md](../process/trunk-based-workflow.md)
