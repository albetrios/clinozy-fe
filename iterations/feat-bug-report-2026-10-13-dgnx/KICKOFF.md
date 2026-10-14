# Report a bug, by text or voice — kickoff plan

> **Status: approved on 2026-10-13** under the user's instruction "don't ask me anything — go ahead
> with your recommendation" (D12). Every decision is in [`plans/decisions.md`](plans/decisions.md).
> `fe-kickoff-iteration` builds the ledger in order (§7); what was built goes in `AS-BUILT.md`. The
> backend's half is clinozy-be's same-named iteration.

## 1. Header

| Field            | Value                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/feat-bug-report-2026-10-13-dgnx/` · **initial** (type `feat`, Baseline `none`, D1)                            |
| Intake           | none — the requirement is §2 (D1)                                                                                         |
| Date             | 2026-10-13                                                                                                                |
| Branch           | `feat/bug-report` (D2)                                                                                                    |
| Planned by       | `fe-iteration-planning` (this file)                                                                                       |
| Built by         | `fe-kickoff-iteration`                                                                                                    |
| Sibling          | clinozy-be `feat-bug-report-2026-10-13-dgnx` — `POST /api/v1/users/me/bug-reports`, the reporter stamped from the session |

## 2. The request

The "Report a Bug" form — today Sentry's feedback widget with **Name**, **Email**, **Description**
and **Add a screenshot** — becomes **one textbox with a native voice icon**, with an animation worth
using; the signed-in person's name and user id go with the report and the backend stores them.

**In scope:** our own trigger and panel; native speech-to-text; the animation; the report sent to
clinozy-be; Sentry's feedback widget removed; the corner placement rules carried over; every
language.

**Out of scope:** a screenshot or attachment; a list of past reports; anything for signed-out
visitors (D8).

## 3. Locked decisions

| #   | Decision                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------- |
| D3  | Sentry's feedback widget is **replaced**, not restyled; Sentry keeps errors, logs and recordings            |
| D4  | One textbox + one voice button + Send — no name, email or screenshot                                        |
| D5  | The browser's own `SpeechRecognition`; no voice button where there is none (Firefox)                        |
| D6  | Dictation appends; interim words live and softer; `typed` · `voice` · `mixed` recorded                      |
| D7  | CSS-only choreography (wiggle, unfold, orb + ripples + equalizer, shimmer, drawn check); reduced motion off |
| D8  | Trigger in the signed-in app shell, bottom-end; Sentry's corner rules move to `feedback-trigger`            |
| D9  | Non-modal panel anchored to the trigger (Radix Popover)                                                     |
| D10 | `page_path` (pathname only) + `app_version`; identity from the session                                      |
| D11 | Every shipped language, `bug-report` namespace                                                              |

## 4. Surfaces

| Surface        | Where                                                               | Access    | Kind                                |
| -------------- | ------------------------------------------------------------------- | --------- | ----------------------------------- |
| The trigger    | `src/shared/components/BugReport/` (`BugReportLazy` in `AppLayout`) | signed in | floating pill, bottom-end           |
| The panel      | the same folder (`BugReportPanel`)                                  | signed in | non-modal popover                   |
| Speech-to-text | `src/shared/hooks/useSpeechRecognition/`                            | —         | hook over the Web Speech API        |
| The request    | `src/shared/api/bug-report-api.ts` + `bug-report-contracts.ts`      | —         | `apiClient.post`, Zod-parsed answer |

## 5. State

| Piece                    | Server state                 | Client state                                   |
| ------------------------ | ---------------------------- | ---------------------------------------------- |
| The report being written | —                            | component `useState` (text, voice used, typed) |
| Listening, interim words | —                            | `useSpeechRecognition`                         |
| Sending                  | TanStack Query `useMutation` | —                                              |
| Open / closed            | —                            | component `useState`                           |

## 6. The panel

```text
            ┌──────────────────────────────────────────┐
            │ 🐞 Report a bug                       ✕  │
            │ What went wrong? Type it or tap the mic. │
            │ ┌──────────────────────────────────────┐ │
            │ │ The invoice total doesn't update     │ │
            │ │ after I remove a line… ░listening░   │ │
            │ │                                      │ │
            │ └──────────────────────────────────────┘ │
            │ (◉))) ▂▅▇▅▂  Listening…        [ Send ➤ ]│
            │ Sent as Asha Rao · we'll see where you   │
            │ were and which version you're on.        │
            └──────────────────────────────────────────┘
                                         ( 🐞 Report a bug )   ← trigger, bottom-end
```

## 7. Ledger

| #   | Work item                                                                                       | Skill                                                                                 | Status |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| 1   | `bug-report-contracts.ts` + `bug-report-api.ts` (the request)                                   | `fe-http-forms-errors`, `fe-test-generation`                                          | done   |
| 2   | `useSpeechRecognition` (native speech-to-text)                                                  | `fe-resilient-interactions`, `fe-test-generation`                                     | done   |
| 3   | `BugReport` trigger + panel + animation; mounted in `AppLayout`                                 | `frontend-design`, `emil-design-eng`, `shadcn`, `fe-e2e-testids`, `fe-i18n-constants` | done   |
| 4   | Sentry's `feedbackIntegration` removed; `index.css` corner rules re-keyed to `feedback-trigger` | `fe-code-quality-security`                                                            | done   |
| 5   | Copy in every language; docs (overview, `docs/integrations/sentry-frontend.md`)                 | `fe-i18n-constants`, `fe-documentation-maintenance`                                   | done   |

## 8. Acceptance

- [ ] Signed in, a "Report a bug" pill sits in the bottom-end corner; signed out it is not there.
- [ ] It opens a panel with one textbox, a voice button (where the browser has speech recognition) and Send — no name, email or screenshot.
- [ ] The voice button dictates into the textbox in the app's language; the animation runs while listening and stops when it stops; a refused microphone says so.
- [ ] Send posts `{ description, input_method, page_path, app_version }` to `POST /api/v1/users/me/bug-reports`; the check plays and the panel closes; a failure keeps the text and says so.
- [ ] Sentry's own feedback button no longer appears.
- [ ] Reduced motion: nothing moves but the content.
- [ ] Every string is translated in every shipped language.
