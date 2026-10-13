import { use } from 'react';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';

import {
  SETTINGS_SCOPE_TONES,
  SettingsSectionContext,
} from './settings-section-context.ts';
import {
  SETTINGS_NAV,
  type SettingsNavItem,
  type SettingsSectionRef,
} from './settings-sections.ts';

/** The nav entry of a settings section — its icon — or undefined for none. */
function navItemOf(ref: SettingsSectionRef | null): SettingsNavItem | undefined {
  if (!ref) return undefined;
  return SETTINGS_NAV.flatMap((group) => group.items).find(
    (item) => item.scope === ref.scope && item.section === ref.section,
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Optional inline-end meta (e.g., "Profile 80% complete"), as a pill. */
  meta?: string;
}

/**
 * The head row of every settings section, as a Users role page's
 * (`users.md:61`; H:1123–1125): a 40px tile in the scope's tone with the
 * section's icon, the title (the drawer title's 18px/600, −0.01em) and its sub
 * line (13px, muted), and any meta as a 24px pill. It stays put while the
 * panel scrolls beneath it — the pane's hairline-edged header, as a drawer's
 * (`_patterns.md:32`).
 */
export function SectionHeader({ title, description, meta }: SectionHeaderProps) {
  const section = use(SettingsSectionContext);
  const item = navItemOf(section);
  const tone = section ? TONE_CLASSES[SETTINGS_SCOPE_TONES[section.scope]] : null;
  return (
    <header
      // Bleeds over the pane's gutter so content scrolling under it is hidden.
      className="bg-background sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 pt-5 pb-4 sm:-mx-6 sm:flex-nowrap sm:px-6"
    >
      {item && tone ? (
        <span
          aria-hidden="true"
          data-testid="settings-section-tile"
          className={cn(
            'flex size-10 flex-none items-center justify-center rounded-xl',
            tone.surface,
          )}
        >
          <item.icon className="size-4.5" />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-lg leading-tight font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground text-body leading-[1.4] text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {meta ? (
        // On a phone it takes a line of its own, under the title.
        <div className={cn('flex shrink-0 max-sm:basis-full', item && 'max-sm:ps-13')}>
          <TonePill tone="neutral" className="tabular-nums">
            {meta}
          </TonePill>
        </div>
      ) : null}
    </header>
  );
}
