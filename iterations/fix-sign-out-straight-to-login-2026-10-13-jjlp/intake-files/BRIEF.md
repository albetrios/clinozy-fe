# Brief — Sign out goes straight to the login screen

<!--
Written from the user's report, 2026-10-13: "when you click on logout full app is changing — it
should be stay where they are or after clicking on logout — directly redirect to login without
halt anywhere".
-->

## What changes

Choosing **Log out** (the Account menu, the command menu, the session-timeout dialog and its
deadline, the 403 page's Sign out), a session the server ends, and another tab's sign-out all
leave the app the same way:

- **The screen stays as it is** until the login screen replaces it. Nothing on it empties,
  reloads or redraws after the click: the account menu keeps its identity, the section bar keeps
  its rooms, the lists keep their rows.
- **Then the login screen, directly.** No boot splash and no full-page loader between the app and
  the login screen, and the login screen does not wait for the network before it shows.

Today the click first repaints the app — the account empties, the rooms behind a permission
vanish, every list drops to a loading state and asks the server again without a token — then the
browser loads `/login`, where the boot splash plays its full sequence (≥ 2,050ms to the wordmark,
then a 500ms fade) while the login screen waits for a refresh and a revoke to answer.

## Why

Signing out is the moment the user wants to be gone. The app breaking apart on screen reads as a
fault, and the splash and the network wait read as the app hanging after it.

## Affected screens, entities and routes

- Screens: shell (the Account menu's Log out), splash (skipped on the load after a sign-out), the
  login screen (shown at once)
- Entities: none
- Routes: none — `POST /auth/logout` and `POST /auth/refresh` are unchanged; only when the client
  waits for them changes

## Rules

- **Nothing of the session may survive into the next one.** The sign-out still ends in a full page
  load of `/login` — that is what guarantees no draft, outbox, cached file link or store of one
  user is in memory when the next person signs in on a shared clinic computer. Only the moment
  each part is cleared moves: what the screen does not show (the token, its refresh timer, the
  session hint, the onboarding progress saved on this device) at once; what it shows (the user,
  the organization and its permissions, the cached records) as the page goes.
- **A page the browser's back/forward cache kept must never show again** after a sign-out — it
  loads again instead.
- **The server still ends the session.** The revoke still goes out with the click; when its answer
  is not seen, the next load still finishes it before anyone can be signed back in — but behind
  the login screen, not in front of it. A sign-in waits for that revoke to finish, so the old
  session's refresh cookie can never land on top of the new one.
- The boot splash still plays on every other load (a cold open, a reload, an update).

## Acceptance criteria

- [ ] After Log out, nothing on the app's screen changes before the login screen replaces it (the
      stores and the query cache are cleared on `pagehide`, not before).
- [ ] The load of `/login` that follows a sign-out shows no boot splash and no full-page loader.
- [ ] The login screen renders without waiting for `/auth/refresh` or `/auth/logout` to answer,
      even with the revoke still owed to the server.
- [ ] A sign-in request sent while that revoke is still running waits for it to finish first.
- [ ] Going Back to the app after a sign-out never shows the old page from the back/forward cache.
- [ ] Another tab's sign-out leaves this tab the same way; a tab already on `/login` clears at
      once.
- [ ] Every other load still plays the splash as before.

## Out of scope

- The design's "Signed out" card (launch Standing deviation "Sign-out" — it stays the platform
  `/login`).
- Asking about unsaved changes before signing out.
- Any change in clinozy-be.
