import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { servedTone } from '@/shared/clinic/clinic-tones.ts';

import { branchQueryKeys } from './branches-api.ts';
import type { BranchInput, BranchSave, ClinicBranch } from './branches-contracts.ts';
import { clockTimeSchema, weekdaySchema } from './clinic-schema.ts';

/*
 * Users › Branches' reads and writes on clinozy-be (KICKOFF §6.12 Branches, D6): every branch,
 * open and closed (`GET /app/branches?include_inactive=true`), a new one (`POST`, its team in the
 * same call), an edit (`PATCH`, closing one included — there is no delete) and who works there
 * (`PUT …/members`, the whole set). Kept apart from `branches-api.ts`, which the shell's branch
 * picker loads on every page: these load with the room.
 */

/** The Branches tab's list key — under `branchQueryKeys.all`, so a write refreshes the picker too. */
export const branchListKey = () => [...branchQueryKeys.all, 'list'] as const;

type ApiBranch = NonNullable<ApiData<'/app/branches/{branch_id}', 'get'>>;

const branchWire = wireSchema<ApiBranch>()(
  z.object({
    id: z.string(),
    name: z.string(),
    tone: z.string(),
    is_main: z.boolean(),
    is_active: z.boolean(),
    address_line_one: z.string(),
    address_line_two: z.string().nullable(),
    area: z.string(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    phone: z.string(),
    email: z.string(),
    gst_number: z.string().nullable(),
    opens_at: clockTimeSchema,
    closes_at: clockTimeSchema,
    working_days: z.array(weekdaySchema),
    default_doctor_membership_id: z.string().nullable(),
    default_front_desk_membership_id: z.string().nullable(),
    default_therapist_membership_id: z.string().nullable(),
    default_pharmacist_membership_id: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** A wire branch as the room reads it. */
function toClinicBranch(row: z.output<typeof branchWire>): ClinicBranch {
  return {
    id: row.id,
    name: row.name,
    tone: servedTone(row.tone, row.name),
    isMain: row.is_main,
    active: row.is_active,
    addressLine1: row.address_line_one,
    addressLine2: row.address_line_two,
    area: row.area,
    city: row.city,
    state: row.state,
    pin: row.postal_code,
    phone: row.phone,
    email: row.email,
    gstNumber: row.gst_number,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    workingDays: row.working_days,
    defaultDoctorId: row.default_doctor_membership_id,
    defaultDeskId: row.default_front_desk_membership_id,
    defaultTherapistId: row.default_therapist_membership_id,
    defaultPharmacistId: row.default_pharmacist_membership_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The branches' order (`users.md:87`): the main branch first, then as they were opened. */
function byMainThenOpened(a: ClinicBranch, b: ClinicBranch): number {
  return Number(b.isMain) - Number(a.isMain) || a.createdAt.localeCompare(b.createdAt);
}

/**
 * Every branch, open and closed — the Branches tab lists the closed ones as "Closed"
 * (`users.md:95`) — the main branch first, then as they were opened. One answer (no paging).
 */
export async function fetchBranches(): Promise<ClinicBranch[]> {
  const response = await api.get('/app/branches', {
    query: { include_inactive: 'true' },
  });
  return z
    .array(branchWire)
    .parse(response.data ?? [])
    .map(toClinicBranch)
    .sort(byMainThenOpened);
}

/** A save's fields on the wire. */
function branchBody(input: BranchInput) {
  return {
    name: input.name,
    tone: input.tone,
    is_active: input.active,
    address_line_one: input.addressLine1,
    address_line_two: input.addressLine2,
    area: input.area,
    city: input.city,
    state: input.state || undefined,
    postal_code: input.pin,
    phone: input.phone,
    email: input.email,
    gst_number: input.gstNumber,
    working_days: input.workingDays,
    opens_at: input.opensAt,
    closes_at: input.closesAt,
    default_doctor_membership_id: input.defaultDoctorId,
    default_front_desk_membership_id: input.defaultDeskId,
    default_therapist_membership_id: input.defaultTherapistId,
    default_pharmacist_membership_id: input.defaultPharmacistId,
  };
}

/** Who works at a branch now: the whole set (`PUT …/branches/:id/members`, `branch:update`). */
export async function replaceBranchMembers(
  branchId: string,
  membershipIds: readonly string[],
): Promise<void> {
  await api.put('/app/branches/{branch_id}/members', {
    params: { branch_id: branchId },
    body: { membership_ids: [...membershipIds] },
  });
}

/**
 * Save a branch (`users.md:179–198`; H:5220–5222). A new one is one `POST` (`branch:create`) with
 * its team; an edit writes its team first when it changed — a default must work at the branch,
 * and clinozy-be clears a default who no longer does — then its fields (`PATCH`, `branch:update`,
 * with `expected_updated_at`: `409 record_changed` when someone saved first). A name another
 * branch has is a 409 (`branchNameExists`); a broken rule a 400 naming its field.
 */
export async function saveBranch({
  save: { branch, input, memberIds, memberIdsBefore },
  idempotencyKey,
}: {
  save: BranchSave;
  idempotencyKey?: string;
}): Promise<ClinicBranch> {
  if (!branch) {
    const response = await api.post('/app/branches', {
      body: { ...branchBody(input), membership_ids: [...memberIds] },
      idempotencyKey,
    });
    return toClinicBranch(branchWire.parse(response.data));
  }
  const before = new Set(memberIdsBefore ?? []);
  const changed =
    memberIds.length !== before.size || memberIds.some((id) => !before.has(id));
  if (changed) await replaceBranchMembers(branch.id, memberIds);
  const response = await api.patch('/app/branches/{branch_id}', {
    params: { branch_id: branch.id },
    body: { ...branchBody(input), expected_updated_at: branch.updatedAt },
    idempotencyKey,
  });
  return toClinicBranch(branchWire.parse(response.data));
}
