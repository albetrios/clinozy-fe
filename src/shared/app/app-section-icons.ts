import type { Section } from '@/shared/api/app/app-schema.ts';
import {
  type AppIcon,
  Calendar,
  House,
  Package,
  Pill,
  Shield,
  SquareCheck,
  Tag,
  UserPlus,
  Users,
  Wallet,
} from '@/shared/icons/index.ts';

/**
 * Each clinic section's icon (KICKOFF §3.2, `shell.md:39`) — the nav, All
 * sections, ⌘K and the Users room's matrix draw the section with it. Its own
 * module so `app-sections.ts` stays free of icon imports.
 */
export const APP_SECTION_ICONS: Readonly<Record<Section, AppIcon>> = {
  today: House,
  leads: UserPlus,
  appointments: Calendar,
  patients: Users,
  medical: Pill,
  stock: Package,
  payments: Wallet,
  tasks: SquareCheck,
  offerings: Tag,
  users: Shield,
};
