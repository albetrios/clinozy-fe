import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CurrencyCode } from '@/lib/i18n/intl-config.ts';
import {
  CURRENCY_CODE_LIST,
  CURRENCY_DISPLAY_LABEL_KEYS,
  CURRENCY_DISPLAY_PREFERENCE_LIST,
  DIRECTION_LABEL_KEYS,
  FIRST_DAY_LABEL_KEYS,
  LOCALE_KEYS,
  LOCALE_NS,
  LOCALE_TEST_IDS,
  MEASUREMENT_LABEL_KEYS,
  NUMBER_STYLE_LABEL_KEYS,
  NUMBER_STYLE_PREFERENCE_LIST,
} from '@/lib/i18n/locale.constants.ts';
import { FieldLabel, OptionPills } from '@/shared/components/OptionPills/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

/** The currencies as picker rows. */
const CURRENCY_CODE_OPTIONS = CURRENCY_CODE_LIST.map((entry) => ({
  key: entry.id,
  label: entry.label,
}));

/**
 * Number + currency preferences — persisted via {@link useLocaleStore}.
 * Surfaced in Appearance alongside language and date/time cards.
 */
export function MoneyPrefsCard() {
  const { t } = useTranslation(LOCALE_NS);
  const numberStyle = useLocaleStore((s) => s.numberStyle);
  const currencyDisplay = useLocaleStore((s) => s.currencyDisplay);
  const currencyCode = useLocaleStore((s) => s.currencyCode);
  const setNumberStyle = useLocaleStore((s) => s.setNumberStyle);
  const setCurrencyDisplay = useLocaleStore((s) => s.setCurrencyDisplay);
  const setCurrencyCode = useLocaleStore((s) => s.setCurrencyCode);
  const {
    formatNumber,
    formatCurrency,
    formatRelativeTime,
    direction,
    firstDayOfWeek,
    measurementSystem,
  } = useLocaleFormat();

  const previews = useMemo(
    () => ({
      sampleNumber: formatNumber(1284750.5, { maximumFractionDigits: 1 }),
      sampleRelative: formatRelativeTime(
        '2026-06-25T12:30:45.000Z',
        new Date('2026-06-25T14:30:45.000Z'),
      ),
      sampleCurrency: formatCurrency(9900),
    }),
    [formatNumber, formatRelativeTime, formatCurrency],
  );

  return (
    <Card data-testid={LOCALE_TEST_IDS.moneyCard}>
      <CardHeader>
        <CardTitle className="text-base">{t(LOCALE_KEYS.numberStyleHeading)}</CardTitle>
        <CardDescription>{t(LOCALE_KEYS.numberStyleDescription)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <FieldLabel>{t(LOCALE_KEYS.numberStyleHeading)}</FieldLabel>
          <OptionPills
            ariaLabel={t(LOCALE_KEYS.numberStyleHeading)}
            value={numberStyle}
            options={NUMBER_STYLE_PREFERENCE_LIST}
            labelFor={(id) => t(NUMBER_STYLE_LABEL_KEYS[id])}
            onPick={(id) => setNumberStyle(id)}
            testPrefix="number-style"
          />
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel>{t(LOCALE_KEYS.currencyDisplayHeading)}</FieldLabel>
          <OptionPills
            ariaLabel={t(LOCALE_KEYS.currencyDisplayHeading)}
            value={currencyDisplay}
            options={CURRENCY_DISPLAY_PREFERENCE_LIST}
            labelFor={(id) => t(CURRENCY_DISPLAY_LABEL_KEYS[id])}
            onPick={(id) => setCurrencyDisplay(id)}
            testPrefix="currency-display"
          />
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel>{t(LOCALE_KEYS.currencyCodeHeading)}</FieldLabel>
          <Picker
            label={t(LOCALE_KEYS.currencyCodeHeading)}
            value={currencyCode}
            options={CURRENCY_CODE_OPTIONS}
            plain
            onChange={(key) => {
              if (key) setCurrencyCode(key as CurrencyCode);
            }}
            testId="currency-code-select"
            className="w-full"
          />
        </div>

        <div className="bg-muted/30 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
          <p>{t(LOCALE_KEYS.previewNumber, { value: previews.sampleNumber })}</p>
          <p>{t(LOCALE_KEYS.previewRelative, { value: previews.sampleRelative })}</p>
          <p>{t(LOCALE_KEYS.previewCurrency, { value: previews.sampleCurrency })}</p>
          <p data-testid="locale-preview-direction">
            {t(LOCALE_KEYS.previewDirection, {
              value: t(DIRECTION_LABEL_KEYS[direction]),
            })}
          </p>
          <p data-testid="locale-preview-first-day">
            {t(LOCALE_KEYS.previewFirstDay, {
              value: t(FIRST_DAY_LABEL_KEYS[firstDayOfWeek]),
            })}
          </p>
          <p data-testid="locale-preview-measurement">
            {t(LOCALE_KEYS.previewMeasurement, {
              value: t(MEASUREMENT_LABEL_KEYS[measurementSystem]),
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
