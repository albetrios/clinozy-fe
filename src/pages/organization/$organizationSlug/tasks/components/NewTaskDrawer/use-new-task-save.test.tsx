import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskFields } from '@/shared/api/app/tasks-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  taskWireRow,
  TEST_TASK_CONTACT_ID,
  TEST_TASK_ID,
  TEST_TASK_MEMBER_ID,
} from '@/tests/utils/task-doubles.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/core/http/api.ts';

import { type NewTaskForm, newTaskForm } from './new-task-form.ts';
import { useNewTaskSave } from './use-new-task-save.ts';

/** The create the drawer asks for: "Call back · Anaya", tomorrow 11:00, the front desk member's. */
const FIELDS: TaskFields = {
  title: ' Call back · Anaya ',
  why: null,
  dueAt: '2026-10-13T05:30:00.000Z',
  assignee: { membershipId: TEST_TASK_MEMBER_ID },
  priority: 'high',
  contactId: TEST_TASK_CONTACT_ID,
  link: null,
};

/** The body `POST /app/tasks` sends for {@link FIELDS}. */
const BODY = {
  title: 'Call back · Anaya',
  due_at: '2026-10-13T05:30:00.000Z',
  owner_membership_id: TEST_TASK_MEMBER_ID,
  contact_id: TEST_TASK_CONTACT_ID,
  priority: 'high',
};

/** A refusal in clinozy-be's envelope, as the fetch client throws it. */
const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, '/api/v1/app/tasks', 'POST', { error });

/** A save toast's Retry, from the last failure toast. */
function lastToastAction() {
  const [, options] = notifyMock.error.mock.lastCall as [
    string,
    { id: string; action: { label: string; onClick: () => void } },
  ];
  return options;
}

describe('useNewTaskSave — New task’s write (POST /app/tasks)', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render(fields: () => TaskFields | null = () => FIELDS) {
    const onField = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<NewTaskForm>({ defaultValues: newTaskForm('2026-10-12') });
        return { form, save: useNewTaskSave({ form, fields, onField, onDone }) };
      },
      { wrapper },
    );
    return { ...view, onField, onDone };
  }

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.mocked(api.post).mockReset();
    for (const fn of Object.values(notifyMock)) fn.mockReset();
  });
  afterEach(() => client.clear());

  it('sends the fields with an idempotency key and hands back the task as saved', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: taskWireRow({ title: 'Call back · Anaya', kind: 'manual', rule_key: null }),
      meta: {},
    } as never);
    const { result, onDone } = render();

    await act(() => result.current.save.save());

    expect(api.post).toHaveBeenCalledOnce();
    expect(api.post).toHaveBeenCalledWith('/app/tasks', {
      body: BODY,
      idempotencyKey: expect.any(String),
    });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ id: TEST_TASK_ID, title: 'Call back · Anaya' }),
      false,
    );
    // "Saving…" holds every exit until the room closes the drawer on the outcome.
    expect(result.current.save.saveState).toBe('saving');
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('sends nothing when the form lacks a title or an assignee — the draft is kept', async () => {
    const { result, onDone } = render(() => null);

    await act(() => result.current.save.save());

    expect(api.post).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.save.saveState).toBe('failed');
  });

  it('puts an assignee the server refuses on Owner and opens its step', async () => {
    vi.mocked(api.post).mockRejectedValue(
      refusal(400, {
        type: 'validation_error',
        detail: 'Check the fields',
        errors: [
          { field: 'body.owner_membership_id', message: 'This member cannot work tasks' },
        ],
      }),
    );
    const { result, onField, onDone } = render();

    await act(() => result.current.save.save());

    expect(result.current.form.getFieldState('owner').error?.message).toBe(
      'This member cannot work tasks',
    );
    expect(onField).toHaveBeenCalledWith('owner');
    expect(notifyMock.error).toHaveBeenCalledWith('This member cannot work tasks');
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.save.saveState).toBe('idle');
  });

  it('opens the first field the server named in the drawer’s order — the person before the due', async () => {
    vi.mocked(api.post).mockRejectedValue(
      refusal(400, {
        type: 'validation_error',
        errors: [
          { field: 'body.due_at', message: 'Pick a time ahead' },
          { field: 'body.lead_id', message: 'Not this person’s lead' },
          { field: 'body.why', message: 'Too long' },
        ],
      }),
    );
    const { result, onField } = render();

    await act(() => result.current.save.save());

    expect(result.current.form.getFieldState('person').error?.message).toBe(
      'Not this person’s lead',
    );
    expect(result.current.form.getFieldState('dueDate').error?.message).toBe(
      'Pick a time ahead',
    );
    expect(result.current.form.getFieldState('notes').error?.message).toBe('Too long');
    expect(onField).toHaveBeenCalledOnce();
    expect(onField).toHaveBeenCalledWith('person');
    expect(notifyMock.error).toHaveBeenCalledWith('Not this person’s lead');
  });

  it('toasts a refusal that names no field in the server’s words', async () => {
    vi.mocked(api.post).mockRejectedValue(
      refusal(403, { type: 'forbidden', detail: 'You cannot create tasks' }),
    );
    const { result, onField } = render();

    await act(() => result.current.save.save());

    expect(onField).not.toHaveBeenCalled();
    expect(notifyMock.error).toHaveBeenCalledWith('You cannot create tasks');
    expect(result.current.save.saveState).toBe('idle');
  });

  it('keeps the draft on a dropped connection, and Retry sends the same body under the same key', async () => {
    vi.mocked(api.post)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ data: taskWireRow(), meta: {} } as never);
    const { result, onDone } = render();

    await act(() => result.current.save.save());

    expect(result.current.save.saveState).toBe('failed');
    const toast = lastToastAction();
    expect(toast.id).toBe('new-task-save-failed');
    expect(toast.action.label).toBe('Retry');
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => toast.action.onClick());

    expect(api.post).toHaveBeenCalledTimes(2);
    const [first, second] = vi.mocked(api.post).mock.calls as unknown as [
      [string, { body: unknown; idempotencyKey: string }],
      [string, { body: unknown; idempotencyKey: string }],
    ];
    expect(second[1].body).toEqual(first[1].body);
    expect(second[1].idempotencyKey).toBe(first[1].idempotencyKey);
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ id: TEST_TASK_ID }),
      false,
    );
  });

  it('treats a server failure (5xx) as a dropped save, never as a refusal', async () => {
    vi.mocked(api.post).mockRejectedValue(
      refusal(503, { type: 'unavailable', detail: 'Database is down' }),
    );
    const { result } = render();

    await act(() => result.current.save.save());

    expect(result.current.save.saveState).toBe('failed');
    const [message] = notifyMock.error.mock.lastCall as [string];
    expect(message).not.toContain('Database');
  });
});
