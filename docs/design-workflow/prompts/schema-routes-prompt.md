# Paste this to Claude Design

Produces **one** file — `schema-routes.md` — the data model and route map implied
by the design, written at the level a **senior engineer** needs to build contracts
and a route tree without seeing the design. Save it into the drop folder with the
rest of the drop, place the drop with `pnpm iteration:intake <iteration>
<drop-folder>` (`--both` when the backend changes too), then say **"plan
iteration <iteration>"**. (Theme comes from `preset.md`, UI from the screen files
— `shell.md`, `_index.md` and one `<slug>.md` per screen — do **not** repeat them
here.)

Fill in the design source under **SCOPE**. Every drop is complete, so the screens
to cover are always every screen — the delta between iterations comes from
comparing drops. Everything else is paste-as-is.

---

You are reverse-engineering the **data schema** and **route map** out of a UI
design for a senior developer who **cannot see your design**. They will write
typed data contracts, API calls, and the app's routes from this markdown alone. A field
you leave vague becomes a wrong type; a route you leave implicit becomes a wrong
URL.

Do not describe the UI (that lives in the screen files). Specify only **data** and
**navigation**.

## SCOPE

- Screens to cover: every screen (each drop is complete)
- Design source: `<project name / file / URL>`

## OUTPUT

**Return exactly ONE markdown file and nothing else** — no prose before or after
it, no second file. The file is named `schema-routes.md`, in this order:

```text
schema-routes.md
├── # Route map        ← every URL, params, access, nesting
├── # Entities         ← every data object, one section each, every field typed
├── # Relationships    ← cardinality between entities
├── # Enums            ← every closed value list, all values
└── # Operations       ← per screen: reads, writes, params, optimistic? errors
```

Output it in one fenced block, prefixed with its filename:

````markdown
**`schema-routes.md`**

```markdown
<contents>
```
````

## CONVENTIONS (closed rules — follow these exactly)

Your output must fit these — do not invent alternatives:

1. **Org-scoped URLs.** Every in-app screen lives under
   `/organization/:organizationSlug/<feature>/...`. Auth screens (`/login`, …)
   sit outside it. Params are `:camelCase`.
2. **CRUD URL convention** (resource screens):

   | Action | URL                    | Renders          |
   | ------ | ---------------------- | ---------------- |
   | List   | `/<resource>`          | Page             |
   | Create | `/<resource>/create`   | Dialog over list |
   | Show   | `/<resource>/:id`      | Page or dialog   |
   | Edit   | `/<resource>/:id/edit` | Dialog over list |
   | Delete | (no URL)               | Inline confirm   |

3. **Type vocabulary.** Write every field type using exactly this vocabulary:
   `string (uuid)`, `string (email)`, `string (ISO 8601 UTC datetime)`,
   `number (int, ≥0)`, `enum: <name>`, `array<X> (max N)`, `X | null`.
4. **Data is fetched per screen.** The Operations section must list every read
   and every write a screen performs — it is the complete data surface of that
   screen; nothing else exists to the developer.

## HARD RULES

1. **Every field is fully typed.** Type + format + required/optional +
   nullable + default + constraints (min/max, length, pattern). `title: string`
   is incomplete; `title: string, required, 1–120 chars, trimmed` is a spec.
2. **Every enum is a closed list with every value spelled out** — the exact
   value strings the UI shows AND the machine value if they differ
   (`"In progress"` ↔ `in_progress`). A status you saw in one badge is a value
   the developer must handle everywhere.
3. **IDs and relations are explicit.** Every entity names its id type; every
   reference field says which entity it points to and the cardinality
   (1:1, 1:N, M:N) and what happens on delete (cascade / restrict / null).
4. **Every route is a row.** Full path with `:params`, which screen it renders,
   access (role/permission or public), parent layout, and whether it is a full
   page or a URL-driven dialog over another route. No screen without a route; no
   route without a screen (or say it is a redirect/resolver).
5. **List queries are parameterized.** For every list: pagination shape (page
   size, cursor or offset), sortable fields + default sort, filterable fields +
   their types, and the search field(s) if search exists.
6. **Writes are contracts.** For every create/update: the exact input fields
   (subset of the entity), which are server-set (id, timestamps, computed), the
   success result, and the error cases the UI distinguishes (validation,
   conflict, permission, not-found).
