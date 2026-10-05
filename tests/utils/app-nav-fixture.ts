import type { AppNav } from '@/shared/hooks/useAppNav/index.ts';
import { House } from '@/shared/icons/index.ts';

/**
 * A nav holding one room — Today — for shell and ⌘K tests that mock `useAppNav`
 * (its own suite covers how the nav is built).
 */
export const TODAY_ONLY_NAV: AppNav = {
  isResolved: true,
  entries: [
    {
      id: 'today',
      to: '/organization/$organizationSlug/today',
      section: 'today',
      icon: House,
      labelNs: 'clinic',
      labelKey: 'sections.today.label',
      permission: 'organization:read',
    },
  ],
};
