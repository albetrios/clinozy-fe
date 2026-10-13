import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { branchQueryKeys } from '@/shared/api/app/branches-api.ts';
import type { AppBranch } from '@/shared/api/app/branches-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  appBranch,
  branchWireRow,
  TEST_BRANCH_ID,
} from '@/tests/utils/branch-doubles.ts';

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

import { branchFormOf, type BranchFormValues, emptyBranchForm } from './branch-form.ts';
import { useBranchSave } from './use-branch-save.ts';

const NISHA = 'mem_nisha0000000000000000';
const ARJUN = 'mem_arjun0000000000000000';

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, '/api/v1/app/branches', 'POST', { error });

const validation = (field: string, message: string) =>
  refusal(400, { type: 'validation_error', errors: [{ field, message }] });

/** A new branch, Vesu, filled in as the drawer would. */
const newVesu = (patch: Partial<BranchFormValues> = {}): BranchFormValues => ({
  ...emptyBranchForm({
    branchCount: 2,
    main: { city: 'Surat', state: 'Gujarat' },
    selfMembershipId: NISHA,
  }),
  name: '  Vesu ',
  addressLine1: '12, Ocean Arcade',
  area: 'Vesu',
  pin: '395007',
  phone: '9876543210',
  email: 'vesu@clinic.com',
  ...patch,
});

