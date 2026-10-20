/**
 * Types for `throwaway-repository.mjs`. The module is plain JS (the tooling tests run it under
 * bare Node too), so its contract is declared here for the TypeScript tests under `tests/ci`.
 */

/** The identity every throwaway repository commits as. */
export declare const THROWAWAY_IDENTITY: Readonly<{ name: string; email: string }>;

/** Git's author and committer dates fixed at `unixSeconds`. */
export declare function fixedCommitDates(unixSeconds: number): Record<string, string>;

/** A throwaway repository: its folder and the git, write and commit helpers bound to it. */
export interface ThrowawayRepository {
  root: string;
  git(args: readonly string[], options?: { commitTime?: number }): string;
  writeFiles(files: Record<string, string | Uint8Array>): void;
  commitAll(options: { message: string; commitTime?: number }): void;
}

/** What {@link createThrowawayRepository} builds. */
export interface ThrowawayRepositoryOptions {
  /** The temp folder's name prefix (removed by `removeThrowawayRepositories`). */
  prefix?: string;
  /** An exact folder instead of a temp one; the caller removes it. */
  directory?: string;
  /** The initial branch; `main` when omitted. */
  branch?: string;
  /** The initial commit's files, by repository-relative path; an empty commit when omitted. */
  files?: Record<string, string | Uint8Array>;
  /** Fixes the initial commit's dates (Unix seconds). */
  commitTime?: number;
}

/** Creates a throwaway repository with one commit, every git call detached from a hook's repository. */
export declare function createThrowawayRepository(
  options?: ThrowawayRepositoryOptions,
): ThrowawayRepository;

/** Removes every temp-folder repository `createThrowawayRepository` made. */
export declare function removeThrowawayRepositories(): void;
