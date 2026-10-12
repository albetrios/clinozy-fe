import { describe, expect, it } from 'vitest';

import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';

import { USERS_KEYS } from '../../../users.constants.ts';
import {
  MATRIX_CELL_KEYS,
  MATRIX_HEAD_KEYS,
  roleHolders,
  rolePurposeKey,
  selectedRoleOf,
} from './roles-access.ts';

const role = (id: string, name: string, isSystem = true): RoleSummary => ({
  id,
  name,
  description: '',
  permissions: [],
  memberCount: 0,
  isSystem,
  isLocked: false,
  tone: 'sky',
  updatedAt: '2026-10-01T05:00:00.000Z',
});

const DOCTOR = role('rol_doctor', 'Doctor');
const DESK = role('rol_desk', 'Front desk');
const CUSTOM = role('rol_custom', 'Laser lead', false);
/** A custom role named like a preset is still a custom role. */
const IMPOSTOR = role('rol_impostor', 'Front desk', false);

describe('selectedRoleOf — the role on screen', () => {
  it('opens the role the URL names when it is listed', () => {
    expect(selectedRoleOf([DOCTOR, DESK, CUSTOM], 'rol_custom')).toBe(CUSTOM);
  });

  it('opens Front desk when the URL names none, or a role that is gone', () => {
    expect(selectedRoleOf([DOCTOR, DESK], undefined)).toBe(DESK);
    expect(selectedRoleOf([DOCTOR, DESK], 'rol_deleted')).toBe(DESK);
  });

  it('takes the preset Front desk — never a custom role that borrowed its name', () => {
    expect(selectedRoleOf([IMPOSTOR, DOCTOR, DESK], undefined)).toBe(DESK);
  });

  it('opens the first role without a Front desk, and none for an empty list', () => {
    expect(selectedRoleOf([CUSTOM, DOCTOR], undefined)).toBe(CUSTOM);
    expect(selectedRoleOf([], 'rol_custom')).toBeNull();
  });
});

describe('rolePurposeKey — a role’s purpose line', () => {
  it('names a preset by its own purpose', () => {
    expect(rolePurposeKey(DOCTOR)).toBe(USERS_KEYS.roles.purposes.doctor);
    expect(rolePurposeKey(DESK, true)).toBe(USERS_KEYS.roles.purposes.front_desk);
  });

  it('reads "Custom role" for the rest — the page’s longer line on a role’s page', () => {
    expect(rolePurposeKey(CUSTOM)).toBe(USERS_KEYS.roles.purposes.custom);
    expect(rolePurposeKey(CUSTOM, true)).toBe(USERS_KEYS.roles.purposes.customPage);
    expect(rolePurposeKey(IMPOSTOR)).toBe(USERS_KEYS.roles.purposes.custom);
  });

  it('gives Owner no purpose of its own — it is never listed', () => {
    expect(rolePurposeKey(role('rol_owner', 'Owner'))).toBe(
      USERS_KEYS.roles.purposes.custom,
    );
  });
});

describe('roleHolders', () => {
  const member = (membershipId: string, roleIds: string[]) =>
    ({ membershipId, roleIds }) as Pick<TeamMember, 'membershipId' | 'roleIds'>;

  it('lists the members holding a role in the Team’s order, a second role included', () => {
    const team = [
      member('mem_a', ['rol_desk']),
      member('mem_b', ['rol_doctor', 'rol_desk']),
      member('mem_c', ['rol_doctor']),
    ] as TeamMember[];
    expect(roleHolders('rol_desk', team).map((holder) => holder.membershipId)).toEqual([
      'mem_a',
      'mem_b',
    ]);
    expect(roleHolders('rol_custom', team)).toEqual([]);
    expect(roleHolders('rol_desk', [])).toEqual([]);
  });
});

describe('the matrix’s labels', () => {
  it('names each of the four actions for the head and for each box', () => {
    for (const keys of [MATRIX_CELL_KEYS, MATRIX_HEAD_KEYS]) {
      expect(Object.keys(keys).sort()).toEqual(['create', 'delete', 'edit', 'view']);
    }
    expect(MATRIX_CELL_KEYS.view).not.toBe(MATRIX_HEAD_KEYS.view);
  });
});
