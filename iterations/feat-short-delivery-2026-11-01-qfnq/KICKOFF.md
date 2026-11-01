# KICKOFF — feat-short-delivery-2026-11-01-qfnq

> The plan and the ordered ledger for an iteration from a written brief, from scratch (`intake-files/BRIEF.md`).
> Frozen at approval: afterwards only the ledger's Status column and `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Iteration     | `feat-short-delivery-2026-11-01-qfnq`                                                  |
| Mode          | initial — from scratch                                                                 |
| Baseline      | `none`                                                                                 |
| Intake mode   | brief — `BRIEF.md` alone, the whole snapshot                                           |
| Intake hash   | `d03c5ab0bf5a` (gate passed 2026-11-01)                                                |
| Schema-routes | — (brief from scratch)                                                                 |
| Sources       | `intake-files/BRIEF.md`; the current code; clinozy-be's `plans/routes-final.md`        |
| Date          | 2026-11-01                                                                             |
| Plans with    | `fe-iteration-planning`; builds with `fe-kickoff-iteration`                            |
| Sibling       | clinozy-be `iterations/feat-short-delivery-2026-11-01-qfnq/` — the contract (SD1–SD14) |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md): D1 screens · D2 contract · D3 the
drawer's cells (AMBER) · D4 the view's marks (AMBER) · D5 approved.

## 3. Foundation

No token, shell, store or icon change.

## 4. Unit map

| Unit                                                  | Change                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/core/http/openapi-types.d.ts`, medical contracts | the line's received quantities and `is_short`, the order's `short_line_count`; the receive input |
| `…/purchases/components/ReceiveGoodsDrawer/`          | "Came" / "Free came" per ordered line, the total on what came                                    |
| `…/purchases/components/PurchaseOrderView/`           | the short chip per line, the count beside the summary                                            |
| `src/locales/*/`                                      | the new copy                                                                                     |

## 5. State management map

No store; the order (as today) and the receive mutation.

## 6. Build notes

- Received cells default to the ordered packs; 0…ordered; 0 + 0 → not arrived.
- The view: "Short · {{received}} of {{ordered}}" on a short line.

## 7. Verification

By `BRIEF.md:58`: unit tests for the drawer's cells and body, the view's marks; `pnpm health`.

## 8. The route — the ordered ledger

| #   | Work item                     | Kind       | Depends on | Skill/driver           | Acceptance    | Assignee | Status  |
| --- | ----------------------------- | ---------- | ---------- | ---------------------- | ------------- | -------- | ------- |
| L-1 | Contracts and types           | api        | BE         | fe-resource-crud       | types compile | Claude   | planned |
| L-2 | Receive goods: received cells | structural | L-1        | fe-code-structure      | A-7           | Claude   | planned |
| L-3 | Order view: short lines       | structural | L-1        | fe-code-structure      | A-7           | Claude   | planned |
| L-4 | Copy, docs, gates, close      | gate       | L-2, L-3   | fe-before-commit-guard | `pnpm health` | Claude   | planned |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                      | In plan at |
| ---------------------- | ----------- | ---------- | --------------------------------------- | ---------- |
| `BRIEF.md`             | yes         | the change | the screens (`:25–26`), criterion `:58` | §2–§8      |
