# `pages/organization/$organizationSlug/patients/$patientId/overview` — Clinical notes

Route: `/organization/$organizationSlug/patients/$patientId/overview` — a section of the
patient file (KICKOFF §6.6, D26; H:780–826; `patient-file.md:48–57`). It renders in the file
layout's content column through the family's section frame
(`../shared/components/PatientSection/`) — its title, and no "New …" (the section has none).

The section (L-43) is a 12-column grid that measures its own width (`@container`, F8): the
four chip cards — Complaints blush, Diagnosis lav, Treatment suggestions sage, Future
suggestions sky — span it, then half from 620px, then a quarter from 980px; under them the
shared Offering suggestions card (`variant="file"`, prices hidden) and the Feedback card, both
collapsed at first and brought into view as they open (`@/lib/reveal-in-scroller.ts`).

- **Chip cards** write the patient's notes (`updatePatient`, `S:1640`) at once: an add or a
  remove shows before the write lands and comes back if it is refused. The contract keeps
  each note as one text, a chip per line (`../shared/patient-clinical.ts`), and has no
  "added since the last visit" marker — the chips added during this visit to the file stand
  in for it (the ring and the "1 new" pill; Appendix F).
- **Feedback** reads `listFeedback` (`S:1636`): the type chips, the carousel (three cards per
  view, two below 760px of card width), "Load more" by six, Edit (the card's drawer route,
  `?from=overview`), Remove with its reason and Undo, and "Log action ⌄" on a card that needs
  action (`S:1650`).
- **Log feedback ⌄** opens the stacked picker; its chips open the check-in and review drawer
  routes (`../check-ins/`, `../reviews/`), which show this section behind them.

Patients edit writes the notes and logs feedback; without it the cards read. Gated by the file
layout (membership, the `clinic-patients` module, the org status); in-room access is
`useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's one lazy
module (`../patient-id.sections.ts`).

## Files

| File                            | Responsibility                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `overview.route.tsx`            | Route marker — exports `Component` rendering `PatientOverviewPage`.                               |
| `overview.manifest.ts`          | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`.              |
| `overview.constants.ts`         | The cards' tones and copy keys (`CLINICAL_KEYS`, `FEEDBACK_KEYS`, `LOG_FEEDBACK_KEYS`), test ids. |
| `PatientOverviewPage.tsx`       | The section: the grid, the plan card, Feedback and the Log feedback picker.                       |
| `components/ClinicalChipCard/`  | One chip card: dot, title, "1 new", chips with ×, the dashed input.                               |
| `components/FeedbackCard/`      | The Feedback card: header, type chips, carousel, cards, Remove and Log action.                    |
| `components/LogFeedbackPicker/` | The stacked picker: Check-in, Treatment feedback, Review.                                         |

The chip cards read and write the notes through `../shared/hooks/useClinicalLists/` — the
family's, since the Overview's Clinical card and smart note write them too (L-46).

## Test ids

`patient-section-overview` — the section's root; `clinical-card-<field>` (`-chip`, `-new`,
`-input`), `feedback-card` (`-toggle`, `-log`, `-type-<type>`, `-item` and its `-edit`,
`-remove`, `-log-action`, `-action-<kind>`, `-action`; `-previous`, `-next`, `-load-more`,
`-empty`), `log-feedback-picker` (`-check-in-visit`, `-treatment-<id>`, `-review-<source>`)
(`docs/reference/e2e-testids-inventory.md` › Patient file feedback).
