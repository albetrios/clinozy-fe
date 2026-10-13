import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import { addTask } from '@/shared/api/app/tasks-api.ts';
import type { TaskRow } from '@/shared/api/app/tasks-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';
import {
  taskRecord,
  taskRow,
  TEST_TASK_CONTACT_ID,
  TEST_TASK_LEAD_ID,
  TEST_TASK_MEMBER_ID,
} from '@/tests/utils/task-doubles.ts';

import { WhatsNextSheet } from './WhatsNextSheet.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: notifyMock,
}));
vi.mock('@/shared/api/app/tasks-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  addTask: vi.fn(),
}));

/** The team who can work tasks: the signed-in front desk member and a counsellor. */
const team = vi.hoisted(() => ({
  me: {
    id: 'mem_yls33gz5jj66ful8q4ads',
    userId: 'usr_riya',
    name: 'Riya Shah',
    initials: 'RS',
    tone: 'sky',
    roleIds: [],
    branchIds: [],
  },
  asha: {
    id: 'mem_asha0000000000000000',
    userId: 'usr_asha',
    name: 'Asha Mehta',
    initials: 'AM',
    tone: 'sage',
    roleIds: [],
    branchIds: [],
  },
}));
vi.mock('../../hooks/useTaskAssignees/index.ts', () => {
  const members = [team.me, team.asha] as DirectoryMember[];
  return {
    useTaskAssignees: () => ({
      options: members.map((member) => ({
        key: member.id,
        label: member.id === team.me.id ? `${member.name} (you)` : member.name,
        leading: { kind: 'avatar', initials: member.initials },
        data: member,
      })),
      myMembershipId: team.me.id,
      byId: new Map(members.map((member) => [member.id, member])),
      isPending: false,
    }),
  };
});

/** 10:30 in the clinic on Sat 10 Oct 2026. */
const NOW = new Date('2026-10-10T05:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  vi.mocked(addTask).mockReset();
  vi.mocked(addTask).mockImplementation(async ({ fields }) =>
    taskRecord({ id: 'task_next000000000000000', kind: 'manual', title: fields.title }),
  );
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
});

async function openSheet(task: TaskRow = taskRow()) {
  const onClose = vi.fn();
  const view = renderWithProviders(
    <WhatsNextSheet task={task} result="Booked a visit" onClose={onClose} />,
  );
  await view.router.load();
  const sheet = await screen.findByTestId('whats-next-drawer');
  return { ...view, sheet, onClose, user: userEvent.setup() };
}

describe('WhatsNextSheet (KICKOFF §6.10 What’s next)', () => {
  it('asks what’s next for the person after the task it closed', async () => {
    const { sheet } = await openSheet();
    expect(
      screen.getByRole('heading', { name: 'What’s next for Anaya?' }),
    ).toBeInTheDocument();
    // The closed task's title and result are isolated tokens in the sub line.
    expect(sheet).toHaveAccessibleDescription(
      `Closed · ${fsi('Reply to Anaya')} · ${fsi('Booked a visit')}`,
    );
    expect(screen.getByTestId('whats-next-owner')).toHaveTextContent('Riya Shah (you)');
    expect(screen.getByTestId('whats-next-drawer-dismiss')).toHaveTextContent(
      'Nothing next',
    );
    expect(await axeForDialog(sheet)).toHaveNoViolations();
  });

  it('needs a step, then a time — each named under its field', async () => {
    const { user } = await openSheet();
    await user.click(screen.getByTestId('whats-next-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick the next step');
    await user.click(screen.getByTestId('whats-next-step-sendWhatsApp'));
    await user.click(screen.getByTestId('whats-next-drawer-save'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Pick when');
    expect(screen.getByRole('alert')).toHaveTextContent('Pick when');
    expect(addTask).not.toHaveBeenCalled();
  });

  it('creates a task by hand for the same person and record, for the member, and toasts it', async () => {
    const { user, onClose } = await openSheet();
    await user.click(screen.getByTestId('whats-next-step-callAgain'));
    await user.click(screen.getByTestId('whats-next-when-tomorrow'));
    await user.type(screen.getByTestId('whats-next-note'), 'Ask about the peel');
    await user.click(screen.getByTestId('whats-next-drawer-save'));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(addTask).toHaveBeenCalledWith({
      fields: {
        title: 'Call again · Anaya',
        why: 'Ask about the peel',
        dueAt: '2026-10-11T05:30:00.000Z',
        assignee: { membershipId: TEST_TASK_MEMBER_ID },
        priority: 'normal',
        contactId: TEST_TASK_CONTACT_ID,
        link: { kind: 'lead', id: TEST_TASK_LEAD_ID },
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Next task set · Call again · tomorrow 11 am',
    );
  });

  it('gives it to the member picked, its why line the closed task without a note', async () => {
    const { user } = await openSheet();
    await user.click(screen.getByTestId('whats-next-step-bookVisit'));
    await user.click(screen.getByTestId('whats-next-when-inThreeDays'));
    await user.click(screen.getByTestId('whats-next-owner'));
    await user.click(
      within(screen.getByTestId('whats-next-owner-panel')).getByText('Asha Mehta'),
    );
    await user.click(screen.getByTestId('whats-next-drawer-save'));
    await waitFor(() => expect(addTask).toHaveBeenCalledOnce());
    expect(vi.mocked(addTask).mock.lastCall?.[0].fields).toMatchObject({
      why: 'Planned after: Reply to Anaya · Booked a visit',
      assignee: { membershipId: team.asha.id },
      dueAt: '2026-10-13T05:00:00.000Z',
    });
  });

  it('puts the server’s refusal on its field and keeps the sheet open', async () => {
    vi.mocked(addTask).mockRejectedValueOnce(
      new HttpError('Bad Request', 400, '/api/v1/app/tasks', 'POST', {
        error: {
          type: 'validation_error',
          errors: [{ field: 'body.due_at', message: 'Pick a time in the future' }],
        },
      }),
    );
    const { user, onClose } = await openSheet();
    await user.click(screen.getByTestId('whats-next-step-callAgain'));
    await user.click(screen.getByTestId('whats-next-when-inThreeHours'));
    await user.click(screen.getByTestId('whats-next-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Pick a time in the future'),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a time in the future');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('titles the follow-up by its step alone for a task about nobody', async () => {
    const { user } = await openSheet(
      taskRow({ person: null, contact: null, link: null }),
    );
    expect(screen.getByRole('heading', { name: 'What’s next?' })).toBeInTheDocument();
    await user.click(screen.getByTestId('whats-next-step-sendOffer'));
    await user.click(screen.getByTestId('whats-next-when-nextWeek'));
    await user.click(screen.getByTestId('whats-next-drawer-save'));
    await waitFor(() => expect(addTask).toHaveBeenCalledOnce());
    expect(vi.mocked(addTask).mock.lastCall?.[0].fields).toMatchObject({
      title: 'Send offer',
      contactId: null,
      link: null,
    });
  });

  it('closes on "Nothing next"', async () => {
    const { user, onClose } = await openSheet();
    await user.click(screen.getByTestId('whats-next-drawer-dismiss'));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