describe('useBranchSave — the branch drawer’s save', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    branch = null,
    values,
    before = [],
  }: {
    branch?: AppBranch | null;
    values: BranchFormValues;
    before?: string[];
  }) {
    const onStep = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<BranchFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useBranchSave({
            form,
            branch,
            before,
            members: [],
            presetOf: () => null,
            onStep,
            onDone,
          }),
        };
      },
      { wrapper },
    );
    return { ...view, onStep, onDone };
  }

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const method of ['post', 'patch', 'put'] as const)
      vi.mocked(api[method]).mockReset();
    vi.mocked(api.put).mockResolvedValue({ data: undefined } as never);
    for (const fn of Object.values(notifyMock)) fn.mockReset();
  });
  afterEach(() => client.clear());

  describe('checks before anything is sent', () => {
    it('asks for a six-digit PIN on the first step', async () => {
      const { result, onStep } = render({ values: newVesu({ pin: '3950' }) });
      await act(() => result.current.drawer.save());
      expect(result.current.form.getFieldState('pin').error?.message).toBe(
        'PIN code needs 6 digits',
      );
      expect(onStep).toHaveBeenCalledWith('place');
      expect(notifyMock.warning).toHaveBeenCalledWith('PIN code needs 6 digits');
    });

    it('asks for a ten-digit phone, then an email that reads as one, on Contact', async () => {
      const shortPhone = render({ values: newVesu({ phone: '98765' }) });
      await act(() => shortPhone.result.current.drawer.save());
      expect(shortPhone.onStep).toHaveBeenCalledWith('contact');
      expect(notifyMock.warning).toHaveBeenLastCalledWith('Phone needs 10 digits');

      const badEmail = render({ values: newVesu({ email: 'vesu@' }) });
      await act(() => badEmail.result.current.drawer.save());
      expect(badEmail.onStep).toHaveBeenCalledWith('contact');
      expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter a valid email address');

      expect(api.post).not.toHaveBeenCalled();
    });

    it('lets an empty PIN, phone and email through to the server', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: branchWireRow() } as never);
      const { result } = render({ values: newVesu({ pin: '', phone: '', email: '' }) });
      await act(() => result.current.drawer.save());
      expect(notifyMock.warning).not.toHaveBeenCalled();
      expect(api.post).toHaveBeenCalledOnce();
    });
  });

  describe('the write', () => {
    it('adds a new branch with its team in one POST, under an idempotency key', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: branchWireRow() } as never);
      const { result, onDone } = render({ values: newVesu({ teamIds: [NISHA, ARJUN] }) });

      await act(() => result.current.drawer.save());

      expect(api.post).toHaveBeenCalledWith('/app/branches', {
        body: expect.objectContaining({
          name: 'Vesu',
          postal_code: '395007',
          phone: '+919876543210',
          is_active: true,
          membership_ids: [NISHA, ARJUN],
        }),
        idempotencyKey: expect.any(String),
      });
      expect(api.put).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith({ kind: 'added', name: 'Vesu' });
    });

    it('saves an edit with the read’s updated_at — the team untouched, so not written', async () => {
      const branch = appBranch();
      vi.mocked(api.patch).mockResolvedValue({
        data: branchWireRow({ name: 'Vesu West' }),
      } as never);
      const { result, onDone } = render({
        branch,
        values: { ...branchFormOf(branch, [NISHA]), name: 'Vesu West' },
        before: [NISHA],
      });

      await act(() => result.current.drawer.save());

      expect(api.put).not.toHaveBeenCalled();
      expect(api.patch).toHaveBeenCalledWith('/app/branches/{branch_id}', {
        params: { branch_id: TEST_BRANCH_ID },
        body: expect.objectContaining({
          name: 'Vesu West',
          expected_updated_at: '2026-09-02T05:00:00.000Z',
        }),
        idempotencyKey: expect.any(String),
      });
      expect(onDone).toHaveBeenCalledWith({ kind: 'saved', name: 'Vesu West' });
    });

    it('writes a changed team first — the whole set — then the branch', async () => {
      const branch = appBranch();
      vi.mocked(api.patch).mockResolvedValue({ data: branchWireRow() } as never);
      const { result } = render({
        branch,
        values: branchFormOf(branch, [ARJUN]),
        before: [NISHA],
      });

      await act(() => result.current.drawer.save());

      expect(api.put).toHaveBeenCalledWith('/app/branches/{branch_id}/members', {
        params: { branch_id: TEST_BRANCH_ID },
        body: { membership_ids: [ARJUN] },
      });
      const putOrder = vi.mocked(api.put).mock.invocationCallOrder[0] ?? 0;
      const patchOrder = vi.mocked(api.patch).mock.invocationCallOrder[0] ?? 0;
      expect(putOrder).toBeLessThan(patchOrder);
    });
  });

  describe('the server’s answers', () => {
    it('outlines Name for a name another branch has — clinozy-be gives no reason for it', async () => {
      vi.mocked(api.post).mockRejectedValue(
        refusal(409, { type: 'conflict', detail: 'Branch name already exists' }),
      );
      const { result, onStep, onDone } = render({ values: newVesu() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('name').error?.message).toBe(
        'A branch called Vesu already exists',
      );
      expect(onStep).toHaveBeenCalledWith('place');
      expect(notifyMock.warning).toHaveBeenCalledWith(
        'A branch called Vesu already exists',
      );
      expect(onDone).not.toHaveBeenCalled();
    });

    it('says another conflict in the server’s words, blaming no field', async () => {
      vi.mocked(api.post).mockRejectedValue(
        refusal(409, {
          reason: 'branch_limit_reached',
          detail: 'Your plan allows 3 branches',
        }),
      );
      const { result, onStep } = render({ values: newVesu() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('name').error).toBeUndefined();
      expect(onStep).not.toHaveBeenCalled();
      expect(notifyMock.warning).toHaveBeenCalledOnce();
    });

    it('offers Reload for a stale save, which reads every branch again', async () => {
      const branch = appBranch();
      vi.mocked(api.patch).mockRejectedValue(
        refusal(409, { reason: 'record_changed', detail: 'Changed by usr_x' }),
      );
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const { result } = render({ branch, values: branchFormOf(branch, []) });

      await act(() => result.current.drawer.save());

      const [message, options] = notifyMock.error.mock.lastCall as [
        string,
        { id: string; action: { label: string; onClick: () => void } },
      ];
      expect(message).toBe(
        'Someone else saved this meanwhile. Reload to see their changes, then make yours again.',
      );
      expect(options.id).toBe('branch-save-failed');
      expect(options.action.label).toBe('Reload');
      invalidate.mockClear();
      options.action.onClick();
      expect(invalidate).toHaveBeenCalledWith({ queryKey: branchQueryKeys.all });
    });

    it('opens the step of a field the server refused — the hours on Contact', async () => {
      vi.mocked(api.post).mockRejectedValue(
        validation('body.closes_at', 'Closes before it opens'),
      );
      const { result, onStep } = render({ values: newVesu() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('closesAt').error?.message).toBe(
        'Closes before it opens',
      );
      expect(onStep).toHaveBeenCalledWith('contact');
      expect(notifyMock.error).toHaveBeenCalledWith('Closes before it opens');
    });

    it('puts a refused PIN code on PIN and opens Place', async () => {
      vi.mocked(api.post).mockRejectedValue(
        validation('body.postal_code', 'Not an Indian PIN code'),
      );
      const { result, onStep } = render({ values: newVesu() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('pin').error?.message).toBe(
        'Not an Indian PIN code',
      );
      expect(onStep).toHaveBeenCalledWith('place');
    });

    it('puts a refused team on Team and opens People', async () => {
      vi.mocked(api.post).mockRejectedValue(
        validation('body.membership_ids', 'Arjun is suspended'),
      );
      const { result, onStep } = render({ values: newVesu({ teamIds: [ARJUN] }) });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('teamIds').error?.message).toBe(
        'Arjun is suspended',
      );
      expect(onStep).toHaveBeenCalledWith('people');
    });
  });
});
