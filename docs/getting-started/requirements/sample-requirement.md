# Sample Requirement: Notifications Page

This is a **filled example** of the [requirement format](../requirement-format.md). Use it as a reference when writing your own.

---

## Requirement

### What

Notifications page where users see a list of notifications and can mark all as read.

### Where

New page at `/notifications`, under the authenticated dashboard (AppLayout).

### Acceptance criteria

- [ ] List shows each notification: title, body snippet, read/unread badge, created date.
- [ ] "Mark all as read" button at the top; when clicked, all items in the list become read and the button is disabled or hidden.
- [ ] Empty state when there are no notifications: message "You're all caught up" and optional icon.
- [ ] Loading state while fetching (skeleton or spinner).
- [ ] Error state with retry button if the request fails.
- [ ] Page is accessible (keyboard, screen reader, focus order).

### Data / API (if applicable)

- **Endpoint(s):**
  - `GET /api/notifications` — list notifications (query: `?read=false` optional).
  - `PATCH /api/notifications/read-all` — mark all as read (no body).
  - `PATCH /api/notifications/:id/read` — mark one as read (optional for row click).
- **Response shape (list item):** `{ id: string, title: string, body: string, read: boolean, createdAt: string }`.
- **Permissions:** `notifications.read` for viewing; `notifications.write` or `notifications.update` for mark-as-read (or reuse one permission for both if backend allows).

### UI / Behavior (if applicable)

- **Layout:** AppLayout (same as dashboard, with sidebar and header).
- **Forms/inputs:** Optional filter dropdown: "All" / "Unread" (can be phase 2).
- **Actions:** "Mark all as read" (button, top right); clicking a row can mark that notification as read (optional).
- **Validation / errors:** Show toast or inline error on API failure; retry button in error state.

### Constraints

- Use `apiClient` from `@/core/http/fetch-client.ts` for all API calls.
- Follow page-first structure: `route.tsx`, `NotificationsPage.tsx`, `contracts.ts`, `api.ts`, `hooks/useNotifications.ts`.
- Define Zod schemas in `contracts.ts`; validate API responses with `.parse()`.
- Register route in `src/app/routes/routeTree.tsx` (lazy) and add permission(s) in `src/core/rbac/policies.ts`.
- Add colocated tests and `data-testid` per project conventions (e.g. `notifications-page`, `notifications-list`, `mark-all-read`).
- Must be accessible (ARIA, focus, keyboard).

### Out of scope (optional)

- No push or real-time notifications (polling or manual refresh only for now).
- No pagination (single list; can add later).
- No delete or archive.
