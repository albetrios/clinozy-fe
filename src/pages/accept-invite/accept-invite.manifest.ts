import i18n from '@/lib/i18n/i18n.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';

import { ACCEPT_INVITE_MANIFEST, AUTH_NS } from './accept-invite.constants.ts';

export const manifest = {
  segment: 'accept-invite',
  path: '/accept-invite/$invitationId',
  title: i18n.t(ACCEPT_INVITE_MANIFEST.titleKey, { ns: AUTH_NS }),
  testId: ACCEPT_INVITE_MANIFEST.testId,
  permission: null,
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