7. **Derived vs stored.** If a value shown in the UI is computed (counts,
   "last active 2h ago", percentages), say so and give the formula/source —
   never let it be mistaken for a stored field.
8. **Timestamps are ISO 8601 UTC**; money has currency + minor-unit note; every
   free-text field has a max length.
9. If something genuinely does not apply, write `n/a` and one clause saying
   why. Never leave a field silently blank, and never drop a row.

## PART 1 — `# Route map`

```markdown
# Route map

| Route (full path) | Screen | Kind                                    | Parent layout                         | Access                      | Params                  | Notes |
| ----------------- | ------ | --------------------------------------- | ------------------------------------- | --------------------------- | ----------------------- | ----- |
|                   |        | <page / dialog-over:<route> / redirect> | <app shell / auth shell / full-bleed> | <role/permission or public> | <:param → entity.field> |       |

- Default route after sign-in: <path>
- Not-found behaviour: <what renders>
- Deep-link rules: <which dialogs are URL-addressable; what a direct hit renders behind them>
```

## PART 2 — `# Entities` (repeat for every entity)

```markdown
## Entity: <Name>

One-line purpose. Which screens read it; which write it.

| Field | Type (from the vocabulary) | Required | Nullable | Default | Constraints | Server-set? | Notes |
| ----- | -------------------------- | -------- | -------- | ------- | ----------- | ----------- | ----- |
| id    |                            |          |          |         |             |             |       |
|       |                            |          |          |         |             |             |       |

Derived/display-only values (never stored): <field → formula/source, or n/a>
```

## PART 3 — `# Relationships`

```markdown
# Relationships

| From | To  | Cardinality | Via field | On delete | Notes |
| ---- | --- | ----------- | --------- | --------- | ----- |
|      |     |             |           |           |       |
```

## PART 4 — `# Enums` (repeat for every enum)

```markdown
## Enum: <name>

| Machine value | UI label (verbatim) | Meaning / when set |
| ------------- | ------------------- | ------------------ |
|               |                     |                    |
```

## PART 5 — `# Operations` (repeat for every screen)

```markdown
## Screen: <name> (<route>)

### Reads

| Operation | Entity | Params (filters, sort, pagination) | Refetch triggers |
| --------- | ------ | ---------------------------------- | ---------------- |
|           |        |                                    |                  |

### Writes

| Operation | Input fields | Success result + UI effect | Error cases the UI distinguishes | Optimistic? |
| --------- | ------------ | -------------------------- | -------------------------------- | ----------- |
|           |              |                            |                                  |             |
```

## BEFORE YOU RETURN — self-check

Re-read your own output and confirm each. If any is "no", fix it before
returning:

- [ ] Output is a **single** `schema-routes.md` — no other files
- [ ] Every screen from the design appears in the **Route map**, and every route follows the **CRUD/org-scoped conventions**
- [ ] Every route states **access** and **page vs dialog-over**
- [ ] Every entity field has **type + required + nullable + default + constraints**
- [ ] Every enum lists **every value**, machine value and verbatim UI label
- [ ] Every relation states **cardinality and on-delete**
- [ ] Every list states **pagination, default sort, filters**
- [ ] Every write states **input fields, server-set fields, and distinguished error cases**
- [ ] Every derived value is **marked derived with its formula**
- [ ] Every blank is `n/a` **with a reason** — nothing silently removed

Report at the end: `Routes: N. Entities: N. Enums: N. Operations: N. Fields
marked n/a: M. Gaps I could not resolve: <list, or none>.`

---

## After it returns

1. Save `schema-routes.md` into the drop folder with the rest of the drop —
   one file, as returned.
2. Place the drop: `pnpm iteration:intake <iteration> <drop-folder>`. It copies
   the files into `iterations/<iteration>/intake-files/` exactly as delivered
   and records the file's fingerprint in the README. When the backend changes
   too, add `--both`: `PRD.md` and `schema-routes.md` also go, byte-for-byte,
   into the same-named clinozy-be iteration (open it in both with
   `pnpm iteration:new … --both`) — the backend builds its contracts from them.
3. Say **"plan iteration <iteration>"**.

I'll turn the entities and enums into typed data contracts, the operations into
data hooks, and the route map into the app's route registrations (access guards
from the Access column) — anything ambiguous comes back to you as a question
rather than becoming a guess.
