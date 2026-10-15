# KICKOFF — feat-payment-celebration-2026-10-15-xpkw

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Iteration     | `feat-payment-celebration-2026-10-15-xpkw`                                                              |
| Mode          | initial — from scratch                                                                                  |
| Baseline      | `none`                                                                                                  |
| Intake mode   | brief — `BRIEF.md` alone, the whole snapshot                                                            |
| Intake hash   | `48109b9730e6` (gate passed 2026-10-15)                                                                 |
| Schema-routes | — (the frontend stores the brief alone; clinozy-be's intake carries `schema-routes.md`, D6)             |
| Sources       | `intake-files/BRIEF.md`; the current code; the drawer and section survey                                |
| Date          | 2026-10-15                                                                                              |
| Standard      | `emil-design-eng` + `review-animations/STANDARDS.md`; `docs/reference/design.md` §5                     |
| Plans with    | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills)                    |
| Sibling       | clinozy-be `iterations/feat-payment-celebration-2026-10-15-xpkw/` — `review_link` on `/app/branches/my` |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md); every motion finding is a
row in [plans/motion-audit.md](plans/motion-audit.md).

1. **D1** — Every drawer and section checked; the payment moment; the review ask; before the review page.
2. **D2** — The moment lives inside the drawer that took the payment; Done closes it.
3. **D3** — The ask: WhatsApp with the branch's Google review link, or logged at the desk.
4. **D4** — An original Lottie animation (LottieFiles is unreachable here); swappable.
5. **D5** — Same branch, a third iteration, one PR later.
6. **D6** — `review_link` on `/app/branches/my` in clinozy-be; both repositories.
7. **D7** — lottie-web's light SVG player, dynamic import, no eval.
8. **D8** — The animation's colours come from tokens through layer class names.
9. **D9** — Receipts, invoices paid now and credits got back celebrate; edits and other kinds keep their toast.
10. **D10** — Short (≈ 0.85s), never blocking, once per payment, last frame under reduced motion.
11. **D11** — A Google review counts as reviewed.
12. **D12** — The chat composer's Review template, queued through the chat's send path.
13. **D13** — Room tabs and patient-file sections are not a page change; the thumb travels across the remount.
14. **D14** — Bottom sheets: one override in the primitive.
15. **D15** — Kept as they are, with reasons.
16. **D16** — Approved under the user's requests.

## 3. Foundation

### 3.1 Theme

No token changes. The animation's stylesheet (co-located, lazy) paints its layers from
`--color-success`, `--color-success-foreground` and the tones' `--color-tone-<tone>-dot`.

### 3.2 Shell

`PageTransition` learns the same-room mark (D13). The bottom-sheet primitive carries the sheet
motion (D14).

### 3.3 Stores · 3.4 Icons

None. The view uses existing icons (`Star`, `MessageCircle`, `Check` from the icon registry).

## 4. Unit map

| Unit                                                                                                | Change                                                                                             |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `package.json` + `pnpm-lock.yaml`                                                                   | `lottie-web` 5.13.0 (one atomic commit)                                                            |
| `src/shared/components/LottiePlayer/` (new)                                                         | loads the light player on demand; plays once; last frame under reduced motion; a typed module shim |
| `src/shared/components/PaymentReceived/` (new)                                                      | the view, `payment-received.lottie.json`, its stylesheet, the review section, hooks, tests         |
| `src/shared/api/app/branches-*` + `BranchDrawer`                                                    | `reviewLink` on my branches; the Google review link field                                          |
| `src/shared/api/app/contact-activities-api.ts`                                                      | the template values' `reviewLink` from the branch                                                  |
| `…/payments/components/ReceivePaymentDrawer/`                                                       | a new receipt → the view                                                                           |
| `src/shared/components/InvoiceDrawer/`, `SettleCreditDrawer/`                                       | paid now / got back → the view                                                                     |
| `src/shared/components/ui/drawer.tsx`, `PickerSheet`, `AllSections`                                 | the sheet motion in the primitive; callers' overrides removed                                      |
| `src/lib/animations/PageTransition.tsx`, `RoomTabs`, `PatientFileBar` + the sections popover        | the same-room mark                                                                                 |
| `src/shared/components/SelectionGlide/`                                                             | `continuity`: a remounted track starts from where its thumb was                                    |
| `feedback-carousel.ts`, `reveal-in-scroller.ts`                                                     | smooth only with motion allowed                                                                    |
| `RoleSwitchCard`, `drawer-choice-controls`, `TaskRulesPopover`, `SetupStepsDrawer`, `ConsentBanner` | one switch, one progress bar, the banner's entrance                                                |
| `src/locales/*/` (11 locales)                                                                       | the view's copy, the branch field                                                                  |
| `docs/reference/design.md` §5, overviews, `motion-stylesheets.test.ts`                              | the payment moment, same-room navigation, sheets; the new stylesheet in the policy                 |

