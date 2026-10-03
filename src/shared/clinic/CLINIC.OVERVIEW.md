# `src/shared/clinic/`

Cross-room clinic UI vocabulary for the launch's ten rooms (iteration
`launch-2026-09-30-jxmr`):

- `clinic.constants.ts` — the `clinic` i18n namespace's keys (section names and
  descriptions, roles; more shared statuses arrive with the rooms that need
  them). Room-only copy stays in each room's own namespace (`today`, `leads`, …
  `users`).
- `clinic-tones.ts` — each section's and role's tone (the contract's `Tone`), and
  `TONE_CLASSES`: every tone's utilities as full literals (bg, ink, surface,
  fill, border, dot, halo, ring, tab hover) — never build `bg-tone-${tone}`.
- `clinic-section-icons.ts` — each section's icon.
- `clinic-sections.ts` — the sections in nav order, the section a URL is in
  (`/visits/…` belongs to Today), and where a room the access in force can't
  view sends the member (first viewable after Today; Q-U11).

Access itself — the fixture matrix, the resolver and the member's clinic roles —
is `src/shared/api/clinic/access-api.ts`, read through
`src/shared/hooks/useClinicAccess/` (narrowed by View-as, `useUIStore.previewRole`).
Data contracts and fixtures live in `src/shared/api/clinic/`.
