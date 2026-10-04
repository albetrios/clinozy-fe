# `pages/organization/$organizationSlug/patients/create` — New patient

Route: `/organization/$organizationSlug/patients/create` — a URL-driven dialog over the
Patients list (KICKOFF §4, D24; `S:31`). The route renders nothing: the Patients page reads
the URL and opens the New patient drawer over the list, so a refresh or a shared link
reopens it. `?name=&phone=&fromLead=` prefill the drawer (⌘K "New patient", the contact
card's "+ Patient") — parsed by `validatePatientCreateSearch` in the parent's
`../patients.search.ts` (an invalid mobile is dropped; a valid one arrives E.164;
`fromLead` must be a record id), and `name` / `phone` are scrubbed from telemetry
(`SENSITIVE_QUERY_PARAMS`). Gated like the room — membership (`organization:read`) and the
`clinic-patients` module, then `requireOrgStatus`; in-room Create is `useClinicAccess` —
without it the list sends the link back with the permission toast. The drawer is the shared
`PatientDrawer` (`@/shared/components/PatientDrawer/`), opened by the page through the
parent's `../hooks/usePatientsDialogRoute/`; saving or closing it returns to the list with
the list's own params, the prefill dropped.

## Files

| File                 | Responsibility                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewPatientPage`.                                            |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "New patient". |
| `NewPatientPage.tsx` | Renders nothing — the dialog route's own UI. The drawer mounts on the Patients page.                      |

## Test ids

`patient-drawer` — the drawer the Patients page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Patient drawer. The route renders no element of its
own (`tooling/validate/test-ids-allowlist.txt`).
