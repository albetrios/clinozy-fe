import type { ReactNode } from 'react';

import { I18nProvider } from './I18nProvider.tsx';
import { QueryProvider } from './QueryProvider.tsx';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Compose all application providers in the correct order.
 *
 * SEO/meta tags are handled by TanStack Router (HeadContent + route head() in routeTree).
 * Organization resolution is performed synchronously in main.tsx BEFORE React mounts.
 * Components consume organization state via `useOrganizationStore()` directly.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <I18nProvider>
      <QueryProvider>{children}</QueryProvider>
    </I18nProvider>
  );
}
