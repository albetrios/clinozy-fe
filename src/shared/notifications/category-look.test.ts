import { describe, expect, it } from 'vitest';

import { notificationCategorySchema } from '@/shared/api/notification-contracts.ts';
import { Bell, ShieldCheck, UserPlus, Zap } from '@/shared/icons/index.ts';

import { NOTIFICATION_CATEGORY_LOOK } from './category-look.ts';

describe('NOTIFICATION_CATEGORY_LOOK', () => {
  it('draws every category the API knows', () => {
    for (const category of notificationCategorySchema.options) {
      expect(NOTIFICATION_CATEGORY_LOOK[category]).toBeDefined();
    }
  });

  it('keeps the inbox glyphs and borrows the rooms’ tones', () => {
    expect(NOTIFICATION_CATEGORY_LOOK).toEqual({
      system: { icon: Bell, tone: 'stone' },
      member: { icon: UserPlus, tone: 'slate' },
      billing: { icon: Zap, tone: 'peach' },
      security: { icon: ShieldCheck, tone: 'sage' },
    });
  });
});
