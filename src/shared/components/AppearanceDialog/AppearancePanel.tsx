import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import {
  appearanceChoiceActiveClassName,
  appearanceChoiceClassName,
  appearanceChoiceIdleClassName,
  appearanceModeCardClassName,
  appearancePreviewWellClassName,
  appearanceTileActiveClassName,
  appearanceTileIdleClassName,
} from '@/lib/appearance-surface.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { closeControlClassName } from '@/lib/icon-surface.ts';
import { cn } from '@/lib/utils.ts';
import {
  APPEARANCE_KEYS,
  APPEARANCE_NS,
} from '@/shared/components/AppearanceDialog/appearance.constants.ts';
import { DateTimePrefsCard } from '@/shared/components/DateTimePrefsCard/index.ts';
import { DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { LanguagePrefsCard } from '@/shared/components/LanguagePrefsCard/index.ts';
import { MoneyPrefsCard } from '@/shared/components/MoneyPrefsCard/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Separator } from '@/shared/components/ui/separator.tsx';
import { Check, Monitor, Moon, Sparkles, Sun } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import {
  ACCENT_COLORS,
  ACCENT_INTENSITIES,
  BASE_COLORS,
  CONTRAST_MODES,
  DENSITY_SCALES,
  ELEVATION_LEVELS,
  FOCUS_RINGS,
  GENERATED_FONTS,
  GENERATED_PRESET,
  GENERATED_RADII,
  HARMONY_RULES,
  hexToHue,
  ICON_COLORS,
  ICON_LIBRARIES,
  ICON_WEIGHTS,
  LAYOUT_WIDTHS,
  MENU_STYLES,
  MOTION_PRESETS,
  normalizeLook,
  oklchToHex,
  rollColour,
  rollSurface,
  rollTypography,
  SEPARATION_STRATEGIES,
  SHAPE_LANGUAGES,
  THEME_PRESETS,
  TYPE_SCALES,
} from '@/shared/theme/index.ts';

import { lookFields } from './appearance-look.ts';

const THEMES = [
  { id: 'light' as const, label: 'Light', description: 'Bright theme.', icon: Sun },
  { id: 'dark' as const, label: 'Dark', description: 'Dimmed for night.', icon: Moon },
  {
    id: 'system' as const,
    label: 'System',
    description: 'Follow your OS.',
    icon: Monitor,
  },
];

const RADIUS_OPTIONS = Object.entries(GENERATED_RADII).map(([id, r]) => ({
  id,
  label: r.label,
}));

/** Record<{label}> → the {id,label}[] shape the Choices picker expects. */
const toOptions = (rec: Record<string, { label: string }>) =>
  Object.entries(rec).map(([id, v]) => ({ id, label: v.label }));
const DENSITY_OPTIONS = toOptions(DENSITY_SCALES);
const MOTION_OPTIONS = toOptions(MOTION_PRESETS);
const HARMONY_OPTIONS = toOptions(HARMONY_RULES);
const INTENSITY_OPTIONS = toOptions(ACCENT_INTENSITIES);
const TYPE_SCALE_OPTIONS = toOptions(TYPE_SCALES);

/**
 * Colour field: a native colour "snippet" for any hue, plus the preset swatches as
 * quick suggestions. The look stores an OKLCH hue, so a custom pick is mapped via
 * hexToHue and the snippet reflects the applied accent (oklchToHex).
 */
function ColourField({
  ariaLabel,
  selectedId,
  currentHex,
  onPickHue,
  testPrefix,
}: {
  ariaLabel: string;
  selectedId: string | null;
  currentHex: string;
  onPickHue: (hue: number) => void;
  testPrefix: string;
}) {
  const { t: tColour } = useTranslation(APPEARANCE_NS);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="color"
        value={currentHex}
        onChange={(e) => onPickHue(hexToHue(e.target.value))}
        aria-label={`${ariaLabel} — custom`}
        title={tColour(APPEARANCE_KEYS.pickAnyColour)}
        data-testid={`${testPrefix}-custom`}
        data-slot="pill"
        className="border-border size-7 cursor-pointer rounded-full border bg-transparent p-0 outline-none"
      />
      <span className="bg-border mx-1 h-6 w-px" aria-hidden="true" />
      <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
        {ACCENT_COLORS.map((c) => {
          const active = selectedId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              data-slot="button"
              aria-checked={active}
              aria-label={c.label}
              title={c.label}
              onClick={() => onPickHue(c.hue)}
              data-testid={`${testPrefix}-${c.id}`}
              className={cn(
                'size-7 rounded-full transition outline-none focus-visible:outline-hidden',
                `theme-dot-${c.id}`,
                active
                  ? 'ring-foreground ring-offset-background ring-2 ring-offset-2'
                  : 'hover:scale-110',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Generic pill radiogroup for base colour / radius / menu style. */
function Choices({
  ariaLabel,
  value,
  options,
  onPick,
  testPrefix,
}: {
  ariaLabel: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onPick: (id: string) => void;
  testPrefix: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            data-slot="pill"
            aria-checked={active}
            onClick={() => onPick(o.id)}
            data-testid={`${testPrefix}-${o.id}`}
            className={cn(
              appearanceChoiceClassName,
              'rounded-full',
              active ? appearanceChoiceActiveClassName : appearanceChoiceIdleClassName,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A drawer field's label: 12px/500 in the strong muted ink (`_patterns.md:34`). */
function FieldLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground-strong text-xs leading-[normal] font-medium">
      {children}
    </p>
  );
}

/** The web-safe font catalog as picker rows (font families are proper nouns). */
const FONT_OPTIONS = Object.entries(GENERATED_FONTS).map(([key, font]) => ({
  key,
  label: font.label,
}));

/** Font picker (body / heading) over the web-safe catalog; `id` is its test id. */
function FontPicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Picker
        label={label}
        value={value}
        options={FONT_OPTIONS}
        plain
        onChange={(key) => {
          if (key) onChange(key);
        }}
        testId={id}
        className="w-full"
      />
    </div>
  );
}

/**
 * A small per-section shuffle button (re-rolls just one card's axes). The global
 * Shuffle in the dialog header rolls everything, incl. the orthogonal base/menu/icons.
 */
function SectionShuffle({
  onClick,
  label,
  testId,
}: {
  onClick: () => void;
  label: string;
  testId: string;
}) {
  const { t: tShuffle } = useTranslation(APPEARANCE_NS);
  return (
    <button
      type="button"
      data-slot="button"
      onClick={onClick}
      aria-label={tShuffle(APPEARANCE_KEYS.shuffleSection, { section: label })}
      title={tShuffle(APPEARANCE_KEYS.shuffleSection, { section: label })}
      data-testid={testId}
      className={cn(closeControlClassName, 'rounded-lg')}
    >
      <Sparkles className="size-4" aria-hidden="true" />
    </button>
  );
}

/**
 * The current look for the per-axis pickers: the ids `lookFields` derives, and
 * the fully-defaulted look — the current value for every other axis.
 */
function useCurrentLook() {
  const customTheme = useThemeStore((s) => s.customTheme);
  return { ...lookFields(customTheme), look: normalizeLook(customTheme) };
}

/** The named presets, and the shareable theme code: copy a link to it, or apply a pasted one. */
function ThemeCard() {
  const { t: tCommon } = useTranslation(LOCALE_NS);
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);
  const preset = useThemeStore((s) => s.preset);
  const setPreset = useThemeStore((s) => s.setPreset);
  const seed = useThemeStore((s) => s.seed);
  const applyThemeSeed = useThemeStore((s) => s.applyThemeSeed);
  const [seedInput, setSeedInput] = useState('');

  // Copy a shareable link that reproduces the current look (?theme=<seed>).
  const handleCopyLink = () => {
    if (seed == null) return;
    const url = `${window.location.origin}?theme=${seed}`;
    navigator.clipboard?.writeText(url).catch(() => undefined);
    notify.success(
      i18n.t(ERRORS_KEYS.frontend.account.themeLinkCopied, { ns: ERRORS_NS }),
      { description: url },
    );
  };

  // Apply a pasted theme code (seed) — reproduces that exact look.
  const handleApplySeed = () => {
    const trimmed = seedInput.trim();
    const value = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(value)) {
      notify.error(
        i18n.t(ERRORS_KEYS.frontend.account.themeCodeNumeric, { ns: ERRORS_NS }),
      );
      return;
    }
    applyThemeSeed(value >>> 0);
    setSeedInput('');
  };

  return (
    <SettingsCard
      title={tAppearance(APPEARANCE_KEYS.themeTitle)}
      description={tAppearance(APPEARANCE_KEYS.themeDescription)}
    >
      <div className="flex flex-col gap-3">
        <Choices
          ariaLabel={tAppearance(APPEARANCE_KEYS.presetAria)}
          value={preset === GENERATED_PRESET ? '__none__' : preset}
          options={THEME_PRESETS}
          onPick={setPreset}
          testPrefix="named-preset"
        />
        <Separator />
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={seed == null}
              data-testid="theme-copy-link"
            >
              {tAppearance(APPEARANCE_KEYS.copyLink)}
            </Button>
            {seed == null ? (
              <span className="text-muted-foreground text-xs">
                {tAppearance(APPEARANCE_KEYS.shuffleHint)}
              </span>
            ) : (
              <span
                className="text-muted-foreground text-xs tabular-nums"
                data-testid="theme-seed"
              >
                {tAppearance(APPEARANCE_KEYS.codeLabel, { seed })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DrawerInput
              inputMode="numeric"
              capitalize={false}
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder={tAppearance(APPEARANCE_KEYS.codePlaceholder)}
              aria-label={tCommon(LOCALE_KEYS.themeCode)}
              data-testid="theme-seed-input"
              className="w-44"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplySeed}
              data-testid="theme-seed-apply"
            >
              {tAppearance(APPEARANCE_KEYS.apply)}
            </Button>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}

/** Light, dark, or follow the OS. */
function ModeCard() {
  const { t: tCommon } = useTranslation(LOCALE_NS);
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <SettingsCard
      title={tAppearance(APPEARANCE_KEYS.modeTitle)}
      description={tAppearance(APPEARANCE_KEYS.modeDescription)}
    >
      <div>
        <div
          className="grid gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-label={tCommon(LOCALE_KEYS.mode)}
        >
          {THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                data-slot="button"
                aria-checked={active}
                onClick={() => setTheme(t.id)}
                data-testid={`theme-${t.id}`}
                className={cn(
                  appearanceModeCardClassName,
                  active ? appearanceTileActiveClassName : appearanceTileIdleClassName,
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <t.icon className="text-muted-foreground size-4" aria-hidden />
                  {active && <Check className="text-foreground size-4" aria-hidden />}
                </div>
                <div>
                  <p className="text-body font-semibold">{t.label}</p>
                  <p className="text-muted-foreground text-caption">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </SettingsCard>
  );
}

/** The accent and chart colours, the base colour, the harmony rule and the accent intensity. */
function ColourCard() {
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);
  const baseId = useThemeStore((s) => s.baseId);
  const updateLook = useThemeStore((s) => s.updateLook);
  const setBaseColor = useThemeStore((s) => s.setBaseColor);
  const { accentId, chartId, look } = useCurrentLook();
  const accentChroma = ACCENT_INTENSITIES[look.intensityId]?.chroma ?? 0.16;
  const accentHex = oklchToHex(0.58, accentChroma, look.hue);
  const chartHex = oklchToHex(0.64, 0.17, look.chartHue);
  const shuffleColour = () => updateLook(rollColour());
  return (
    <SettingsCard
      title={tAppearance(APPEARANCE_KEYS.colourTitle)}
      description={tAppearance(APPEARANCE_KEYS.colourDescription)}
      action={
        <SectionShuffle
          onClick={shuffleColour}
          label={tAppearance(APPEARANCE_KEYS.sectionColour)}
          testId="shuffle-colour"
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.accentColour)}</FieldLabel>
          <ColourField
            ariaLabel={tAppearance(APPEARANCE_KEYS.accentColour)}
            selectedId={accentId}
            currentHex={accentHex}
            onPickHue={(hue) => updateLook({ hue })}
            testPrefix="accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.chartColour)}</FieldLabel>
          <ColourField
            ariaLabel={tAppearance(APPEARANCE_KEYS.chartColour)}
            selectedId={chartId}
            currentHex={chartHex}
            onPickHue={(hue) => updateLook({ chartHue: hue })}
            testPrefix="chart"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.baseColour)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.baseColour)}
            value={baseId}
            options={BASE_COLORS}
            onPick={setBaseColor}
            testPrefix="base"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.harmony)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.harmonyAria)}
            value={look.harmonyId}
            options={HARMONY_OPTIONS}
            onPick={(value) => updateLook({ harmonyId: value })}
            testPrefix="harmony"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.accentIntensity)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.accentIntensity)}
            value={look.intensityId}
            options={INTENSITY_OPTIONS}
            onPick={(value) => updateLook({ intensityId: value })}
            testPrefix="intensity"
          />
        </div>
      </div>
    </SettingsCard>
  );
}

