import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDateValue } from '@/lib/i18n/format.ts';
import {
  type FormatLocaleTag,
  LOCALE_FORMAT_SAMPLES,
  type TimeZonePreference,
} from '@/lib/i18n/intl-config.ts';
import {
  DATE_FORMAT_LABEL_KEYS,
  DATE_FORMAT_PREFERENCE_LIST,
  FORMAT_LOCALE_LIST,
  HOUR_CYCLE_LABEL_KEYS,
  HOUR_CYCLE_PREFERENCE_LIST,
  LOCALE_KEYS,
  LOCALE_NS,
  LOCALE_TEST_IDS,
  TIME_ZONE_LIST,
} from '@/lib/i18n/locale.constants.ts';
import { DrawerChips } from '@/shared/components/DrawerField/drawer-chip-controls.tsx';
import { FieldLabel } from '@/shared/components/FieldLabel/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  localeFormatPrefs,
  useLocaleStore,
} from '@/shared/store/useLocaleStore/index.ts';

/** The regional formats as picker rows (their names are the catalog's own). */
const FORMAT_LOCALE_OPTIONS = FORMAT_LOCALE_LIST.map((entry) => ({
  key: entry.id,
  label: entry.label,
}));

/**
 * Device-local date/time controls — regional format locale (country), IANA
 * timezone, date style, and clock cycle. Persisted via {@link useLocaleStore};
 * changes apply live to every `formatDate` / `<FormattedDate />` consumer.
 */
export function DateTimePrefsCard() {
  const { t } = useTranslation(LOCALE_NS);
  const locale = useLocaleStore((s) => s.locale);
  const formatLocale = useLocaleStore((s) => s.formatLocale);
  const dateFormat = useLocaleStore((s) => s.dateFormat);
  const hourCycle = useLocaleStore((s) => s.hourCycle);
  const timeZone = useLocaleStore((s) => s.timeZone);
  const numberStyle = useLocaleStore((s) => s.numberStyle);
  const currencyDisplay = useLocaleStore((s) => s.currencyDisplay);
  const currencyCode = useLocaleStore((s) => s.currencyCode);
  const setFormatLocale = useLocaleStore((s) => s.setFormatLocale);
  const setDateFormat = useLocaleStore((s) => s.setDateFormat);
  const setHourCycle = useLocaleStore((s) => s.setHourCycle);
  const setTimeZone = useLocaleStore((s) => s.setTimeZone);
  const timeZoneOptions = TIME_ZONE_LIST.map((entry) => ({
    key: entry.id,
    label: entry.id === 'auto' ? t(LOCALE_KEYS.timeZoneDevice) : entry.label,
  }));

  const previews = useMemo(() => {
    const prefs = localeFormatPrefs({
      locale,
      formatLocale,
      dateFormat,
      hourCycle,
      timeZone,
      numberStyle,
      currencyDisplay,
      currencyCode,
    });
    return {
      sampleDateTime: formatDateValue(LOCALE_FORMAT_SAMPLES.dateIso, prefs),
      sampleTimeOnly: formatDateValue(LOCALE_FORMAT_SAMPLES.dateIso, {
        ...prefs,
        dateFormat: 'time',
      }),
      zoneLabel:
        timeZone === 'auto'
          ? t(LOCALE_KEYS.timeZoneDevice)
          : (TIME_ZONE_LIST.find((entry) => entry.id === timeZone)?.label ?? timeZone),
    };
  }, [
    t,
    locale,
    formatLocale,
    dateFormat,
    hourCycle,
    timeZone,
    numberStyle,
    currencyDisplay,
    currencyCode,
  ]);

  return (
    <SettingsCard
      data-testid={LOCALE_TEST_IDS.dateTimeCard}
      title={t(LOCALE_KEYS.dateTimeHeading)}
      description={t(LOCALE_KEYS.dateTimeDescription)}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{t(LOCALE_KEYS.formatLocaleHeading)}</FieldLabel>
          <Picker
            label={t(LOCALE_KEYS.formatLocaleHeading)}
            value={formatLocale}
            options={FORMAT_LOCALE_OPTIONS}
            plain
            onChange={(key) => {
              if (key) setFormatLocale(key as FormatLocaleTag);
            }}
            testId="format-locale-select"
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>{t(LOCALE_KEYS.timeZoneHeading)}</FieldLabel>
          <Picker
            label={t(LOCALE_KEYS.timeZoneHeading)}
            value={timeZone}
            options={timeZoneOptions}
            plain
            onChange={(key) => {
              if (key) setTimeZone(key as TimeZonePreference);
            }}
            testId="time-zone-select"
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>{t(LOCALE_KEYS.dateFormatHeading)}</FieldLabel>
          <DrawerChips
            label={t(LOCALE_KEYS.dateFormatHeading)}
            value={dateFormat}
            options={DATE_FORMAT_PREFERENCE_LIST.map((id) => ({
              value: id,
              label: t(DATE_FORMAT_LABEL_KEYS[id]),
            }))}
            onChange={(id) => {
              if (id) setDateFormat(id);
            }}
            testId="date-format"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>{t(LOCALE_KEYS.hourCycleHeading)}</FieldLabel>
          <DrawerChips
            label={t(LOCALE_KEYS.hourCycleHeading)}
            value={hourCycle}
            options={HOUR_CYCLE_PREFERENCE_LIST.map((id) => ({
              value: id,
              label: t(HOUR_CYCLE_LABEL_KEYS[id]),
            }))}
            onChange={(id) => {
              if (id) setHourCycle(id);
            }}
            testId="hour-cycle"
          />
        </div>

        <div className="bg-canvas text-muted-foreground-strong rounded-lg border border-dashed px-3 py-2 text-xs leading-[1.6] tabular-nums">
          <p>{t(LOCALE_KEYS.previewDate, { value: previews.sampleDateTime })}</p>
          <p>{t(LOCALE_KEYS.previewTime, { value: previews.sampleTimeOnly })}</p>
          <p data-testid="locale-preview-timezone">
            {t(LOCALE_KEYS.previewTimeZone, { value: previews.zoneLabel })}
          </p>
        </div>
      </div>
    </SettingsCard>
  );
}
