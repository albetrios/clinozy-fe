# `src/shared/app/pin-directory/`

India Post's PIN directory, bundled with the app: a six-digit PIN → its district, its state and
the areas its post offices serve. The clinic setup's "Where is your clinic?" step fills area,
city and state from it the moment the sixth digit is typed (iteration
`feat-clinic-setup-2026-10-13-sltd`, decision D27, KICKOFF §6.4) — no outside service, no cost,
offline once loaded. An unknown PIN fills nothing and blocks nothing; every filled field stays
editable. Since `feat-write-less-2026-10-14-oixr` (D13) Users › Branches fills a branch's place the
same way: both screens look the PIN up through `usePinPlace` (`src/shared/hooks/usePinPlace/` — a
slower answer for an earlier PIN never overwrites a later one) and draw the unknown-PIN line and the
area chips with `PinAreaChips` (`src/shared/components/PinAreaChips/`, copy in `app` › `pinPlace`).

## Files

| File                          | What it does                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                    | The unit's surface: `lookupPin`, `PinPlace`                                                                                                             |
| `pin-directory.ts` (+ .test)  | `lookupPin(pin)` and `createPinLookup(loaders)` (the factory, exported for tests): validates the PIN, loads its part once, answers `PinPlace` or `null` |
| `data/pin-<prefix>.json` (71) | The directory, one part per PIN prefix (its first two digits), `{ "<pin>": [district, state, [area…]] }` — GENERATED, never edited by hand              |

```ts
import { lookupPin, type PinPlace } from '@/shared/app/pin-directory/index.ts';

const place = await lookupPin('395009');
// { pin: '395009', district: 'Surat', state: 'Gujarat',
//   areas: ['Adajan', 'Anand Mahal Road', 'Navyug College', 'Palanpur', 'Ramnagar'] }
```

## Loading — never on first paint

`import.meta.glob('./data/pin-*.json', { import: 'default' })` (not `eager`) gives every part its
own lazy chunk (`assets/pin-<prefix>-<hash>.js`) and an `import()` that runs only when
`lookupPin` asks for it — nothing loads until a full PIN is looked up, and then only that PIN's
part. The 71 parts are ~2.6 MB minified in all (~846 kB gzipped); the largest, `pin-50`
(Telangana and Andhra Pradesh), is ~99 kB (~30.5 kB gzipped).

- A malformed PIN (not six digits, or starting with 0) or a prefix with no part answers `null`
  without loading anything.
- A loaded part stays in memory; concurrent lookups share one load (`onceAsync`,
  `src/lib/lazy-module.ts`).
- A failed load answers `null` and is not kept — the next lookup tries again (a flaky network
  must not poison the field until a reload). `lookupPin` never rejects.
- Offline: the parts are ordinary JS chunks, so the service worker serves them like any other.

## Data — source and licence

- **Dataset:** "All India Pincode Directory till last month" — Department of Posts (India Post),
  Ministry of Communications, published on the Open Government Data Platform India:
  <https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month>
- **Licence:** Government Open Data License – India (GODL-India), use with attribution:
  <https://www.data.gov.in/government-open-data-license-india>
- **Copy used:** data.gov.in refused the connection from the build environment, so the same file
  came from a public mirror that republishes it, pinned to its commit —
  <https://raw.githubusercontent.com/dropdevrahul/pincodes-india/d26206918dd2fb9f155bfba18de0421bd5fa0ca8/pincode.csv>
  (commit d262069, "adds pincode.csv from official source of data.gov.in", 2024-05-05),
  downloaded 2026-10-13: 23,760,720 bytes, sha256
  `84af12fa29adddedfa9addcf46546000d89d2e2899b2993dc88050fafc8861e2`, 157,126 offices, 19,300
  PINs.

## Regenerating

The raw CSV never enters the repository. Download it to a scratch directory, then:

```sh
node tooling/data/build-pin-directory.mjs <path/to/pincode.csv>
```

`tooling/data/build-pin-directory.mjs` (its header holds the same source record) rewrites every
`data/pin-*.json`: per PIN, the district and state most of its offices carry (title case); the
areas are its offices' names with India Post's office-type suffix and anything after it dropped
("Adajan BO" → "Adajan", "Amba B.O (Alauli S.O)" → "Amba"), capitals names title-cased,
de-duplicated and sorted; nodal delivery centres, extension counters and the test office are left
out. Output is deterministic — sorted, then Prettier-formatted — so a rebuild from the same CSV
changes no byte. Update the source record above and in the generator's header with the new copy.

## Budget

`.size-limit.json` holds two budgets, gzipped, measured on the built chunks (2026-10-13):
"PIN directory: largest part" — `pin-50`, 30.45 kB of a 31 kB limit — and "PIN directory: all
parts" — 845.94 kB of 850 kB. A regenerated directory whose largest part moves to another prefix
moves the first entry's path with it.
