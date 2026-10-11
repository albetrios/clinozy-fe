import { useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import type { Tone } from '@/shared/api/app/app-schema.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import { appSectionForPath } from '@/shared/app/app-sections.ts';
import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import type { AppNavEntry } from '@/shared/hooks/useAppNav/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';

/** A nav entry as the section bar draws it: its tone and its description key. */
export interface SectionBarEntry extends AppNavEntry {
  tone: Tone;
  /** The `app` key of the room's one-line description. */
  descriptionKey: string;
}

/** What the section bar's header tabs, All sections and phone chip draw. */
export interface SectionBarNav {
  /** Every room the member can open, in nav order (All sections). */
  entries: SectionBarEntry[];
  /** The header tabs: the pinned rooms in pin order. */
  pinned: SectionBarEntry[];
  /** The room the URL is in. */
  current: SectionBarEntry | null;
  /** The current room is not pinned — the All sections button carries the tint. */
  currentUnpinned: boolean;
  isPinned: (entry: SectionBarEntry) => boolean;
  togglePin: (entry: SectionBarEntry) => void;
}

function toSectionBarEntry(entry: AppNavEntry): SectionBarEntry {
  return {
    ...entry,
    tone: SECTION_TONES[entry.section],
    descriptionKey: APP_KEYS.sections[entry.section].description,
  };
}

/**
 * The section bar's navigation model (KICKOFF §3.2): the nav entries with
 * their tones, the pinned tabs from `usePreferences().pinnedSections` (pin
 * order; per user on the server, D32), the current room by URL, and an
 * optimistic pin toggle that appends new pins.
 */
export function useSectionBarNav(navItems: readonly AppNavEntry[]): SectionBarNav {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { preferences, update } = usePreferences();
  const pins = preferences.pinnedSections;

  const model = useMemo(() => {
    const entries = navItems.map(toSectionBarEntry);
    const pinned = pins.flatMap((section) =>
      entries.filter((entry) => entry.section === section),
    );
    const currentSection = appSectionForPath(pathname);
    const current = entries.find((entry) => entry.section === currentSection) ?? null;
    return {
      entries,
      pinned,
      current,
      currentUnpinned: current !== null && !pinned.includes(current),
    };
  }, [navItems, pins, pathname]);

  const isPinned = useCallback(
    (entry: SectionBarEntry) => pins.includes(entry.section),
    [pins],
  );
  const togglePin = useCallback(
    (entry: SectionBarEntry) => {
      const { section } = entry;
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
