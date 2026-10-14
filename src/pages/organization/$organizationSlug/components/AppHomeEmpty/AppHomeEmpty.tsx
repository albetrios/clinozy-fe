import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { Plug } from '@/shared/icons/index.ts';

import { APP_HOME_EMPTY_KEYS, APP_HOME_EMPTY_NS } from './app-home-empty.constants.ts';

/**
 * The org home when no clinic room is open to the member — every room's module
 * is off for the deployment (D8: production until each room's API lands) or
 * their access views none. It renders in the org shell in a room's place, so
 * the header, ⌘K and the account menu stay. Never a redirect: the home is where
 * every way into a clinic lands, so it must not bounce anywhere itself.
 */
export function AppHomeEmpty() {
  const { t } = useTranslation(APP_HOME_EMPTY_NS);
  return (
    <div
      data-testid="app-home-empty"
      className="flex min-h-full items-center justify-center"
    >
      <EmptyState
        tone="sky"
        icon={<Plug />}
        title={t(APP_HOME_EMPTY_KEYS.title)}
        description={t(APP_HOME_EMPTY_KEYS.description)}
      />
    </div>
  );
}
