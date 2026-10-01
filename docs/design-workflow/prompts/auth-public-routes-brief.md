# Auth & public routes — design brief

Everything outside the signed-in app shell. Audited from `routeTree.tsx`,
`LOGIN.OVERVIEW.md`, and `AuthForm/`.

Give this to Claude Design alongside the app-shell work.

---

## 0. Global — the system you're designing into

**Theme.** Tokens are OKLCH semantic tokens with light and dark for every value.
There is no hardcoded colour anywhere in app code — a screen is described by
token _names_, never hexes.

Two presets ship today. `flowdm` is the current default — emerald/teal accent,
full surface palette, ambient background (two radial glows plus a 26px dot grid,
fixed attachment). `claude` is accent-only warm terracotta on neutral surfaces —
it inherits all backgrounds from the base palette.

**Design against tokens, not colours.** If a screen needs a new colour, it needs
a new _token_ — say so explicitly and give light and dark values.

**Fonts** are self-hosted (Sora, Plus Jakarta Sans, DM Mono today). A webfont CDN
is blocked by CSP, so any new family must be self-hostable.

**Two layouts, and they are independent.** Routes are grouped under one of two
chromes. This is a routing fact, not a design suggestion:

| Layout     | Routes it owns                                                             |
| ---------- | -------------------------------------------------------------------------- |
| **Auth**   | `/login` · `/mfa`                                                          |
| **Public** | `/callback` · `/onboarding` · `/accept-invite/:id` · `/unauthorized` · 404 |

**Edit the auth chrome → both auth routes change, public routes untouched.**
Edit the public chrome → all five change, auth untouched. That independence is
the point: restyling sign-in should not touch the 404 page.

So split every spec into two parts:

1. **Chrome** — the frame. Specified **once per layout**, never per route.
2. **Content** — what sits inside it. Per route, free to differ.

A spec that describes `/login`'s frame and `/mfa`'s frame separately, with small
unexplained differences, cannot be built as written — I'd have to pick one and
silently drop the other.

**I am not going to tell you what these layouts should look like.** How they're
arranged, what's on screen, how they respond — that's the work. §5 says what to
return.

**Content that exists today** — this is copy, not layout. Use it, place it
wherever your design wants, or propose changes explicitly:

| Slot      | Current value                                                     |
| --------- | ----------------------------------------------------------------- |
| Feature 1 | **Multi-org by design** — "Switch teams without switching tools." |
| Feature 2 | **Secure by default** — "RBAC, MFA, passkeys, and audit trails."  |
| Feature 3 | **Fast everywhere** — "Built for keyboard-first, real-time work." |
| Stats     | **10k+** teams · **99.99%** uptime · **SOC 2** compliant          |

Don't quietly substitute different claims — I can't ship a metric the company
hasn't verified. If you want to change or drop them, say so as a proposal.

**Deployment modes.** The same app ships in three configurations, and this
changes what some screens show — most visibly onboarding. Never assume one:

| Mode                | Meaning                                                     |
| ------------------- | ----------------------------------------------------------- |
| `personal-only`     | Solo workspaces. No teams, no invites, no workspace picker. |
| `team-only`         | Team organisations only.                                    |
| `personal-and-team` | Both — a personal workspace plus optional teams.            |

**Every screen needs:** light + dark, mobile behaviour, exact copy, every state,
icon names.

**Also tell me, per route:**

- **Does the arrangement change by breakpoint?** If so, say the exact px and
  what changes.
- **What's shared between routes?** If two screens use the same component, say
  so explicitly — it gets built once. The 6-digit code input is the obvious one.
- **How do I preview an error state?** A demo trigger (e.g. a reserved code that
  always fails) makes states reviewable without breaking the backend.

---

## 1. Auth shell routes

### `/login` — unified entry ⚠️ read this carefully

