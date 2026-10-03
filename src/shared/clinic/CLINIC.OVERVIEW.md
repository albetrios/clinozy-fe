# `src/shared/clinic/`

Cross-room clinic UI vocabulary for the launch's ten rooms (iteration
`launch-2026-09-30-jxmr`):

- `clinic.constants.ts` — the `clinic` i18n namespace's keys (section names and
  descriptions, roles; the offerings domain — category, offer-kind and
  offer-state labels and the toasts `useOfferings` / `useOffers` raise; more
  shared statuses arrive with the rooms that need them). The namespace loads
  with the org shell, so a shared hook's toast reads it in any room. Room-only
  copy stays in each room's own namespace (`today`, `leads`, … `users`).
- `clinic-tones.ts` — each section's and role's tone (the contract's `Tone`), and
  `TONE_CLASSES`: every tone's utilities as full literals (bg, ink, surface,
  fill, border, dot, halo, ring, tab hover, and a list row's active 55% and
  picked 70%) — never build `bg-tone-${tone}`; `toneForLabel`: the design's
  hash that gives an untoned label (a picker option, a tag) a stable tone.
- `clinic-section-icons.ts` — each section's icon.
- `clinic-phone.ts` — a stored E.164 mobile as the design shows it
  (`+91 98250 44120`) and the channel links (call, WhatsApp, Instagram) the
  person cards and the chat open.
- `clinic-sections.ts` — the sections in nav order, the section a URL is in
  (`/visits/…` belongs to Today), and where a room the access in force can't
  view sends the member (first viewable after Today; Q-U11).

Access itself — the fixture matrix, the resolver and the member's clinic roles —
is `src/shared/api/clinic/access-api.ts`, read through
`src/shared/hooks/useClinicAccess/` (narrowed by View-as, `useUIStore.previewRole`).
Data contracts and fixtures live in `src/shared/api/clinic/`.
