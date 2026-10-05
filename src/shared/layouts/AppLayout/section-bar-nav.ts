import { useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import type { Section, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import { clinicSectionForPath } from '@/shared/clinic/clinic-sections.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import type { AppNavEntry } from '@/shared/hooks/useAppNav/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';

/** A nav entry as the section bar draws it: its tone and its description key. */
export interface SectionBarEntry extends AppNavEntry {
  tone: Tone;
  /** The `clinic` key of the room's one-line description; null for a template page. */
  descriptionKey: string | null;
}

/** What the section bar's header tabs, All sections and phone chip draw. */
export interface SectionBarNav {
  /** Every entry the member can open, in nav order (All sections). */
  entries: SectionBarEntry[];
  /** The header tabs: the pinned rooms in pin order, or the template pages. */
  pinned: SectionBarEntry[];
  /** The room (or page) the URL is in. */
  current: SectionBarEntry | null;
  /** The current room is not pinned — the All sections button carries the tint. */
  currentUnpinned: boolean;
  /** Rooms can be pinned (false while the nav holds only template pages). */
  canPin: boolean;
  isPinned: (entry: SectionBarEntry) => boolean;
  togglePin: (entry: SectionBarEntry) => void;
}

function toSectionBarEntry(entry: AppNavEntry): SectionBarEntry {
  return entry.section === null
    ? { ...entry, tone: 'stone', descriptionKey: null }
    : {
        ...entry,
        tone: SECTION_TONES[entry.section],
        descriptionKey: CLINIC_KEYS.sections[entry.section].description,
      };
}

/** The resolved path of an entry's route for this organization. */
function entryPath(entry: AppNavEntry, organizationSlug: string): string {
  return entry.to.replace('$organizationSlug', organizationSlug);
}

/**
 * The section bar's navigation model (KICKOFF §3.2): the nav entries with
 * their tones, the pinned tabs from `usePreferences().pinnedSections` (pin
 * order; per user on the server, D32), the current room by URL, and an
 * optimistic pin toggle that appends new pins.
 */
export function useSectionBarNav(
  navItems: readonly AppNavEntry[],
  organizationSlug: string,
): SectionBarNav {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { preferences, update } = usePreferences();
  const pins = preferences.pinnedSections;

  const model = useMemo(() => {
    const entries = navItems.map(toSectionBarEntry);
    const rooms = entries.filter((entry) => entry.section !== null);
    const canPin = rooms.length > 0;
    const pinned = canPin
      ? pins.flatMap((section) => rooms.filter((entry) => entry.section === section))
      : entries;
    const currentSection = clinicSectionForPath(pathname);
    const current =
      entries.find((entry) =>
        entry.section === null
          ? pathname === entryPath(entry, organizationSlug) ||
            pathname.startsWith(`${entryPath(entry, organizationSlug)}/`)
          : entry.section === currentSection,
      ) ?? null;
    return {
      entries,
      pinned,
      current,
      currentUnpinned: current !== null && !pinned.includes(current),
      canPin,
    };
  }, [navItems, pins, pathname, organizationSlug]);

  const isPinned = useCallback(
    (entry: SectionBarEntry) => entry.section !== null && pins.includes(entry.section),
    [pins],
  );
  const togglePin = useCallback(
    (entry: SectionBarEntry) => {
      const section: Section | null = entry.section;
      if (section === null) return;
      update({
        pinnedSections: pins.includes(section)
          ? pins.filter((pin) => pin !== section)
          : [...pins, section],
      });
    },
    [pins, update],
  );

  return { ...model, isPinned, togglePin };
}
