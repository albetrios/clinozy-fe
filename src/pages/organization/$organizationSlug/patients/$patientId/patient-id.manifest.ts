import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file layout manifest
 * (`/organization/$organizationSlug/patients/$patientId`; KICKOFF §6.6, §4,
 * D19, D26): the file bar, the main card (rail + the open section) and the
 * Activity column over eleven section folders with the schema's slugs, plus
 * Edit patient (`edit`, `S:34`). Its index — and any unknown section — goes
 * to `timeline`, the Overview (D19; the schema says `overview`, `S:32`).
 * Gated like the Patients room (membership, the `clinic-patients` module, the
 * org status); its children inherit the gate, and in-room access — the billing
 * sections' `billing.view`, the role-named Rx, treatment and Private album
 * gates — is `useClinicAccess` (D9, Q-F1). Not in the nav: the room is
 * Patients.
 */
export const manifest = {
  segment: '$patientId',
  path: '/organization/$organizationSlug/patients/$patientId',
  title: 'Patient file',
  testId: 'patient-file-layout',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'layout',
  children: [
    'timeline',
    'overview',
    'visits',
    'prescriptions',
    'treatments',
    'images',
    'reports',
    'invoices',
    'payments',
    'packages',
    'notes',
    'edit',
  ],
} as const satisfies PageManifest;