/** The body and heading fonts, radius, shape language, type scale and menu style. */
function TypographyCard() {
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);
  const menu = useThemeStore((s) => s.menu);
  const updateLook = useThemeStore((s) => s.updateLook);
  const setMenu = useThemeStore((s) => s.setMenu);
  const { bodyFontId, headingFontId, radiusId, look } = useCurrentLook();
  const shuffleTypography = () => updateLook(rollTypography());
  return (
    <SettingsCard
      title={tAppearance(APPEARANCE_KEYS.typeTitle)}
      description={tAppearance(APPEARANCE_KEYS.typeDescription)}
      action={
        <SectionShuffle
          onClick={shuffleTypography}
          label={tAppearance(APPEARANCE_KEYS.sectionType)}
          testId="shuffle-type"
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-(--form-gap) sm:grid-cols-2">
          <FontPicker
            id="font-body"
            label={tAppearance(APPEARANCE_KEYS.bodyFont)}
            value={bodyFontId}
            onChange={(value) => updateLook({ bodyFontId: value })}
          />
          <FontPicker
            id="font-heading"
            label={tAppearance(APPEARANCE_KEYS.headingFont)}
            value={headingFontId}
            onChange={(value) => updateLook({ headingFontId: value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.radius)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.radius)}
            value={radiusId}
            options={RADIUS_OPTIONS}
            onPick={(value) => updateLook({ radiusId: value })}
            testPrefix="radius"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.shapeLanguage)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.shapeLanguage)}
            value={look.shapeId}
            options={SHAPE_LANGUAGES}
            onPick={(value) => updateLook({ shapeId: value })}
            testPrefix="shape"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.typeScale)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.typeScale)}
            value={look.typeScaleId}
            options={TYPE_SCALE_OPTIONS}
            onPick={(value) => updateLook({ typeScaleId: value })}
            testPrefix="typescale"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.menu)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.menuAria)}
            value={menu}
            options={MENU_STYLES}
            onPick={setMenu}
            testPrefix="menu"
          />
        </div>
      </div>
    </SettingsCard>
  );
}

