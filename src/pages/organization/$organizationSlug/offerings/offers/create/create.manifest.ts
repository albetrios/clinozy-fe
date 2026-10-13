import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New offer — a URL-driven dialog over the Offers tab
 * (`/organization/$organizationSlug/offerings/offers/create`, `S:102`; KICKOFF
 * §4, D24). The route renders nothing: the Offers page reads the URL and opens
 * the New offer drawer. Same gates as the room; in-room Create (with the
 * `prices` ability, Q-U8) is `useAppAccess`. The test id names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/offerings/offers/create',
  title: 'New offer',
  testId: 'offer-drawer',
  permission: 'organization:read',
  module: 'app-offerings',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
