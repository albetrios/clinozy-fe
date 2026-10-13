import type { Section } from '@/shared/api/app/app-schema.ts';

/**
 * The clinic sections in nav order (KICKOFF §3.2): the shell, All sections,
 * the View-as pill and ⌘K list them this way.
 */
export const APP_SECTION_ORDER: readonly Section[] = [
  'today',
  'leads',
  'appointments',
  'patients',
  'medical',
  'stock',
  'payments',
  'tasks',
  'offerings',
  'users',
];

/** Whether a string (a manifest's `nav.section`, say) names a clinic section. */
export function isAppSection(value: string): value is Section {
  return (APP_SECTION_ORDER as readonly string[]).includes(value);
}

// A Map, not an object literal: `constructor` and friends must not resolve.
const SECTION_BY_SEGMENT: ReadonlyMap<string, Section> = new Map(
  APP_SECTION_ORDER.map((section) => [section, section] as const),
);

const ROOM_SEGMENT = /^\/organization\/[^/]+\/([^/?#]+)/;

/** The clinic section a URL is in — its first segment under the org — or null outside the rooms. */
export function appSectionForPath(pathname: string): Section | null {
  const segment = ROOM_SEGMENT.exec(pathname)?.[1];
  return segment ? (SECTION_BY_SEGMENT.get(segment) ?? null) : null;
}

/**
 * Where a room the access in force can't view sends the member (KICKOFF §6.12,
 * Q-U11): null when the room is viewable or isn't a clinic room; otherwise the
 * first viewable section in nav order after Today — Users → Leads for a
 * Doctor — and Today when nothing else is.
 */
export function appSectionLanding(
  current: Section | null,
  viewable: readonly Section[],
): Section | null {
  if (current === null || viewable.includes(current)) return null;
  return (
    APP_SECTION_ORDER.find(
      (section) => section !== 'today' && viewable.includes(section),
    ) ?? 'today'
  );
}
