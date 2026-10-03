import { describe, expect, it } from 'vitest';

import { CLINIC_SECTION_ORDER } from '@/shared/clinic/clinic-sections.ts';

import {
  CLINIC_ROLE_CATALOG,
  CLINIC_ROLE_PLATFORM_NAMES,
  clinicRoleKeySchema,
  clinicRolePermissionSchema,
  CUSTOM_ROLE_TONES,
  isPresetRole,
  MATRIX_SECTIONS,
  matrixGrantsSchema,
  NO_GRANTS,
} from './access-contracts.ts';
import { ROLE_VALUES } from './clinic-schema.ts';

describe('the access contracts', () => {
  it('rows the matrix in nav order, without Today', () => {
    expect(MATRIX_SECTIONS).toEqual(
      CLINIC_SECTION_ORDER.filter((section) => section !== 'today'),
    );
  });

  it('lists the seven design roles and Marketing, never Owner (Q-U2)', () => {
    expect(CLINIC_ROLE_CATALOG).toEqual([
      'admin',
      'doctor',
      'therapist',
      'front_desk',
      'counsellor',
      'pharmacist',
      'accountant',
      'marketing',
    ]);
  });

  it('names every contract role the way clinozy-be does, each name once', () => {
    expect(Object.keys(CLINIC_ROLE_PLATFORM_NAMES).sort()).toEqual(
      [...ROLE_VALUES].sort(),
    );
    const names = Object.values(CLINIC_ROLE_PLATFORM_NAMES).map((name) =>
      name.toLowerCase(),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('cycles custom roles through the design’s six tones (H:5187)', () => {
    expect(CUSTOM_ROLE_TONES).toEqual(['plum', 'lime', 'mint', 'sky', 'peach', 'lav']);
  });

  it('keys a role by its contract value or its clinozy-be id', () => {
    expect(clinicRoleKeySchema.safeParse('front_desk').success).toBe(true);
    expect(clinicRoleKeySchema.safeParse('rol_abcdefghijklmnopqrstu').success).toBe(true);
    expect(clinicRoleKeySchema.safeParse('frontdesk').success).toBe(false);
    expect(clinicRoleKeySchema.safeParse('rol_short').success).toBe(false);
    expect(isPresetRole('pharmacist')).toBe(true);
    expect(isPresetRole('rol_abcdefghijklmnopqrstu')).toBe(false);
  });

  it('carries a custom role’s matrix row and a role’s nine sections', () => {
    const row = {
      id: '00000000-0000-4000-8000-000000000001',
      organizationId: '00000000-0000-4000-8000-000000000002',
      createdAt: '2026-10-03T04:30:00.000Z',
      updatedAt: '2026-10-03T04:30:00.000Z',
      createdById: '00000000-0000-4000-8000-000000000003',
      deletedAt: null,
      deleteReason: null,
      deleteNote: null,
      role: 'rol_abcdefghijklmnopqrstu',
      section: 'leads',
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    };
    expect(clinicRolePermissionSchema.parse(row)).toEqual(row);
    const grants = Object.fromEntries(MATRIX_SECTIONS.map((s) => [s, NO_GRANTS]));
    expect(matrixGrantsSchema.safeParse(grants).success).toBe(true);
    expect(matrixGrantsSchema.safeParse({ leads: NO_GRANTS }).success).toBe(false);
  });
});
