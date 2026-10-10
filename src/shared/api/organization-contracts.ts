import { z } from 'zod';

import {
  type OrganizationPermission,
  organizationPermissionSchema,
} from '@/core/types/permissions.ts';
import type { Tone, Weekday } from '@/shared/api/clinic/clinic-schema.ts';

/**
 * Organization domain types and runtime form schemas.
 *
 * The domain shapes of clinozy-be's memberships, invitations, roles and API keys. The wire
 * schemas and their mapping live in `@/shared/api/organization-api.ts`.
 */

export type MembershipStatus = 'active' | 'invited' | 'suspended';

/**
 * A membership of the active organization as clinozy-be keeps it — who the person is, their
 * roles (main first), the branches they work at, their hours and commission, and the live
 * invitation of an invited row. The staff profile lives on the membership: there is no other
 * record of a member's clinic details.
 */
export type Member = {
  /** The membership id (`mem_…`) — every member write and the invitation's resend and cancel act on it. */
  id: string;
  userId: string;
  /** The name the member set on their profile; an invitee's email until they set one. */
  name: string;
  email: string;
  status: MembershipStatus;
  /** Every role the member holds, the main role first (1–10 role ids). */
  roleIds: string[];
  /** The main role — `roleIds[0]`, or `''` for a row clinozy-be sent with none. */
  roleId: string;
  /** Whether this membership is the organization owner's — never edited, removed or suspended from here. */
  isOwner: boolean;
  /** ISO-8601 when they joined; `''` until an invitee accepts. */
  joinedAt: string;
  avatarUrl?: string;
  /**
   * The live invitation behind an `invited` row: its id and when its link expires. `null` for
   * everyone who has joined.
   */
  invitation: MemberInvitation | null;
  /** The clinic's running number for the member ("#12"). */
  staffNumber: number;
  /** `+91` and ten digits, or null. */
  phone: string | null;
  /** The member's colour — the palette's, else one hashed from the name. */
  tone: Tone;
  branchIds: string[];
  workingDays: Weekday[];
  /** `HH:MM`. */
  workStartsAt: string;
  /** `HH:MM`. */
  workEndsAt: string;
  /** 0–100, up to two decimals. */
  commissionPercent: number;
  /** When the membership was made — the invite, for a member who was invited. */
  createdAt: string;
  /** The read's `updated_at` — an edit sends it back as `expected_updated_at`. */
  updatedAt: string;
};

/** What an edit may change on a membership — any subset, each field as the membership names it. */
export type MemberChange = Partial<
  Pick<
    Member,
    | 'status'
    | 'roleIds'
    | 'phone'
    | 'tone'
    | 'branchIds'
    | 'workingDays'
    | 'workStartsAt'
    | 'workEndsAt'
    | 'commissionPercent'
  >
> & {
  /** The edited row's `updatedAt` — clinozy-be answers `409 record_changed` when it moved since. */
  expectedUpdatedAt?: string;
};

/** A new member: the invite's email and roles, and any clinic details known already. */
export type MemberInvite = Partial<
  Pick<
    Member,
    | 'phone'
    | 'tone'
    | 'branchIds'
    | 'workingDays'
    | 'workStartsAt'
    | 'workEndsAt'
    | 'commissionPercent'
  >
> & {
  email: string;
  /** 1–10 role ids, the main role first. */
  roleIds: string[];
  /** How long the link stays valid — clinozy-be's default when omitted (7 days). */
  expiresInDays?: number;
};

/** A pending invitation as the members list reports it. */
export type MemberInvitation = {
  id: string;
  /** ISO-8601. Past this the link no longer works; a resend sends a fresh one (an expired invitation too). */
  expiresAt: string;
};

/**
 * Whether an invitation's link has expired — the invitee can no longer use it until it is sent
 * again (the members panel and the Users room's Team and member drawer say so).
 */
export function isInvitationExpired(
  invitation: Pick<MemberInvitation, 'expiresAt'>,
  now: number = Date.now(),
): boolean {
  return Date.parse(invitation.expiresAt) <= now;
}

export type RoleSummary = {
  id: string;
  name: string;
  description: string;
  /**
   * Known codes only — `toOrganizationPermissions` drops anything this build does not model.
   * The roles list carries none (`[]`); `getRolePermissions` reads a role's set.
   */
  permissions: OrganizationPermission[];
  /** Active and invited memberships holding it. */
  memberCount: number;
  /** A preset the organization was provisioned with — never renamed or deleted. */
  isSystem: boolean;
  /** Whether its codes are fixed (Admin's): no change to its access is offered. */
  isLocked: boolean;
  /** The role's colour — the palette's, else one hashed from the name. */
  tone: Tone;
  /** The read's `updated_at` — an edit sends it back as `expected_updated_at`. */
  updatedAt: string;
};

/** The name clinozy-be gives the organization owner's preset role (preset names are fixed). */
const OWNER_ROLE_NAME = 'Owner';

/** Whether a role is the owner's preset — never given by an invite or an edit (one owner per organization). */
export function isOwnerRole(role: Pick<RoleSummary, 'name' | 'isSystem'>): boolean {
  return role.isSystem && role.name === OWNER_ROLE_NAME;
}

/** Whether an invite or a member edit may give this role — every role but the owner's. */
export function isInvitableRole(role: Pick<RoleSummary, 'name' | 'isSystem'>): boolean {
  return !isOwnerRole(role);
}

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
};

/**
 * API key returned immediately after creation. The full `secret` is shown to the
 * user exactly once and is never retrievable again (mirrors the backend contract).
 */

export type ApiKeyWithSecret = ApiKey & {
  secret: string;
};

/**
 * Form input for creating or editing a custom role.
 *
 * The selectable permissions are NOT listed here: they come from clinozy-be's own catalog
 * (`GET /tenancy/permissions`, via `useAssignablePermissions`) intersected with what the
 * caller holds. A hardcoded list had drifted to 11 of the backend's 18 codes, which made the
 * missing ones — both webhook codes among them — impossible to delegate through this UI.
 * `permissions` is typed against the permission union so an unknown code cannot be submitted.
 */
export const roleInputSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(40),
  description: z.string().min(2, 'Add a short description').max(160),
  permissions: z
    .array(organizationPermissionSchema)
    .min(1, 'Select at least one permission'),
});
export type RoleInput = z.infer<typeof roleInputSchema>;
