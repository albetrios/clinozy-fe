/**
 * Types for `bulk-audit.mjs`. The module is plain JS (it runs under bare `node` as
 * `pnpm deps:audit`), so its contract is declared here for the TypeScript consumers —
 * `tests/ci/audit-accepted-advisories.policy.test.ts`.
 */

/** One `auditConfig.ignoreGhsas` entry with the comment block directly above it. */
export interface AcceptedAdvisory {
  ghsa: string;
  /** The first word after `Package:` in the comment, when there is one. */
  packageName: string | undefined;
  comment: string[];
}

/** One advisory as npm's bulk endpoint answers it. */
export interface BulkAdvisory {
  id: number;
  title: string;
  severity: string;
  url: string;
  vulnerable_versions: string;
  github_advisory_id?: string;
  patched_versions?: string | null;
}

/** A package's newest published version and the GHSA ids still reported for it. */
export interface NewestRelease {
  version: string;
  ghsas: ReadonlySet<string>;
}

/** What one audit run decided, as the lines it prints. */
export interface AuditVerdict {
  failing: string[];
  accepted: string[];
  belowThreshold: string[];
  acceptanceProblems: string[];
}

/** The labelled comment lines every `auditConfig.ignoreGhsas` entry must carry. */
export declare const ACCEPTED_COMMENT_LABELS: readonly string[];

/** Reads `auditConfig.ignoreGhsas` from `pnpm-workspace.yaml` text, with every policy problem. */
export declare function readAcceptedAdvisories(workspaceText: string): {
  entries: AcceptedAdvisory[];
  problems: string[];
};

/** The pure verdict over one run: failing, accepted, below-threshold and expired entries. */
export declare function judgeAudit(options: {
  advisories: Readonly<Record<string, readonly BulkAdvisory[]>>;
  audited: ReadonlyMap<string, ReadonlySet<string>>;
  level: string;
  accepted: readonly AcceptedAdvisory[];
  newest: ReadonlyMap<string, NewestRelease>;
  prodOnly: boolean;
}): AuditVerdict;
