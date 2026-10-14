import { z } from 'zod';

/** How the report was written — clinozy-be `USER_BUG_REPORT_INPUT_METHODS`. */
const BUG_REPORT_INPUT_METHODS = ['typed', 'voice', 'mixed'] as const;

/** One of {@link BUG_REPORT_INPUT_METHODS}. */
export type BugReportInputMethod = (typeof BUG_REPORT_INPUT_METHODS)[number];

/** Longest description clinozy-be accepts (after trimming) — the textbox's `maxLength`. */
export const BUG_REPORT_DESCRIPTION_MAX_LENGTH = 5000;

/**
 * The body of `POST /api/v1/users/me/bug-reports`. There is no name, email or user id: clinozy-be
 * stamps the reporter from the signed-in session (its body is strict and refuses them).
 */
export const createBugReportRequestSchema = z.object({
  description: z.string().trim().min(1).max(BUG_REPORT_DESCRIPTION_MAX_LENGTH),
  input_method: z.enum(BUG_REPORT_INPUT_METHODS),
  page_path: z.string().startsWith('/').max(2048).nullable(),
  app_version: z.string().min(1).max(64).nullable(),
});

/** The request body the panel sends. */
export type CreateBugReportRequest = z.infer<typeof createBugReportRequestSchema>;

/** The stored report clinozy-be answers with (`UserBugReport`). */
export const bugReportSchema = z.object({
  id: z.string(),
  description: z.string(),
  input_method: z.enum(BUG_REPORT_INPUT_METHODS),
  page_path: z.string().nullable(),
  app_version: z.string().nullable(),
  user_id: z.string(),
  reporter_name: z.string().nullable(),
  organization_id: z.string().nullable(),
  created_at: z.string(),
});

/** A stored bug report, as clinozy-be returns it. */
export type BugReport = z.infer<typeof bugReportSchema>;