/** Icon weight, colour and library, over a live preview. */
function IconsCard() {
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);
  const iconWeight = useThemeStore((s) => s.iconWeight);
  const iconColor = useThemeStore((s) => s.iconColor);
  const iconLibrary = useThemeStore((s) => s.iconLibrary);
  const setIconWeight = useThemeStore((s) => s.setIconWeight);
  const setIconColor = useThemeStore((s) => s.setIconColor);
  const setIconLibrary = useThemeStore((s) => s.setIconLibrary);
  return (
    <SettingsCard
      title={tAppearance(APPEARANCE_KEYS.iconsTitle)}
      description={tAppearance(APPEARANCE_KEYS.iconsDescription)}
    >
      <div className="flex flex-col gap-4">
        <div className={appearancePreviewWellClassName} aria-hidden>
          <Sparkles className="size-6" data-testid="icon-preview-star" />
          <Sun className="size-6" data-testid="icon-preview-sun" />
          <Moon className="size-6" data-testid="icon-preview-moon" />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.iconWeight)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.iconWeight)}
            value={iconWeight}
            options={ICON_WEIGHTS}
            onPick={setIconWeight}
            testPrefix="icon"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.iconColour)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.iconColour)}
            value={iconColor}
            options={ICON_COLORS}
            onPick={setIconColor}
            testPrefix="iconcolor"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.iconLibrary)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.iconLibrary)}
            value={iconLibrary}
            options={ICON_LIBRARIES}
            onPick={setIconLibrary}
            testPrefix="iconlib"
          />
        </div>
      </div>
    </SettingsCard>
  );
}

