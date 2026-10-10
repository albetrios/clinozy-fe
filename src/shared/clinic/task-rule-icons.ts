import type { TaskType } from '@/shared/api/clinic/tasks-contracts.ts';
import {
  type AppIcon,
  Bell,
  Calendar,
  Clock,
  Info,
  MessageSquare,
  Phone,
  Pill,
  Receipt,
  RefreshCw,
  Sparkles,
  Users,
  Wallet,
} from '@/shared/icons/index.ts';

/**
 * Each task type's icon (`tasks.md:240–253`): the row tile at 15px, the drawer
 * tile at 18px, in the type's tone. The rules the design did not draw take
 * their section's icon — Payment due the wallet, Settle credits the receipt,
 * Medical rep visits the pill (AMBER). Its own module so the catalogue stays
 * free of React.
 */
export const TASK_RULE_ICONS: Readonly<Record<TaskType, AppIcon>> = {
  reply: MessageSquare,
  follow_up: Phone,
  claim: Users,
  failed_message: Info,
  confirm: Calendar,
  arrive: Clock,
  rebook: RefreshCw,
  feedback: Sparkles,
  call_back: Info,
  aftercare: Sparkles,
  next_visit: Calendar,
  gone_quiet: Phone,
  by_hand: Bell,
  payment_due: Wallet,
  settle_by: Receipt,
  medical_rep_visit: Pill,
};