**One route for both sign-in and sign-up. Users never choose between them.** The
backend responds identically whether the email is known or not — that uniformity
is deliberate (it prevents account-existence leaking), so the UI must not hint
at which case it is.

**There is no password.** No password field, no "forgot password", no strength
meter, no separate register screen. Do not design any of them.

Methods, in the order they're presented:

1. **Continue with Google**
2. **Continue with GitHub**
3. **Continue with Apple**
4. **Continue with a passkey**
5. **Email one-time code** — open by default, sits _below_ the providers

Providers are individually env-gated, so design for **any subset being absent**,
including all of them (email-only) and only one.

**Two panels, one route:**

_Panel A — email entry._ Welcome copy, provider buttons, passkey, email field,
Continue.

_Panel B — code verification._ Reached after Continue. **Provider buttons and
the welcome copy are hidden here** — the panel narrows to "check your email" plus
a 6-digit code input. Also needs: resend, and change-email (back to panel A).

The 6-digit input is one box per digit and must accept a pasted code.

States: idle · sending · code sent · verifying · invalid code · expired code ·
resend cooldown · rate-limited · provider error returning from OAuth.

After verifying: a brand-new account goes to onboarding, a returning one goes to
the app. **The UI cannot know which** until the response arrives — so the
transition needs to work for both.

### `/mfa` — second factor

Shown after a first factor when the account has 2FA on.

- 6-digit authenticator code (same input pattern as above)
- Use a recovery code instead
- Trust this device

States: idle · verifying · wrong code · attempts exhausted · locked out.

---

## 2. Public shell routes

### `/callback` — returning from a provider

Transitional. The user lands here mid-redirect from Google/GitHub/Apple; the app
exchanges the result and moves on. Usually visible for under a second.

Needs: a calm loading treatment that doesn't flash, and a real failure state —
provider denied, cancelled, or errored — with a way back to `/login`.

This is the app's **blocking-transition** loading case. It should use the same
treatment as app boot rather than a one-off — see the loading system in
`extract-system-surfaces-prompt.md` §D2, and keep them consistent.

### `/onboarding` — first run ⚠️ six steps, and the sequence is conditional

Every freshly authenticated user lands here exactly once.

**This is not a two-step wizard.** The full step set is:

`welcome` → `profile` → `questions` → `workspace` → `invite` → `done`

**Which steps appear depends on the deployment mode** (see §0). Three distinct
sequences exist — design the indicator so it works for all of them:

| Mode                                 | Steps                                                     | Count |
| ------------------------------------ | --------------------------------------------------------- | ----- |
| Personal-only                        | welcome · profile · questions · done                      | 4     |
| Team-only                            | welcome · profile · questions · workspace · invite · done | 6     |
| Personal-and-team, no team org yet   | welcome · profile · questions · done                      | 4     |
| Personal-and-team, already in a team | welcome · profile · questions · invite · done             | 5     |

A "Step 2 of 2" style indicator will be wrong in three of these four cases. The
count is only known at runtime.

**What each step contains:**

| Step      | Contents                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome   | Greeting + what's about to happen. No input.                                                                                                         |
| Profile   | First name, last name. Two fields.                                                                                                                   |
| Questions | **Optional** — team size, use case, referral source. Presented as selectable chips, not a form. Fully skippable.                                     |
| Workspace | Workspace name, plus a **live URL preview** updating as they type (`core.app/<slug>`). Prefilled from their work email domain when one is available. |
| Invite    | Teammate email addresses, validated as entered, multiple. Skippable.                                                                                 |
| Done      | Confirmation, then into the app.                                                                                                                     |

**It is resumable.** Progress persists, so closing the tab mid-flow and
returning resumes at the same step. The design needs to accommodate arriving at
step 4 cold, with no memory of steps 1–3.

Needs: a step indicator that handles a variable total, back/next, and a clear
distinction between steps that are skippable (questions, invite) and those that
aren't (profile, workspace).

