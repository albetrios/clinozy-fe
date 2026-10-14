import { use } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { computeProfileCompleteness } from '@/shared/forms/ProfileForm/contracts.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import {
  SETTINGS_KEYS,
  SETTINGS_NS,
  SETTINGS_SECTION_HEADING_KEYS,
} from './settings.constants.ts';
import { INTEGRATIONS_WEBHOOKS_CHECK } from './settings-permissions.ts';
import {
  SETTINGS_SCOPE_TONES,
  SettingsSectionContext,
} from './settings-section-context.ts';
import {
  SETTINGS_NAV,
  type SettingsNavItem,
  type SettingsSection,
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
 * (`_patterns.md:32`). Settings draws it through {@link SettingsSectionHeader},
 * which supplies each section's own copy.
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

/**
 * A section's head-row copy — its title, its sub line, and the meta it opens with —
 * from {@link SETTINGS_SECTION_HEADING_KEYS}. Integrations names webhooks only when the
 * caller sees them; Profile opens on the completeness of the signed-in profile.
 */
function useSettingsSectionHeading(section: SettingsSection) {
  const { t } = useTranslation(SETTINGS_NS);
  const canReadWebhooks = useCan(INTEGRATIONS_WEBHOOKS_CHECK);
  const user = useAuthStore((s) => s.user);
  const keys = SETTINGS_SECTION_HEADING_KEYS[section];
  const description =
    section === 'integrations' && !canReadWebhooks
      ? SETTINGS_KEYS.panels.integrations.descriptionApiKeysOnly
      : keys.description;
  return {
    title: t(keys.title),
    description: t(description),
    meta:
      section === 'profile'
        ? t(SETTINGS_KEYS.panels.profile.completeness, {
            percent: computeProfileCompleteness(user ?? {}),
          })
        : undefined,
  };
}

interface SettingsSectionHeaderProps {
  section: SettingsSection;
  /**
   * The meta pill, when the section's value moves on from the one it opened with —
   * Profile's completeness while its form is being edited.
   */
  meta?: string;
}

/**
 * The head row of a settings section with that section's own copy. Every panel draws
 * it, and so does the drawer's stand-in while the panel's code loads.
 *
 * @remarks
 * The stand-in used to draw {@link SectionHeader} with only the section's nav label;
 * the panel then drew its heading and sub line, so the header grew by a line (and on
 * General changed its title) a beat after the drawer opened. With one source for both,
 * the header the user sees first is the one that stays and only the body below it
 * swaps. Panels never pass their own title or sub line.
 */
export function SettingsSectionHeader({ section, meta }: SettingsSectionHeaderProps) {
  const heading = useSettingsSectionHeading(section);
  return (
    <SectionHeader
      title={heading.title}
      description={heading.description}
      meta={meta ?? heading.meta}
    />
  );
}
