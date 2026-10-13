/*
 * The links clinozy-be gives a stored file — a patient photo's `file_url`, each of a report's
 * `files` (D86): a presigned GET, valid 15 minutes and signed afresh on every read. Two rules
 * follow. Every read carrying links reads again before they lapse ({@link FILE_LINK_REFRESH_MS},
 * and on the tab's return). And a link is kept while it has life left ({@link stableFileUrl}):
 * a new signature is a new URL, which the browser cannot answer from its cache — without this,
 * every refresh would download every photo again.
 */

/** How long a link works after the read that gave it (clinozy-be `PRESIGNED_URL_EXPIRY_SECONDS`). */
export const FILE_LINK_LIFETIME_MS = 15 * 60_000;

/** How often a read carrying links reads again while its screen is open. */
export const FILE_LINK_REFRESH_MS = 5 * 60_000;

/**
 * How long a link is kept before the next read's replaces it — so the link on screen is never
 * older than this plus one refresh ({@link FILE_LINK_REFRESH_MS}), inside its lifetime.
 */
export const FILE_LINK_REUSE_MS = FILE_LINK_LIFETIME_MS - FILE_LINK_REFRESH_MS - 60_000;

/** The link kept for each stored file, with when it was received. */
const keptLinks = new Map<string, { url: string; receivedAt: number }>();

/**
 * The link to show for `fileKey`: the one already kept while it is younger than
 * {@link FILE_LINK_REUSE_MS}, else `fileUrl` (now kept). Null — and forgotten — when the read
 * gave none (the upload is gone).
 */
export function stableFileUrl(fileKey: string, fileUrl: string | null): string | null {
  if (fileUrl === null) {
    keptLinks.delete(fileKey);
    return null;
  }
  const now = Date.now();
  const kept = keptLinks.get(fileKey);
  if (kept && now - kept.receivedAt < FILE_LINK_REUSE_MS) return kept.url;
  keptLinks.set(fileKey, { url: fileUrl, receivedAt: now });
  return fileUrl;
}

/** The query options of a read that carries links: read again before they lapse, and on return. */
export const FILE_LINK_QUERY_OPTIONS = {
  refetchInterval: FILE_LINK_REFRESH_MS,
  refetchOnWindowFocus: true,
} as const;