### `/accept-invite/:invitationId` — someone was invited

Opened from an email link, often on a phone, often while signed out.

Shows: who invited them, which workspace, what role they'd get. Accept /
decline.

States: loading · valid · already accepted · expired · revoked · signed in as
the wrong account (needs a clear switch-account path) · not signed in (auth
first, then return here).

This screen carries more failure states than any other — please give each one
real copy.

### `/unauthorized` — signed in, not allowed

They're authenticated but lack permission for what they asked for. Needs an
explanation that doesn't feel like an error page, and a route back to somewhere
they _can_ reach.

---

## 3. Routes with no shell

### `/` — resolver

Redirect only, renders nothing. **Nothing to design** — listed so you don't
wonder where the home page is.

### `/organization` — workspace picker

For someone in more than one workspace. Currently hangs off the root with **no
shell at all** — worth your opinion on whether it should adopt the public shell,
the app shell, or stay bare.

Needs: list with search, create-new, and an empty state for someone with none.

### `$` — not found

Catch-all. Same treatment family as `/unauthorized`.

---

## 4. What may need creating — your call

None of these exist today. Say whether your design implies them:

| Candidate                 | Why it might be needed                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| Legal / policy pages      | The public shell exists but no content route uses it. Terms, privacy, status. |
| Sign-out confirmation     | Today it's immediate. Worth a pause?                                          |
| Session-expired landing   | Currently a dialog inside the app; could be a route when arriving cold.       |
| Maintenance / outage      | Nothing today.                                                                |
| Email-change confirmation | If profile settings allow it, the link needs somewhere to land.               |

Please don't invent a password-reset or registration route — the unified,
passwordless entry above replaces both by design.

---

## 5. What to return

### A. Four layout directions — then two chosen layouts

**Step 1 — explore.** Produce **four distinct layout directions.** Not four
variations on one idea — four genuinely different answers to "what should a
signed-out screen feel like for this product".

For each direction give a name, a one-line rationale, and enough of a rendering
to judge it. Show each applied to **one auth route and one public route**, so I
can see how the same thinking handles a marketing-weighted moment and a
transitional one.

Range matters more than polish here. If all four share a structure, that's one
direction rendered four ways — push harder.

**Step 2 — I pick.** I'll choose one direction, or ask you to combine two.

**Step 3 — build two JSX layouts** from the chosen direction:

| File               | Owns                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| `AuthLayout.jsx`   | `/login` · `/mfa`                                                          |
| `PublicLayout.jsx` | `/callback` · `/onboarding` · `/accept-invite/:id` · `/unauthorized` · 404 |

Same visual family, different weight — sign-in is a destination, a callback
screen is a doorway. How that difference expresses itself is your call.

**Rules for both files:**

- Each takes **`children`** for route content and owns everything around it.
- **Independent** — no shared parent wrapper. If both genuinely need the same
  element, that's a **third shared component**, named explicitly, not duplicated.
- **Responsive arrangements live inside the one file** — a breakpoint or a prop,
  not separate files.
- **Presentational only.** No routing, no data fetching, no auth calls. Static
  placeholder text where content comes from the app.

### B. One markdown file per route

Content only — the chrome is the JSX. For `/login`, cover **both panels**
separately.

### C. A short note on

- Which direction you chose and what you'd have lost with the others
- How the two layouts differ, and why
- What changes at each breakpoint, with exact px
- What's shared between routes and should be built once
- Anything you'd want to change about the existing content

---

## 6. Naming, for porting only

When your layouts contain something equivalent to the list below, using the same
name makes the port mechanical instead of interpretive. **This is a glossary, not
a shopping list** — if your design has no equivalent, it doesn't need one:

`SkipLink` · `BrandMark` · `MobileBrandMark` · `AuthControls` (theme + language)
· `AuthForm` (the card wrapping route content) · `PublicMain`

Anything you invent, name clearly and say what it does.
