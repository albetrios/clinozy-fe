import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New lead — a URL-driven dialog over the Leads list
 * (`/organization/$organizationSlug/leads/create`, `S:23`; KICKOFF §4, D24).
 * The route renders nothing: the list page reads the URL and opens the New
 * lead drawer, prefilled from `?name=&phone=`. Same gates as the room; in-room
 * Create is `useAppAccess`. The test id names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/leads/create',
  title: 'New lead',
  testId: 'new-lead-drawer',
  permission: 'organization:read',
  module: 'app-leads',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
