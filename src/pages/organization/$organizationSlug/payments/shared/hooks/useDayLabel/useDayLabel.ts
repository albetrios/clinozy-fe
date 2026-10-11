import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { addCivilDays, appToday, localDateOf } from '@/shared/api/app/app-time.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

/**
 * A civil day as the payments drawers' tiles name it: "Today", else "2 Oct"
 * (H:5131) — Send payment's Date, Add pending's Settle by, an invoice's day.
 * With `yesterday`, the day before reads "Yesterday" — Day close's titles
 * ("Yesterday is closed", H:5112); with `relative: false` every day is its
 * date ("3 entries on 3 Oct").
 */
export function useDayLabel({
  yesterday = false,
  relative = true,
}: { yesterday?: boolean; relative?: boolean } = {}): (day: string) => string {
  const { t } = useTranslation(PICKER_NS);
  const { formatDate } = useLocaleFormat();
  const [today] = useState(() => appToday());
  return (day) => {
    if (relative && day === today) return t(PICKER_KEYS.date.today);
    if (relative && yesterday && day === addCivilDays(today, -1)) {
      return t(PICKER_KEYS.date.yesterday);
    }
    return formatDate(
      localDateOf(day),
      { day: 'numeric', month: 'short' },
      { civilDay: true },
    );
  };
}
