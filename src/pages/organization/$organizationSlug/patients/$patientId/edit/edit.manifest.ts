import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit patient — a URL-driven dialog over the patient file
 * (`/organization/$organizationSlug/patients/$patientId/edit`, `S:34`; KICKOFF
 * §6.6, D24): the shared patient drawer over the section it opened from
 * (`?from=`, AMBER A-F1; Clinical notes by default). Gated by the file layout;
 * in-room Edit is `useAppAccess` — without it the drawer is read-only. The
 * test id names that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/patients/$patientId/edit',
  title: 'Edit patient',
  testId: 'patient-drawer',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
