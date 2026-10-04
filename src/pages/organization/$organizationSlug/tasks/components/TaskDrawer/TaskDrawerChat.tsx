import { useEffect } from 'react';

import type { TaskDetail } from '@/shared/api/clinic/tasks-contracts.ts';
import {
  ChatColumn,
  chatContactOfLead,
  composerShowsLabels,
} from '@/shared/components/ChatColumn/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useEnsureContactThread } from '@/shared/hooks/useContactThread/index.ts';

import { taskContactCard } from '../../tasks.display.ts';

/**
 * The task drawer's chat column (D32; `tasks.md` › Chat column): the person's
 * one thread — the task's lead, their lead, their contact thread — bound by id;
 * a person with none gets a contact thread opened (seeded "Task · <title>",
 * an appointment task its visit's line) by the idempotent lookup-or-create, so
 * a second open never makes a second thread. Skeleton bars until it is bound;
 * the task column stays readable meanwhile.
 */
export function TaskDrawerChat({
  detail,
  viewportWidth,
  chatWidth,
  contactActions,
  onBookAppointment,
}: {
  detail: TaskDetail;
  viewportWidth: number;
  /** The width last dragged in the lead drawer — the labels beside "Send via" follow it. */
  chatWidth: number;
  contactActions?: ContactCardActions;
  onBookAppointment?: () => void;
}) {
  const ensure = useEnsureContactThread();
  const row = detail.task;
  const thread = detail.thread ?? ensure.data?.lead ?? null;
  const { mutate } = ensure;
  const unbound = detail.thread === null;
  const idle = ensure.isIdle;
  useEffect(() => {
    if (!(unbound && idle)) return;
    mutate({
      name: row.person.name,
      patientId: row.person.patientId,
      leadId: row.person.leadId,
      phone: row.person.phone,
      context: { kind: 'task', taskId: row.id },
    });
  }, [unbound, idle, mutate, row]);

  if (!thread) {
    if (ensure.isError) {
      return <RetryError onRetry={() => ensure.reset()} />;
    }
    return <SkeletonRows rows={6} className="p-(--table-pad-x)" />;
  }
  return (
    <ChatColumn
      person={{ kind: 'lead', leadId: thread.id }}
      contact={chatContactOfLead(thread)}
      showModeLabels={composerShowsLabels(viewportWidth, chatWidth)}
      contactCard={{ data: taskContactCard(row), ...contactActions }}
      onBookAppointment={onBookAppointment ? () => onBookAppointment() : undefined}
    />
  );
}
