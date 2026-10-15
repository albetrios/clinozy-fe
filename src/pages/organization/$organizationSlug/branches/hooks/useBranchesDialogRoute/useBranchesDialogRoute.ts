import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationBranches } from '@/lib/routes/branches-builders.ts';
import { notify } from '@/shared/notify/index.ts';

import { BRANCHES_KEYS, BRANCHES_NS } from '../../branches.constants.ts';
import { validateBranchesSearch } from '../../branches.search.ts';
import type { BranchRow } from '../useBranchRows/index.ts';

/** The drawer the Branches URL opens over its page (KICKOFF §4, D24). */
export type BranchesDialog =
  | { kind: 'none' }
  /** `/branches/create` — New branch (`S:109`). */
  | { kind: 'create' }
  /** `/branches/$branchId/edit` — the branch drawer (`S:110`). */
  | { kind: 'edit'; branchId: string; row: BranchRow | undefined };

/** The dialog, and how it closes: back to Branches with its own params. */
export interface BranchesDialogRouteState {
  dialog: BranchesDialog;
  close: () => void;
}

const CREATE_PATH = /\/branches\/create\/?$/;
const EDIT_PATH = /\/branches\/([^/]+)\/edit\/?$/;

/**
 * Which drawer the URL opens over Branches — the dialog routes render nothing,
 * so the page reads them here. A viewer who may not create branches and
 * follows a create link lands back on the list with the permission toast; an
 * id the list doesn't have — a stale link — leaves with
 * "Branch not found · it may have been deleted" (`S:115`). `close` returns to
 * Branches with its filter.
 */
export function useBranchesDialogRoute(
  list: { rows: readonly BranchRow[]; isPending: boolean },
  options: { canCreate: boolean; accessResolved: boolean },
): BranchesDialogRouteState {
  const { organizationSlug = '' } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { t } = useTranslation([ERRORS_NS, BRANCHES_NS]);
  const edit = EDIT_PATH.exec(pathname);

  // The route this hook is closing itself: the drawer stays shut while the
  // route catches up, and nothing reads it as "not found" on the way out.
  const [closing, setClosing] = useState<string | null>(null);
  if (closing !== null && closing !== pathname) setClosing(null);
  const close = useCallback(() => {
    setClosing(pathname);
    void navigate({
      ...organizationBranches(organizationSlug),
      search: (current: Record<string, unknown>) => validateBranchesSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug, pathname]);

  const isCreate = CREATE_PATH.test(pathname);
  const refused = isCreate && options.accessResolved && !options.canCreate;
  const branchId = edit?.[1];
  const row = branchId
    ? list.rows.find((candidate) => candidate.branch.id === branchId)
    : undefined;
  const closingHere = closing === pathname;
  const missing = branchId !== undefined && !list.isPending && !row && !closingHere;

  const reportedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!(refused || missing) || reportedFor.current === pathname) return;
    reportedFor.current = pathname;
    if (refused) notify.info(t(ERRORS_KEYS.api.http403, { ns: ERRORS_NS }));
    else {
      notify.info(
        t(ERRORS_KEYS.route.recordNotFound, {
          ns: ERRORS_NS,
          record: t(BRANCHES_KEYS.record, { ns: BRANCHES_NS }),
        }),
      );
    }
    close();
  }, [refused, missing, pathname, close, t]);

  return {
    dialog: branchesDialog({ closingHere, isCreate, refused, branchId, missing, row }),
    close,
  };
}

/** The drawer the URL opens — none while the page is closing it, as the route catches up. */
function branchesDialog(route: {
  closingHere: boolean;
  isCreate: boolean;
  refused: boolean;
  branchId: string | undefined;
  missing: boolean;
  row: BranchRow | undefined;
}): BranchesDialog {
  if (route.closingHere) return { kind: 'none' };
  if (route.isCreate && !route.refused) return { kind: 'create' };
  if (route.branchId && !route.missing) {
    return { kind: 'edit', branchId: route.branchId, row: route.row };
  }
  return { kind: 'none' };
}
