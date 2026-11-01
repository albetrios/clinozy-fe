import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/*
 * The links clinozy-be gives a stored file — a patient photo's `file_url`, each of a report's
 * `files` (D86): a presigned GET, valid 15 minutes and signed afresh on every read. Two rules
 * follow. Every read carrying links reads again before they lapse ({@link FILE_LINK_REFRESH_MS},
 * and on the tab's return). And a link is kept while it has life left ({@link stableFileUrl}):
 * a new signature is a new URL, which the browser cannot answer from its cache — without this,
 * every refresh would download every photo again. A kept link past its reuse is swept, and a
 * clinic switch forgets them all (G-3) — one entry per file ever viewed would otherwise stay for
 * the life of the tab, a working link to another clinic's patient photo among them.
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
 * Whether a link received at `receivedAt` may still be shown at `now`: younger than
 * {@link FILE_LINK_REUSE_MS}. One dated ahead of `now` (the clock was set back) is not — its age
 * is unknown.
 */
function isReusable(receivedAt: number, now: number): boolean {
  const age = now - receivedAt;
  return age >= 0 && age < FILE_LINK_REUSE_MS;
}

/** When the kept links were last swept ({@link sweepSpentLinks}). */
let sweptAt = 0;

/**
 * Drop every kept link past {@link FILE_LINK_REUSE_MS} — none of them is shown again, the next
 * read of its file keeps a new one — at most once a {@link FILE_LINK_REFRESH_MS}.
 */
function sweepSpentLinks(now: number): void {
  // A clock set back sweeps at once rather than waiting for it to catch up.
  if (now >= sweptAt && now - sweptAt < FILE_LINK_REFRESH_MS) return;
  sweptAt = now;
  for (const [fileKey, kept] of keptLinks) {
    if (!isReusable(kept.receivedAt, now)) keptLinks.delete(fileKey);
  }
}

/** How many links are kept now — what the sweep and a clinic switch bound (their tests). */
export function keptFileLinkCount(): number {
  return keptLinks.size;
}

// A clinic switch (or a sign-out): the clinic being left's links are never shown again.
useOrganizationStore.subscribe((state, previous) => {
  if (state.organizationId !== previous.organizationId) keptLinks.clear();
});

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
  sweepSpentLinks(now);
  const kept = keptLinks.get(fileKey);
  if (kept && isReusable(kept.receivedAt, now)) return kept.url;
  keptLinks.set(fileKey, { url: fileUrl, receivedAt: now });
  return fileUrl;
}

/** The query options of a read that carries links: read again before they lapse, and on return. */
export const FILE_LINK_QUERY_OPTIONS = {
  refetchInterval: FILE_LINK_REFRESH_MS,
  refetchOnWindowFocus: true,
} as const;
