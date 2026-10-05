import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { Plug } from '@/shared/icons/index.ts';

import {
  CLINIC_HOME_EMPTY_KEYS,
  CLINIC_HOME_EMPTY_NS,
} from './clinic-home-empty.constants.ts';

/**
 * The org home when no clinic room is open to the member — every room's module
 * is off for the deployment (D8: production until each room's API lands) or
 * their access views none. It renders in the org shell in a room's place, so
 * the header, ⌘K and the account menu stay. Never a redirect: the home is where
 * every way into a clinic lands, so it must not bounce anywhere itself.
 */
export function ClinicHomeEmpty() {
  const { t } = useTranslation(CLINIC_HOME_EMPTY_NS);
  return (
    <div
      data-testid="clinic-home-empty"
      className="flex min-h-full items-center justify-center"
    >
      <EmptyState
        tone="stone"
        icon={<Plug />}
        title={t(CLINIC_HOME_EMPTY_KEYS.title)}
        description={t(CLINIC_HOME_EMPTY_KEYS.description)}
      />
    </div>
  );
}
