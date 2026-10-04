import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New offering — a URL-driven dialog over the Offerings tab
 * (`/organization/$organizationSlug/offerings/create`, `S:99`; KICKOFF §4,
 * D24). The route renders nothing: the Offerings page reads the URL and opens
 * the New offering drawer, prefilled from `?name=`. Same gates as the room;
 * in-room Create is `useClinicAccess`. The test id names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/offerings/create',
  title: 'New offering',
  testId: 'offering-drawer',
  permission: 'organization:read',
  module: 'clinic-offerings',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
