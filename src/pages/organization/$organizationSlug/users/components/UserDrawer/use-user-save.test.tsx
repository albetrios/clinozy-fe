import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

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

import { useUserSave } from './use-user-save.ts';
import { emptyUserForm, userFormOf, type UserFormValues } from './user-form.ts';

const DESK = 'rol_desk00000000000000000';
const DOCTOR = 'rol_doctor000000000000000';
const VESU = 'brn_vesu00000000000000000';
const MEMBERSHIP_ID = 'mem_riya00000000000000000';
const MEMBERSHIPS = '/tenancy/organization/memberships';

/** Riya, Front desk at Vesu, as the Team reads her. */
const riya = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  membershipId: MEMBERSHIP_ID,
  userId: 'usr_riya',
  email: 'riya@cresence.skin',
  status: 'active',
  invitation: null,
  joinedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-05T10:00:00.000Z',
  isOwner: false,
  isSelf: false,
  name: 'Riya Shah',
  initials: 'RS',
  tone: 'mint',
  roleIds: [DESK],
  seq: 12,
  phone: '+919825044120',
  branchIds: [VESU],
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  startsAt: '10:00',
  endsAt: '19:00',
  commissionPercent: 2.5,
  ...overrides,
});

/** A membership as clinozy-be answers a write. */
const membershipWire = (patch: Record<string, unknown> = {}) => ({
  id: MEMBERSHIP_ID,
  user_id: 'usr_riya',
  organization_id: 'org_test',
  status: 'invited',
  is_owner: false,
  joined_at: null,
  created_at: '2026-10-12T05:00:00.000Z',
  updated_at: '2026-10-12T05:00:00.000Z',
  display_name: 'neha@cresence.skin',
  ended_at: null,
  end_reason: null,
  user: {
    id: 'usr_riya',
    email: 'neha@cresence.skin',
    first_name: null,
    last_name: null,
    avatar_url: null,
  },
  invitation: { id: 'inv_neha00000000000000000', expires_at: '2026-10-19T05:00:00.000Z' },
  staff_number: 13,
  phone: null,
  tone: 'sky',
  role_ids: [DESK],
  branch_ids: [VESU],
  working_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  work_starts_at: '10:00',
  work_ends_at: '19:00',
  commission_percent: 0,
  ...patch,
});

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, `/api/v1${MEMBERSHIPS}`, 'POST', { error });

const validation = (field: string, message: string) =>
  refusal(400, { type: 'validation_error', errors: [{ field, message }] });

