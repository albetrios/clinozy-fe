import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New patient — a URL-driven dialog over the Patients list
 * (`/organization/$organizationSlug/patients/create`, `S:31`; KICKOFF §4, D24).
 * The route renders nothing: the list page reads the URL and opens the New
 * patient drawer, prefilled from `?name=&phone=&fromLead=`. Same gates as the
 * room; in-room Create is `useAppAccess`. The test id names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/patients/create',
  title: 'New patient',
  testId: 'patient-drawer',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