/** The content width — shown only when the deployment does not force one. */
function LayoutWidthCard() {
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);
  const layoutWidth = useThemeStore((s) => s.layoutWidth);
  const setLayoutWidth = useThemeStore((s) => s.setLayoutWidth);
  return (
    <SettingsCard
      data-testid="layout-width-card"
      title={tAppearance(APPEARANCE_KEYS.layoutTitle)}
      description={tAppearance(APPEARANCE_KEYS.layoutDescription)}
    >
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{tAppearance(APPEARANCE_KEYS.contentWidth)}</FieldLabel>
        <Choices
          ariaLabel={tAppearance(APPEARANCE_KEYS.contentWidth)}
          value={layoutWidth}
          options={LAYOUT_WIDTHS.map(({ id, label }) => ({ id, label }))}
          onPick={(value) => setLayoutWidth(value as typeof layoutWidth)}
          testPrefix="layout-width"
        />
        <p className="text-muted-foreground text-xs leading-[1.45]">
          {LAYOUT_WIDTHS.find((option) => option.id === layoutWidth)?.description}
        </p>
      </div>
    </SettingsCard>
  );
}

/** Density, contrast, elevation, separation, motion and the focus ring. */
function SurfaceCard() {
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);
  const updateLook = useThemeStore((s) => s.updateLook);
  const { look } = useCurrentLook();
  const shuffleSurface = () => updateLook(rollSurface());
  return (
    <SettingsCard
      title={tAppearance(APPEARANCE_KEYS.surfaceTitle)}
      description={tAppearance(APPEARANCE_KEYS.surfaceDescription)}
      action={
        <SectionShuffle
          onClick={shuffleSurface}
          label={tAppearance(APPEARANCE_KEYS.sectionSurface)}
          testId="shuffle-surface"
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.density)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.density)}
            value={look.densityId}
            options={DENSITY_OPTIONS}
            onPick={(value) => updateLook({ densityId: value })}
            testPrefix="density"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.contrast)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.contrast)}
            value={look.contrastId}
            options={CONTRAST_MODES}
            onPick={(value) => updateLook({ contrastId: value })}
            testPrefix="contrast"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.elevation)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.elevation)}
            value={look.elevationId}
            options={ELEVATION_LEVELS}
            onPick={(value) => updateLook({ elevationId: value })}
            testPrefix="elevation"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.separation)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.separationAria)}
            value={look.separationId}
            options={SEPARATION_STRATEGIES}
            onPick={(value) => updateLook({ separationId: value })}
            testPrefix="separation"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.motion)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.motion)}
            value={look.motionId}
            options={MOTION_OPTIONS}
            onPick={(value) => updateLook({ motionId: value })}
            testPrefix="motion"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{tAppearance(APPEARANCE_KEYS.focusRing)}</FieldLabel>
          <Choices
            ariaLabel={tAppearance(APPEARANCE_KEYS.focusRing)}
            value={look.focusId}
            options={FOCUS_RINGS}
            onPick={(value) => updateLook({ focusId: value })}
            testPrefix="focus"
          />
        </div>
      </div>
    </SettingsCard>
  );
}