describe('useUserSave — the user drawer’s writes', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    member = null,
    values,
    singleBranchId = null,
  }: {
    member?: TeamMember | null;
    values: UserFormValues;
    singleBranchId?: string | null;
  }) {
    const onStep = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<UserFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useUserSave({ form, member, singleBranchId, onStep, onDone }),
        };
      },
      { wrapper },
    );
    return { ...view, onStep, onDone };
  }

  /** A new user: Neha, Front desk at Vesu, the email typed with spaces. */
  const newUser = (patch: Partial<UserFormValues> = {}): UserFormValues => ({
    ...emptyUserForm(VESU, DESK),
    email: ' neha@cresence.skin ',
    ...patch,
  });

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
    for (const fn of Object.values(notifyMock)) fn.mockReset();
  });
  afterEach(() => client.clear());

  describe('checks before anything is sent', () => {
    it('asks for a role, then an email that reads as one, then a ten-digit mobile', async () => {
      const noRole = render({ values: newUser({ roleIds: [] }) });
      await act(() => noRole.result.current.drawer.save());
      expect(noRole.onStep).toHaveBeenLastCalledWith('profile');
      expect(noRole.result.current.form.getFieldState('roleIds').error).toBeDefined();

      const badEmail = render({ values: newUser({ email: 'neha@' }) });
      await act(() => badEmail.result.current.drawer.save());
      expect(badEmail.result.current.form.getFieldState('email').error).toBeDefined();

      const shortMobile = render({ values: newUser({ phone: '98250' }) });
      await act(() => shortMobile.result.current.drawer.save());
      expect(shortMobile.result.current.form.getFieldState('phone').error).toBeDefined();

      expect(notifyMock.warning).toHaveBeenCalledTimes(3);
      expect(api.post).not.toHaveBeenCalled();
      expect(api.patch).not.toHaveBeenCalled();
    });
  });

  describe('a new user', () => {
    it('invites them in one call — the email trimmed, the only open branch — under one key', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: membershipWire() } as never);
      const { result, onDone } = render({
        values: newUser({ branchIds: [], phone: '9825044999', commissionPct: 0 }),
        singleBranchId: VESU,
      });

      await act(() => result.current.drawer.save());

      expect(api.post).toHaveBeenCalledWith(MEMBERSHIPS, {
        body: {
          email: 'neha@cresence.skin',
          role_ids: [DESK],
          phone: '+919825044999',
          tone: 'sky',
          branch_ids: [VESU],
          working_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
          work_starts_at: '10:00',
          work_ends_at: '19:00',
          commission_percent: 0,
        },
        idempotencyKey: expect.any(String),
      });
      // The invitee is named by their email until they set a name.
      expect(onDone).toHaveBeenCalledWith(
        { kind: 'added', name: 'neha@cresence.skin' },
        false,
      );
      // One toast for the whole save is the drawer's: the write itself says nothing.
      expect(notifyMock.success).not.toHaveBeenCalled();
    });

    it('sends no mobile for an empty one', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: membershipWire() } as never);
      const { result } = render({ values: newUser({ phone: '' }) });

      await act(() => result.current.drawer.save());

      const [, init] = vi.mocked(api.post).mock.lastCall as unknown as [
        string,
        { body: Record<string, unknown> },
      ];
      expect(init.body.phone).toBeNull();
    });

    it('outlines Email when they are already in the clinic, and opens Profile', async () => {
      vi.mocked(api.post).mockRejectedValue(
        refusal(409, {
          type: 'conflict',
          reason: 'membership_already_exists',
          detail: 'neha@cresence.skin is already a member',
        }),
      );
      const { result, onStep, onDone } = render({ values: newUser() });

      await act(() => result.current.drawer.save());

      // In our own words, on the field and in the toast.
      expect(result.current.form.getFieldState('email').error?.message).toBe(
        'This person is already in the clinic.',
      );
      expect(onStep).toHaveBeenCalledWith('profile');
      expect(notifyMock.warning).toHaveBeenCalledWith(
        'This person is already in the clinic.',
      );
      expect(onDone).not.toHaveBeenCalled();
    });

    it('blames no field for another conflict — a full plan is not the email’s fault', async () => {
      vi.mocked(api.post).mockRejectedValue(
        refusal(409, {
          type: 'conflict',
          reason: 'seat_limit_reached',
          detail: 'Your plan has no seats left',
        }),
      );
      const { result, onStep } = render({ values: newUser() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('email').error).toBeUndefined();
      expect(onStep).not.toHaveBeenCalled();
      expect(notifyMock.warning).toHaveBeenCalledWith(
        'Your plan has no free seat. Add a seat in Settings › Billing, then invite again.',
      );
    });
  });

  describe('an edit', () => {
    it('sends nothing when nothing changed, and still reports the member saved', async () => {
      const member = riya();
      const { result, onDone } = render({ member, values: userFormOf(member) });

      await act(() => result.current.drawer.save());

      expect(api.patch).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith({ kind: 'saved', name: 'Riya Shah' }, false);
    });

    it('PATCHes only what changed, with the read’s updated_at', async () => {
      vi.mocked(api.patch).mockResolvedValue({
        data: membershipWire({ status: 'active', role_ids: [DESK, DOCTOR] }),
      } as never);
      const member = riya();
      const { result, onDone } = render({
        member,
        values: { ...userFormOf(member), roleIds: [DESK, DOCTOR], commissionPct: 5 },
      });

      await act(() => result.current.drawer.save());

      expect(api.patch).toHaveBeenCalledWith(`${MEMBERSHIPS}/{membership_id}`, {
        params: { membership_id: MEMBERSHIP_ID },
        body: expect.objectContaining({
          role_ids: [DESK, DOCTOR],
          commission_percent: 5,
          expected_updated_at: '2026-09-05T10:00:00.000Z',
        }),
        idempotencyKey: expect.any(String),
      });
      const [, init] = vi.mocked(api.patch).mock.lastCall as unknown as [
        string,
        { body: Record<string, unknown> },
      ];
      expect(init.body.phone).toBeUndefined();
      expect(init.body.work_starts_at).toBeUndefined();
      expect(onDone).toHaveBeenCalledWith({ kind: 'saved', name: 'Riya Shah' }, false);
    });

    it('says a stale save in our own words', async () => {
      vi.mocked(api.patch).mockRejectedValue(
        refusal(409, {
          reason: 'record_changed',
          detail: 'Changed by usr_x at 2026-10-12T05:00:00.000Z',
        }),
      );
      const member = riya();
      const { result } = render({
        member,
        values: { ...userFormOf(member), tone: 'butter' },
      });

      await act(() => result.current.drawer.save());

      expect(notifyMock.error).toHaveBeenCalledWith(
        'Someone else saved this meanwhile. Reload to see their changes, then make yours again.',
        { id: 'user-save-failed' },
      );
      expect(result.current.drawer.saveState).toBe('idle');
    });
  });

  describe('a field the server refuses', () => {
    it('puts a refused role on Roles and opens Profile', async () => {
      vi.mocked(api.post).mockRejectedValue(
        validation('body.role_ids', 'Owner cannot be given'),
      );
      const { result, onStep } = render({ values: newUser() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('roleIds').error?.message).toBe(
        'Owner cannot be given',
      );
      expect(onStep).toHaveBeenCalledWith('profile');
    });

    it('puts a refused status on the Active switch and opens Hours', async () => {
      const member = riya();
      vi.mocked(api.patch).mockRejectedValue(
        validation('body.status', 'You cannot suspend yourself'),
      );
      const { result, onStep } = render({
        member,
        values: { ...userFormOf(member), active: false },
      });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('active').error?.message).toBe(
        'You cannot suspend yourself',
      );
      expect(onStep).toHaveBeenCalledWith('hours');
    });

    it('puts a refused start time on Starts at and opens Hours', async () => {
      vi.mocked(api.post).mockRejectedValue(
        validation('body.work_starts_at', 'Use HH:MM'),
      );
      const { result, onStep } = render({ values: newUser() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('startsAt').error?.message).toBe(
        'Use HH:MM',
      );
      expect(onStep).toHaveBeenCalledWith('hours');
    });

    it('puts a refused commission on Commission and opens Hours', async () => {
      vi.mocked(api.post).mockRejectedValue(
        validation('body.commission_percent', 'At most 100'),
      );
      const { result, onStep } = render({ values: newUser({ commissionPct: 150 }) });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('commissionPct').error?.message).toBe(
        'At most 100',
      );
      expect(onStep).toHaveBeenCalledWith('hours');
    });
  });
});
