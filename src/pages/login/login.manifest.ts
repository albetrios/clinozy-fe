import i18n from '@/lib/i18n/i18n.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';

import { AUTH_NS, LOGIN_MANIFEST } from './login.constants.ts';

export const manifest = {
  segment: 'login',
  path: '/login',
  title: i18n.t(LOGIN_MANIFEST.titleKey, { ns: AUTH_NS }),
  testId: LOGIN_MANIFEST.testId,
  permission: null,
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
