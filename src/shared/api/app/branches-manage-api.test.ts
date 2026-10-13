import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}));
import { api } from '@/core/http/api.ts';
import {
  appBranch,
  branchWireRow,
  TEST_BRANCH_ID,
} from '@/tests/utils/branch-doubles.ts';

import type { BranchInput } from './branches-contracts.ts';
import {
  fetchBranches,
  replaceBranchMembers,
  saveBranch,
} from './branches-manage-api.ts';

const KEY = 'key-branch-test';
const ME = 'mem_me0000000000000000000';
const RIYA = 'mem_riya00000000000000000';

/** A branch's fields as the drawer sends them. */
const input = (patch: Partial<BranchInput> = {}): BranchInput => ({
  name: 'Vesu',
  tone: 'lav',
  active: true,
  addressLine1: '12, Ocean Arcade',
  addressLine2: null,
  area: 'Vesu',
  city: 'Surat',
  state: '',
  pin: '395007',
  phone: '+919876543210',
  email: 'vesu@clinic.com',
  gstNumber: null,
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  opensAt: '10:00',
  closesAt: '19:00',
  defaultDoctorId: ME,
  defaultDeskId: null,
  defaultTherapistId: null,
  defaultPharmacistId: null,
  ...patch,
});

beforeEach(() => {
  for (const fn of Object.values(api)) vi.mocked(fn).mockReset();
  vi.mocked(api.post).mockResolvedValue({ data: branchWireRow() } as never);
  vi.mocked(api.patch).mockResolvedValue({ data: branchWireRow() } as never);
  vi.mocked(api.put).mockResolvedValue({ data: [] } as never);
});

describe('fetchBranches', () => {
  it('reads every branch, closed ones too — the main branch first, then as opened', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        branchWireRow({
          id: 'brn_b',
          name: 'Varachha',
          created_at: '2026-09-03T00:00:00Z',
        }),
        branchWireRow({ is_active: false }),
        branchWireRow({ id: 'brn_a', name: 'Adajan', is_main: true }),
      ],
    } as never);
    const branches = await fetchBranches();
    expect(branches.map((branch) => [branch.name, branch.active])).toEqual([
      ['Adajan', true],
      ['Vesu', false],
      ['Varachha', true],
    ]);
    expect(api.get).toHaveBeenCalledWith('/app/branches', {
      query: { include_inactive: 'true' },
    });
    expect(branches[1]).toEqual(appBranch({ active: false }));
  });
});

describe('saveBranch', () => {
  it('adds a branch in one call, its team with it', async () => {
    const saved = await saveBranch({
      save: { input: input(), memberIds: [ME, RIYA] },
      idempotencyKey: KEY,
    });
    expect(saved).toEqual(appBranch());
    expect(api.post).toHaveBeenCalledWith('/app/branches', {
      body: expect.objectContaining({
        name: 'Vesu',
        is_active: true,
        address_line_one: '12, Ocean Arcade',
        postal_code: '395007',
        phone: '+919876543210',
        default_doctor_membership_id: ME,
        membership_ids: [ME, RIYA],
        state: undefined,
      }),
      idempotencyKey: KEY,
    });
    expect(api.put).not.toHaveBeenCalled();
  });

  it('writes an edit’s team first — a default must work there — then its fields, stale-checked', async () => {
    const branch = appBranch();
    await saveBranch({
      save: { branch, input: input(), memberIds: [ME, RIYA], memberIdsBefore: [RIYA] },
    });
    expect(api.put).toHaveBeenCalledWith('/app/branches/{branch_id}/members', {
      params: { branch_id: TEST_BRANCH_ID },
      body: { membership_ids: [ME, RIYA] },
    });
    expect(api.patch).toHaveBeenCalledWith('/app/branches/{branch_id}', {
      params: { branch_id: TEST_BRANCH_ID },
      body: expect.objectContaining({ expected_updated_at: branch.updatedAt }),
      idempotencyKey: undefined,
    });
    expect(vi.mocked(api.put).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.patch).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('leaves the team alone when it did not change', async () => {
    await saveBranch({
      save: {
        branch: appBranch(),
        input: input({ active: false }),
        memberIds: [RIYA, ME],
        memberIdsBefore: [ME, RIYA],
      },
    });
    expect(api.put).not.toHaveBeenCalled();
    expect(api.patch).toHaveBeenCalledWith(
      '/app/branches/{branch_id}',
      expect.objectContaining({ body: expect.objectContaining({ is_active: false }) }),
    );
  });

  it('names no team when none is given — a new branch gets its creator, an edit keeps its own', async () => {
    await saveBranch({ save: { input: input() }, idempotencyKey: KEY });
    const [, created] = vi.mocked(api.post).mock.calls[0] as [string, { body: object }];
    expect(created.body).not.toHaveProperty('membership_ids');

    await saveBranch({ save: { branch: appBranch(), input: input() } });
    expect(api.put).not.toHaveBeenCalled();
    expect(api.patch).toHaveBeenCalledTimes(1);
  });
});

describe('replaceBranchMembers', () => {
  it('puts the whole set', async () => {
    await replaceBranchMembers(TEST_BRANCH_ID, [RIYA]);
    expect(api.put).toHaveBeenCalledWith('/app/branches/{branch_id}/members', {
      params: { branch_id: TEST_BRANCH_ID },
      body: { membership_ids: [RIYA] },
    });
  });
});
