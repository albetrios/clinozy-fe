import { z } from 'zod';

/**
 * Organization-scoped permission codes, mirroring clinozy-be's permission catalog
 * (`GET /tenancy/permissions`, by category — 85 codes at the clinic launch API, all of them
 * an Owner's): the platform's and the clinic's per-resource codes (`lead:read`, `payment:create`,
 * `offering:lower_price:read`, `patient:clinical_record:read`, …).
 *
 * These are granted to a user by their membership/role **within a specific
 * organization** and are resolved server-side. The client mirrors them only to
 * drive UX (hiding/disabling actions, gating routes) — never as the security
 * boundary. The backend always re-checks.
 *
 * Lives in `core/types/` (not `core/rbac/`) so the `lib` layer — e.g. the
 * route-island page manifest — can reference the permission type without
 * importing the RBAC engine (see fe-file-structure.mdc → Import Rules).
 */
export const organizationPermissionSchema = z.enum([
  // activity
  'contact_activity:create',
  'contact_activity:delete',
  'contact_activity:read',
  'contact_activity:update',
  // appointments
  'appointment:create',
  'appointment:delete',
  'appointment:export',
  'appointment:read',
  'appointment:update',
  // audit
  'audit-log:read',
  // billing
  'subscription:manage',
  'subscription:read',
  // contacts
  'contact:create',
  'contact:delete',
  'contact:read',
  'contact:update',
  // leads
  'lead:create',
  'lead:delete',
  'lead:export',
  'lead:read',
  'lead:update',
  // medical
  'medicine:create',
  'medicine:delete',
  'medicine:export',
  'medicine:read',
  'medicine:update',
  // notify
  'webhook:manage',
  'webhook:read',
  // offerings
  'offering:create',
  'offering:delete',
  'offering:export',
  'offering:lower_price:read',
  'offering:update',
  // patients
  'patient:clinical_record:read',
  'patient:create',
  'patient:delete',
  'patient:export',
  'patient:private_album:read',
  'patient:read',
  'patient:update',
  'patient_prescription:create',
  'patient_prescription:delete',
  'patient_prescription:read',
  'patient_prescription:update',
  // reviews — their own codes, so Marketing logs reviews (clinozy-be D83 (4))
  'patient_review:create',
  'patient_review:delete',
  'patient_review:update',
  'patient_treatment:create',
  'patient_treatment:read',
  'patient_treatment:update',
  // payments
  'payment:create',
  'payment:delete',
  'payment:export',
  'payment:read',
  'payment:update',
  // stock
  'stock_item:create',
  'stock_item:delete',
  'stock_item:export',
  'stock_item:read',
  'stock_item:update',
  // tasks
  'task:create',
  'task:delete',
  'task:export',
  'task:read',
  'task:update',
  // tenancy
  'api-key:manage',
  'api-key:read',
  'notification-policy:manage',
  'notification-policy:read',
  'organization:delete',
  'organization:read',
  'organization:update',
  // upload
  'upload:manage',
  // users
  'branch:create',
  'branch:delete',
  'branch:read',
  'branch:update',
  'membership:create',
  'membership:delete',
  'membership:read',
  'membership:update',
  'role:create',
  'role:delete',
  'role:read',
  'role:update',
]);

export type OrganizationPermission = z.infer<typeof organizationPermissionSchema>;
