import type { TaskRuleId } from '@/shared/api/clinic/tasks-contracts.ts';
import {
  type AppIcon,
  Bell,
  Calendar,
  Clock,
  Info,
  MessageSquare,
  Phone,
  RefreshCw,
  Sparkles,
  Users,
  Wallet,
} from '@/shared/icons/index.ts';

/**
 * Each task rule's icon (`tasks.md:240–253`): the row tile at 15px, the drawer
 * tile at 18px, in the rule's tone. Payment due and Recall have no designed
 * icon — they take the Payments section's wallet and the calendar (AMBER).
 * Its own module so the rule catalogue stays free of React.
 */
export const TASK_RULE_ICONS: Readonly<Record<TaskRuleId, AppIcon>> = {
  reply: MessageSquare,
  follow: Phone,
  claim: Users,
  failed: Info,
  confirm: Calendar,
  arrive: Clock,
  rebook: RefreshCw,
  feedback: Sparkles,
  aftercare: Sparkles,
  unhappy: Info,
  nextvisit: Calendar,
  noreply: Phone,
  manual: Bell,
  payment: Wallet,
  recall: Calendar,
};
