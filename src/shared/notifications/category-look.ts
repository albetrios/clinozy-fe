import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { NotificationCategory } from '@/shared/api/notification-contracts.ts';
import { type AppIcon, Bell, ShieldCheck, UserPlus, Zap } from '@/shared/icons/index.ts';

/** How one notification category is drawn: its glyph and its tone tile. */
export interface NotificationCategoryLook {
  icon: AppIcon;
  tone: Tone;
}

/**
 * Each notification category's glyph and tone — one table for the inbox rows
 * and the Settings › Notifications matrix, so a category reads the same in
 * both. The tones borrow the rooms' meaning (`shell.md:42`): team changes take
 * the Users room's slate, billing the Payments room's peach, security sage (the
 * design's "given" green), and the product's own news the fallback stone.
 */
export const NOTIFICATION_CATEGORY_LOOK: Readonly<
  Record<NotificationCategory, NotificationCategoryLook>
> = {
  system: { icon: Bell, tone: 'stone' },
  member: { icon: UserPlus, tone: 'slate' },
  billing: { icon: Zap, tone: 'peach' },
  security: { icon: ShieldCheck, tone: 'sage' },
};
