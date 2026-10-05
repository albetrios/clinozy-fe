import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import type { LeadMessage } from '@/shared/api/clinic/clinic-schema.ts';
import type { ChatAuthor } from '@/shared/api/clinic/messages-contracts.ts';
import {
  CHAT_COLUMN_NS,
  CHAT_COLUMN_TEST_IDS as ids,
} from '@/shared/components/ChatColumn/chat-column.constants.ts';
import type {
  ChatClock,
  ChatFormat,
  ThreadEntry,
} from '@/shared/components/ChatColumn/chat-history.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { clinicClockOf } from '@/shared/hooks/useClinicClock/index.ts';
import { Calendar } from '@/shared/icons/index.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import { ChatThread, type ChatThreadProps } from './ChatThread.tsx';

const clock: ChatClock = clinicClockOf(
  {
    today: '2026-10-03',
    clinicToday: '2026-10-03',
    dayOf: (instant) => instant.slice(0, 10),
    time: () => '10:28 am',
    shortTime: () => '10 am',
    date: () => '30 Sep',
    wallTime: (_date, time) => time,
  },
  {
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    weekday: () => 'Wed',
    todayTime: (time) => `Today ${time}`,
    dayTime: (day, time) => `${day} ${time}`,
  },
);

function formatWith(): ChatFormat {
  return {
    t: i18n.getFixedT('en', CHAT_COLUMN_NS),
    money: (paise) => `₹${paise / 100}`,
    clock,
  };
}

const RIYA = '00000000-0000-4000-8000-0000000000a1';
const AUTHORS: Record<string, ChatAuthor> = {
  [RIYA]: {
    id: RIYA,
    name: 'Riya Shah',
    initials: 'RS',
    tone: 'blush',
    roles: ['front_desk'],
    phone: null,
    email: 'riya@cresence.skin',
    online: true,
  },
};

