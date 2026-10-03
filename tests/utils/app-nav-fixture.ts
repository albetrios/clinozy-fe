import type { AppNav } from '@/shared/hooks/useAppNav/index.ts';
import { LayoutDashboard } from '@/shared/icons/index.ts';
import { APP_NAV_SEGMENT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';

/**
 * The nav a template deployment draws — the Dashboard alone — for shell and ⌘K
 * tests that mock `useAppNav` (its own suite covers how the nav is built).
 */
export const DASHBOARD_ONLY_NAV: AppNav = {
  isResolved: true,
  entries: [
    {
      id: 'dashboard',
      to: '/dashboard',
      section: null,
      icon: LayoutDashboard,
      labelNs: LAYOUT_NS,
      labelKey: APP_NAV_SEGMENT_KEYS.dashboard,
      permission: 'organization:read',
    },
  ],
};
