import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

/**
 * A civil day as the payments drawers' tiles name it: "Today", else "2 Oct"
 * (H:5131) — Send payment's Date, Add pending's Settle by, an invoice's day.
 */
export function useDayLabel(): (day: string) => string {
  const { t } = useTranslation(PICKER_NS);
  const { formatDate } = useLocaleFormat();
  const [today] = useState(() => clinicToday());
  return (day) =>
    day === today
      ? t(PICKER_KEYS.date.today)
      : formatDate(
          localDateOf(day),
          { day: 'numeric', month: 'short' },
          { civilDay: true },
        );
}
