import { useMemo } from 'react';

import { resolveAccessFromCodes } from '@/shared/api/app/access-api.ts';
import type { AppAction } from '@/shared/api/app/access-contracts.ts';
import type { Section } from '@/shared/api/app/app-schema.ts';
import { useRolePermissions } from '@/shared/hooks/useRoles/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

/**
 * Whether the member may export a table's rows (the bulk bar's Export): its room's own export
 * code (`patient:export`, `lead:export`), as the server would ask.
 */
export function canExportRows(
  access: Pick<AppAccess, 'isResolved' | 'canCode'>,
  code: string,
): boolean {
  return access.isResolved && access.canCode(code);
}

/** The signed-in member's clinic access — or, while View-as runs, the previewed role's. */
export interface AppAccess {
  /** The role View-as previews (`rol_…`), else null. */
  previewRole: string | null;
  can: (section: Section, action: AppAction) => boolean;
  /**
   * Whether the codes in force hold one clinozy-be permission code (`lead:export`,
   * `offering:lower_price:read`, …) — how a room asks about an action the four section actions
   * do not name. During View-as, the previewed role's codes answer.
   */
  canCode: (code: string) => boolean;
  /** Sections with View, in nav order; Today always. Empty until resolved. */
  viewableSections: Section[];
  /**
   * False until the codes in force have answered — the member's own, or the previewed role's.
   * An unresolved `false` means "not known yet", never "not allowed" — gate placeholders and
   * redirects on this.
   */
  isResolved: boolean;
}

const NOTHING_YET = {
  can: () => false,
  canCode: () => false,
  viewableSections: [] as Section[],
  isResolved: false,
};

const NO_CODES: readonly string[] = [];

/**
 * In-room access for the clinic screens, from permission codes only (research-users §7): the
 * member's own (`my_permissions` on me/context), or — while View-as previews a role — that role's
 * (`GET /tenancy/organization/roles/:role_id/permissions`). Every section and every code answers
 * from the same set, so a preview shows exactly what the role would see. Route gates stay the
 * manifests' permission and module; this decides the nav, buttons, row actions and read-only
 * drawers. The server re-checks every request.
 *
 * @remarks
 * A preview whose codes cannot be read (the read failed) previews nothing — every screen
 * read-only — rather than falling back to the member's own access.
 */
export function useAppAccess(): AppAccess {
  const permissions = useOrganizationStore((state) => state.permissions);
  const permissionsResolved = useOrganizationStore((state) => state.permissionsResolved);
  const previewRole = useUIStore((state) => state.previewRole);
  const preview = useRolePermissions(previewRole ?? undefined);
  // A failed first read previews nothing; a failed refresh keeps the codes it had.
  const previewCodes = preview.data ?? (preview.isError ? NO_CODES : undefined);

  return useMemo(() => {
    const codes = previewRole === null ? permissions : previewCodes;
    if (!(permissionsResolved && codes)) return { previewRole, ...NOTHING_YET };
    const held = new Set<string>(codes);
    return {
      previewRole,
      isResolved: true,
      ...resolveAccessFromCodes(codes),
      canCode: (code: string) => held.has(code),
    };
  }, [permissions, permissionsResolved, previewRole, previewCodes]);
}