let sequence = 0;
function message(fields: Partial<LeadMessage>): ThreadEntry {
  sequence += 1;
  const id = `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
  const row: LeadMessage = {
    organizationId: '00000000-0000-4000-8000-0000000c1a10',
    createdAt: '2026-10-03T04:58:00.000Z',
    updatedAt: '2026-10-03T04:58:00.000Z',
    createdById: RIYA,
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
    id,
    leadId: '00000000-0000-4000-8000-000000000100',
    channel: 'whatsapp',
    direction: 'received',
    body: 'Hello',
    deliveryStatus: 'delivered',
    isSystem: false,
    authorId: null,
    taskId: null,
    sentAt: '2026-10-03T04:58:00.000Z',
    ...fields,
  };
  return { kind: 'message', key: id, sortAt: row.sentAt, message: row };
}

function renderThread(overrides: Partial<ChatThreadProps> = {}) {
  const props: ChatThreadProps = {
    entries: [],
    divider: 'Lead created · Today 10:28 am · via WhatsApp',
    empty: null,
    authors: AUTHORS,
    contactFirst: 'Anaya',
    whatsappDown: false,
    format: formatWith(),
    onResend: vi.fn(),
    resendingId: null,
    onRetry: vi.fn(),
    ...overrides,
  };
  const view = render(
    <TooltipProvider>
      <ChatThread {...props} />
    </TooltipProvider>,
  );
  return { ...view, props };
}

describe('ChatThread', () => {
  it('draws theirs on the start side and ours on the end side, with sender, glyph and time', () => {
    renderThread({
      entries: [
        message({ body: 'Is Saturday possible?' }),
        message({
          direction: 'sent',
          authorId: RIYA,
          body: 'Yes',
          deliveryStatus: 'read',
        }),
      ],
    });
    const [theirs, ours] = screen.getAllByTestId(ids.bubble);
    expect(theirs).toHaveAttribute('data-kind', 'in');
    expect(theirs).toHaveClass('justify-start');
    // Today's messages carry the clock time alone (the prototype's "10:28").
    expect(theirs).toHaveTextContent(`${fsi('Anaya')}·WhatsApp10:28 am`);
    expect(ours).toHaveAttribute('data-kind', 'out');
    expect(ours).toHaveClass('justify-end');
    expect(ours).toHaveTextContent(`${fsi('Riya S.')}·WhatsApp10:28 am·Read`);
    expect(within(ours as HTMLElement).getByText('Read')).toHaveClass(
      'text-success-strong',
    );
  });

  it('paints call logs sky and notes butter with a dashed line, sent "· call" / "· note"', () => {
    renderThread({
      entries: [
        message({
          direction: 'sent',
          channel: 'call',
          authorId: RIYA,
          body: 'No answer',
        }),
        message({
          direction: 'sent',
          channel: 'note',
          authorId: RIYA,
          body: 'Prefers Hindi',
        }),
      ],
    });
    const [call, note] = screen.getAllByTestId(ids.bubble);
    expect(call).toHaveAttribute('data-kind', 'call');
    expect(call).toHaveTextContent(`${fsi('Riya S.')} · call`);
    expect(within(call as HTMLElement).getByText('No answer')).toHaveClass('bg-tone-sky');
    expect(note).toHaveTextContent(`${fsi('Riya S.')} · note`);
    expect(within(note as HTMLElement).getByText('Prefers Hindi')).toHaveClass(
      'bg-tone-butter',
      'border-dashed',
    );
  });

  it('labels delivery: "Sending…", "Queued" during an outage, "Not sent" with Retry', async () => {
    const user = userEvent.setup();
    const failed = message({ direction: 'sent', deliveryStatus: 'failed', body: 'Lost' });
    const { props } = renderThread({
      whatsappDown: true,
      entries: [
        message({ direction: 'sent', deliveryStatus: 'queued', body: 'Waiting' }),
        failed,
        {
          kind: 'outbox',
          key: 'local',
          sortAt: '2026-10-03T05:00:00.000Z',
          message: {
            clientId: 'local',
            channel: 'whatsapp',
            body: 'On its way',
            at: '2026-10-03T05:00:00.000Z',
            state: 'sending',
          },
        },
      ],
    });
    const [queued, lost, sending] = screen.getAllByTestId(ids.bubble);
    expect(queued).toHaveTextContent('·Queued');
    expect(sending).toHaveTextContent('Sending…');
    expect(lost).toHaveTextContent('Not sent');
    await user.click(within(lost as HTMLElement).getByRole('button', { name: 'Retry' }));
    expect(props.onResend).toHaveBeenCalledWith(
      failed.kind === 'message' ? failed.message.id : '',
    );
  });

  it('names the signed-in member on a message still sending — "· call" on a call log', () => {
    renderThread({
      selfName: 'Riya S.',
      entries: [
        {
          kind: 'outbox',
          key: 'local-call',
          sortAt: '2026-10-03T05:00:00.000Z',
          message: {
            clientId: 'local-call',
            channel: 'call',
            body: 'No answer',
            at: '2026-10-03T05:00:00.000Z',
            state: 'sending',
          },
        },
      ],
    });
    expect(screen.getByTestId(ids.bubble)).toHaveTextContent(`${fsi('Riya S.')} · call`);
  });

  it('reads a message and its time in their own direction on a right-to-left page', () => {
    render(
      <TooltipProvider>
        <div dir="rtl">
          <ChatThread
            entries={[message({ body: 'Is Saturday possible?' })]}
            divider="Lead created"
            empty={null}
            authors={AUTHORS}
            contactFirst="Anaya"
            whatsappDown={false}
            format={formatWith()}
            onResend={vi.fn()}
            resendingId={null}
            onRetry={vi.fn()}
          />
        </div>
      </TooltipProvider>,
    );
    // An English message on an Arabic page reads left to right; so does "10:28 am".
    expect(screen.getByText('Is Saturday possible?')).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('10:28 am')).toHaveAttribute('dir', 'auto');
    expect(screen.getByTestId(ids.bubble)).toHaveTextContent(
      `Is Saturday possible?${fsi('Anaya')}·WhatsApp10:28 am`,
    );
  });

  it('draws history chips — a button when the host opens records — and system lines', async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    const target = { kind: 'appointment', appointmentId: 'a-1' } as const;
    renderThread({
      onOpenHistory,
      entries: [
        {
          kind: 'history',
          key: 'appointment:a-1',
          sortAt: '2026-09-30T09:20:00.000Z',
          when: '30 Sep 2:50 pm',
          chip: {
            key: 'appointment:a-1',
            text: 'Appointment #2740 · Peel · Completed · Dr. Nisha',
            icon: Calendar,
            tone: 'sage',
            target,
          },
        },
        {
          kind: 'system',
          key: 's-1',
          sortAt: '2026-10-03T04:58:00.000Z',
          text: 'Status → Contacted (first reply)',
          when: 'Today 10:28 am',
        },
      ],
    });
    const chip = screen.getByRole('button', {
      name: /Appointment #2740 · Peel · Completed · Dr\. Nisha/,
    });
    await user.click(chip);
    expect(onOpenHistory).toHaveBeenCalledWith(target);
    expect(screen.getByTestId(ids.system)).toHaveTextContent(
      'Status → Contacted (first reply)Today 10:28 am',
    );
    expect(screen.getByTestId(ids.divider)).toHaveTextContent(
      'Lead created · Today 10:28 am · via WhatsApp',
    );
  });

  it('shows the dashed starter card while there is no conversation, and hands back a pick', async () => {
    const user = userEvent.setup();
    const onStarter = vi.fn();
    const starter = { key: 'hello', label: 'Say hello', text: 'Hi Anaya…' };
    const { container } = renderThread({
      empty: {
        line: 'Start with a WhatsApp · replies land here',
        starters: [starter],
        onStarter,
      },
    });
    expect(screen.getByRole('heading', { name: 'No conversation yet' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Say hello' }));
    expect(onStarter).toHaveBeenCalledWith(starter);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a log of messages with no accessibility violations', async () => {
    const { container } = renderThread({
      entries: [message({}), message({ direction: 'sent', authorId: RIYA })],
    });
    expect(screen.getByRole('log', { name: 'Messages' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
