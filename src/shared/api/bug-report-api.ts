import { API_BASE_PATH } from '@/core/config/constants.ts';
import { apiClient } from '@/core/http/fetch-client.ts';

import {
  type BugReport,
  bugReportSchema,
  type CreateBugReportRequest,
  createBugReportRequestSchema,
} from './bug-report-contracts.ts';

const BUG_REPORTS_PATH = `${API_BASE_PATH}/users/me/bug-reports`;

/**
 * File a bug report for the signed-in person (`POST /users/me/bug-reports`). The body carries what
 * they wrote and where they were; who they are travels in the session, and clinozy-be stamps it.
 * `idempotencyKey` is the send's one key (`useAppMutation`), kept across its retries, so a send
 * whose answer was lost never files twice.
 */
export async function createBugReport({
  input,
  idempotencyKey,
}: {
  input: CreateBugReportRequest;
  idempotencyKey?: string;
}): Promise<BugReport> {
  const body = createBugReportRequestSchema.parse(input);
  const res = await apiClient.post<unknown>(BUG_REPORTS_PATH, body, { idempotencyKey });
  return bugReportSchema.parse(res.data);
}

/**
 * The in-app path to report — `location.pathname` alone: the query and fragment can carry ids
 * (a dialog's record, a search) that a bug report has no need to keep.
 */
export function currentPagePath(
  location: Pick<Location, 'pathname'> = window.location,
): string {
  return location.pathname || '/';
}