## 5. State management map

No store. Server state: the payment's result (already in hand), `usePatientFeedback` (reviews),
`useBranches` (the link), the send-message mutation. Component state: the view's "queued" flag.

## 6. Build notes

- **The animation (D4, D8, D10):** 160 × 160, 60 fps, 52 frames (≈ 0.87s). A solid disc scales
  in (0.6 → 1.06 → 1, frames 0–24); the check draws (trim 0 → 100%, frames 10–30, strong
  ease-out); a ripple ring grows and fades (frames 14–44); eight sparks fly out and fade (frames
  16–48), alternating four tones. Layers named `pr-disc`, `pr-check`, `pr-ripple`, `pr-spark-*`.
- **The view:** a RecordDrawer body; the animation (88px) centred above "₹2,000 received",
  "from Bhooshan Patel · Cash + UPI · PAY-5512", the invoice line, then the review section, and
  the footer's primary **Done**. The body crossfades in (strong ease-out, 200ms).
- **The review section:** `usePatientFeedback(patientId)`; three newest reviews; "All N reviews" →
  the patient file's Clinical notes; the ask → `Send on WhatsApp` (needs a contact, the message
  right and the branch's link) and `Log a review` (`patient_review:create`,
  `organizationReviewCreate`).
- **Same-room mark (D13):** RoomTabs links and the patient file's section navigation pass history
  state `{ samePage: true }`; `PageTransition` updates its key without replaying. SelectionGlide's
  `continuity` key remembers the thumb's last box for 1s after unmount.

## 7. Verification

By Intake mode `brief`: each `BRIEF.md` criterion with its proof — unit tests (the view, the
review states, the player's reduced-motion path, the same-room mark, the sheet classes, the
continuity), the motion policy test, and the running app against clinozy-be: a payment received
at full speed and at 0.25×, every review state, a tour of every drawer at 0.25×, the sheets on a
phone, patient-file section switches, dark, Arabic, reduced motion; `pnpm size`.

## 8. The route — the ordered ledger

| #    | Work item                                                                                | Kind       | Depends on | Skill/driver                               | Acceptance             | Assignee | Status |
| ---- | ---------------------------------------------------------------------------------------- | ---------- | ---------- | ------------------------------------------ | ---------------------- | -------- | ------ |
| L-1  | lottie-web, `LottiePlayer`, the authored animation and its stylesheet                    | global     | —          | fe-dependency-management · emil-design-eng | criterion 3            | Claude   | todo   |
| L-2  | `PaymentReceived` view                                                                   | structural | L-1        | fe-code-structure · emil-design-eng        | criterion 1            | Claude   | todo   |
| L-3  | The review section: previous reviews, the ask, Log a review                              | structural | L-2        | fe-code-structure                          | criterion 4            | Claude   | todo   |
| L-4  | The branch's review link: contracts, Branch drawer, template values, Send on WhatsApp    | api        | L-3, BE    | fe-resource-crud                           | criteria 5–6           | Claude   | todo   |
| L-5  | Receive payment → the view                                                               | wiring     | L-2        | fe-kickoff-iteration                       | criterion 1            | Claude   | todo   |
| L-6  | Invoice paid now, credit got back → the view                                             | wiring     | L-5        | fe-kickoff-iteration                       | criterion 2            | Claude   | todo   |
| L-7  | Bottom sheets in the primitive                                                           | styling    | —          | shadcn · emil-design-eng                   | criterion 7            | Claude   | todo   |
| L-8  | Same room, no page rise; the thumb's continuity                                          | structural | —          | emil-design-eng                            | criterion 8            | Claude   | todo   |
| L-9  | Smooth scrolls, toggles, progress, cookie banner                                         | styling    | —          | emil-design-eng                            | criterion 9            | Claude   | todo   |
| L-10 | Copy in every locale                                                                     | copy       | L-2–L-6    | fe-i18n-constants                          | `pnpm sync:check`      | Claude   | todo   |
| L-11 | Docs and the motion policy                                                               | copy       | L-1–L-10   | fe-documentation-maintenance               | `pnpm docs:lint`       | Claude   | todo   |
| L-12 | Verify in the running app: the moment, the review states, every drawer, sheets, sections | verify     | L-1–L-11   | fe-kickoff-iteration                       | every criterion proven | Claude   | todo   |
| L-13 | Gates                                                                                    | gate       | L-12       | fe-before-commit-guard                     | criterion 10           | Claude   | todo   |
| L-14 | Close: `AS-BUILT.md`, Status `done`                                                      | verify     | L-13       | fe-kickoff-iteration                       | README Status `done`   | Claude   | todo   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                | In plan at |
| ---------------------- | ----------- | ---------- | ------------------------------------------------- | ---------- |
| `BRIEF.md`             | yes         | the change | twelve changes, rules, ten criteria, out of scope | §2–§8      |
