import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import {
  appearanceModeCardClassName,
  appearanceTileActiveClassName,
  appearanceTileIdleClassName,
} from '@/lib/appearance-surface.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import {
  APPEARANCE_KEYS,
  APPEARANCE_NS,
} from '@/shared/components/AppearanceDialog/appearance.constants.ts';
import { DateTimePrefsCard } from '@/shared/components/DateTimePrefsCard/index.ts';
import { LanguagePrefsCard } from '@/shared/components/LanguagePrefsCard/index.ts';
import { MoneyPrefsCard } from '@/shared/components/MoneyPrefsCard/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import { Check, Monitor, Moon, Sun } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

/** The three modes, named with the Account menu's own Light · Dark · System. */
const MODES = [
  { id: 'light', labelKey: LAYOUT_KEYS.app.theme.light, icon: Sun },
  { id: 'dark', labelKey: LAYOUT_KEYS.app.theme.dark, icon: Moon },
  { id: 'system', labelKey: LAYOUT_KEYS.app.theme.system, icon: Monitor },
] as const;

/** Light, dark, or follow the OS — the one look in its two modes. */
function ModeCard() {
  const { t: tCommon } = useTranslation(LOCALE_NS);
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);
  const { t: tLayout } = useTranslation(LAYOUT_NS);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <SettingsCard
      title={tAppearance(APPEARANCE_KEYS.modeTitle)}
      description={tAppearance(APPEARANCE_KEYS.modeDescription)}
    >
      <div
        className="grid gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label={tCommon(LOCALE_KEYS.mode)}
      >
        {MODES.map((mode) => {
          const active = theme === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              data-slot="button"
              aria-checked={active}
              onClick={() => setTheme(mode.id)}
              data-testid={`theme-${mode.id}`}
              className={cn(
                appearanceModeCardClassName,
                active ? appearanceTileActiveClassName : appearanceTileIdleClassName,
              )}
            >
              <div className="flex w-full items-center justify-between">
                <mode.icon className="text-muted-foreground size-4" aria-hidden />
                {active && <Check className="text-foreground size-4" aria-hidden />}
              </div>
              <p className="text-body font-semibold">{tLayout(mode.labelKey)}</p>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

/**
 * The Appearance drawer's body, trimmed to the design: the mode (Light · Dark ·
 * System) and the device's language, text direction, date-time and number
 * preferences. The look itself is the launch's one look — no presets, colours,
 * fonts or shapes to pick. When `platformConfig.themeLock` is set the deployment
 * pins the mode too: a note takes the Mode card's place.
 */
export function AppearancePanel() {
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);

  return (
    <div className="flex flex-col gap-3" data-testid="appearance-panel">
      {platformConfig.themeLock ? (
        <SettingsCard
          title={tAppearance(APPEARANCE_KEYS.themeTitle)}
          description={
            <span data-testid="theme-locked">
              {tAppearance(APPEARANCE_KEYS.themeLocked)}
            </span>
          }
        />
      ) : (
        <ModeCard />
      )}
      <LanguagePrefsCard />
      <DateTimePrefsCard />
      <MoneyPrefsCard />
    </div>
  );
}
