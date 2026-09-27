import i18n from '@/lib/i18n/i18n.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';

import { AUTH_NS, MFA_MANIFEST } from './mfa.constants.ts';

export const manifest = {
  segment: 'mfa',
  path: '/mfa',
  title: i18n.t(MFA_MANIFEST.titleKey, { ns: AUTH_NS }),
  testId: MFA_MANIFEST.testId,
  permission: null,
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
