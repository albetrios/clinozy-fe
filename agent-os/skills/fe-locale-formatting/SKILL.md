---
name: fe-locale-formatting
description: Format dates, times, numbers and money through useLocaleFormat so Appearance prefs apply — never bare Intl or toLocaleString. Use when rendering any date, number or money value.
trigger: src/lib/i18n/format.ts, **/useLocaleFormat/**, **/*.constants.ts
triggerNote: And any date, number or money render; constants only when they hold dates or numbers
---

# Locale formatting (clinozy-fe)

Every user-visible date, time, number and money value must route through
`useLocaleFormat()` (or `format*Value` in `src/lib/i18n/format.ts`) so the user's
Appearance preferences — format locale, timezone, date style, hour cycle, number
style, currency display — actually apply.

Gate: `pnpm validate:no-bare-intl` (in the PR CI `static-sync` lane).
Reference: `docs/reference/internationalization.md`.
Related: `fe-i18n-constants` (copy) · `fe-locale-preferences` (the store) ·
`fe-rtl-logical-css` (mirroring).

---

## Never call these in app code

`toLocaleString()` · `toLocaleDateString()` · `toLocaleTimeString()` ·
`new Intl.DateTimeFormat()` · `new Intl.NumberFormat()` ·
`new Intl.RelativeTimeFormat()`

They use the **device** locale and ignore every stored preference. Exempt:
`src/lib/i18n/**` (the kernel itself) and vendored `src/shared/components/ui/**`.

```tsx
const { formatDate, formatNumber, formatCurrency, formatRelativeTime } = useLocaleFormat();
formatNumber(Math.round(value));          // not value.toLocaleString()
formatCurrency(cents);                     // honours currencyDisplay + currencyCode
```

## The civil-day trap

`formatDate` accepts an optional third argument, `meta`. Passing
`{ civilDay: true }` pins the value to noon UTC of the local civil day so a
calendar date cannot shift across a timezone boundary.

**It is opt-in on purpose.** An earlier version inferred it from the input type
(`Date` vs ISO string), which meant any `Date` formatted with a time-bearing style
under an explicit timezone rendered a fabricated ~12:00.

| Value means | Pass |
| ----------- | ---- |
| a **calendar day** (event date, month label, day picker) | `{ civilDay: true }` **and** date-only options |
| an **instant** (created-at, timestamps) | nothing — let the timezone apply |

```ts
formatDate(event.date, { dateStyle: 'medium' }, { civilDay: true });   // calendar day
formatDate(row.createdAt);                                             // instant
```

Both known bugs in this family were the *same* omission at a second call site —
after fixing one, grep `formatDate(` and classify every caller.

## Calendars

Import **`@/shared/components/LocalizedCalendar`**, never
`@/shared/components/ui/calendar.tsx`. The wrapper injects `weekStartsOn` from
`firstDayOfWeek`, the two-letter weekday headers, and a caption, month / year
dropdowns, day numbers and day names that all pass `{ civilDay: true }` —
without it, a display timezone west of the device labels March as Feb. An
`eslint no-restricted-imports` rule enforces this from `src/shared/**` and
`src/pages/**`.

It is the app's **one month grid** (L-62): `look` picks the date field's popover
(`picker`, `CalendarPicker`), the booking step's (`compact`) or the Filters'
(`regular`); `tone`, a `dots` modifier (days with marks) and `testIds` (each day
button carries `data-day="YYYY-MM-DD"`) cover the rest. Hand it local-midnight
Dates from `localDateOf(civil)` and read picks back with `civilDateOf(date)`;
pass `weekStartsOn={0}` where the clinic's Sunday week rules (Q-A10). Never draw
a grid of day buttons by hand.

## Charts and vendored components

A `ui/` leaf cannot reach the prefs store, so formatting must be injected from the
call site. `ChartTooltipContent` takes an optional `valueFormatter`:

```tsx
<ChartTooltipContent valueFormatter={(v) => formatNumber(v)} />
```

The `.toLocaleString()` fallback inside the vendored file stays for callers that
omit it — that is why the gate exempts `components/ui/**`. Note any such vendored
edit in the PR body as "re-apply after a shadcn refresh".

## Verify

```bash
pnpm validate:no-bare-intl
grep -rn 'toLocale\|new Intl\.' src --include='*.tsx' | grep -v 'lib/i18n\|components/ui/'
```

The gate scans in pure Node (no ripgrep dependency), so it cannot silently pass on
a machine or runner without extra tooling.