/** "Custom" under the cards while a generated look is applied, naming it when it can. */
function CustomLookNote() {
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);
  const preset = useThemeStore((s) => s.preset);
  const { customLook } = useCurrentLook();
  return preset === GENERATED_PRESET ? (
    <div
      className="text-muted-foreground text-body mt-1 inline-flex items-center gap-1.5"
      data-testid="preset-custom"
    >
      <Check className="text-foreground size-4" aria-hidden />
      {customLook
        ? tAppearance(APPEARANCE_KEYS.customWith, { look: customLook })
        : tAppearance(APPEARANCE_KEYS.custom)}
    </div>
  ) : null;
}

/**
 * Appearance controls — a shadcn-create-style theme studio: light/dark/system
 * mode plus per-axis pickers (colour, fonts, radius, density, motion, …), each
 * section re-rollable via its own shuffle. Rendered inside the dedicated
 * AppearanceDialog, persisted via {@link useThemeStore}. The GLOBAL shuffle lives
 * in the dialog header. When `platformConfig.themeLock` is set the controls are hidden.
 */
export function AppearancePanel() {
  const { t: tAppearance } = useTranslation(APPEARANCE_NS);

  if (platformConfig.themeLock) {
    return (
      <div className="flex flex-col gap-3" data-testid="appearance-panel">
        <SettingsCard
          title={tAppearance(APPEARANCE_KEYS.themeTitle)}
          description={
            <span data-testid="theme-locked">
              {tAppearance(APPEARANCE_KEYS.themeLocked)}
            </span>
          }
        />
        <LanguagePrefsCard />
        <DateTimePrefsCard />
        <MoneyPrefsCard />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="appearance-panel">
      <LanguagePrefsCard />
      <DateTimePrefsCard />
      <MoneyPrefsCard />

      <ThemeCard />
      <ModeCard />
      <ColourCard />
      <TypographyCard />
      <IconsCard />
      {platformConfig.layoutWidthForced === null ? <LayoutWidthCard /> : null}
      <SurfaceCard />
      <CustomLookNote />
    </div>
  );
}
