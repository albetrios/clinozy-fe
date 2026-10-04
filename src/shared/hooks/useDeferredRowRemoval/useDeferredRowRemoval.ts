import { type InfiniteData, type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { reportError } from '@/shared/errors/errorHandler.ts';
import { notify } from '@/shared/notify/index.ts';
import {
  type DeferredCommit,
  notifyDeferredCommit,
} from '@/shared/notify/notify-deferred.ts';

/** Minimal structural shape of one accumulated cursor-list page. */
type ListPage<TRow> = { rows: TRow[] };

/**
 * One cached variant of the list: a cursor list's accumulated pages, or a flat
 * array of rows (a list read whole, every page up front — the Users Team).
 */
type ListCache<TRow> = InfiniteData<ListPage<TRow>> | TRow[] | undefined;

/** The `pageIndex` a site in a flat-array variant carries. */
const FLAT = -1;

/**
 * Where one row sat in ONE cached list variant, so undo can put that row — and
 * nothing else — back. Point 4 below is why this is not a whole-cache snapshot.
 */
interface RowSite<TRow> {
  /** The cached variant this site was read from. */
  key: QueryKey;
  /** Index of the accumulated page the row was on; {@link FLAT} for a flat array. */
  pageIndex: number;
  /** The row as it was cached at schedule time. */
  row: TRow;
  /** Ids that followed the row on that page — the anchor undo re-inserts before. */
  followerIds: Set<string>;
}

const isPaged = <TRow>(data: ListCache<TRow>): data is InfiniteData<ListPage<TRow>> =>
  Boolean(data) &&
  !Array.isArray(data) &&
  Array.isArray((data as { pages?: unknown }).pages);

/** Drop one row from every accumulated page of a cursor list, or from a flat array. */
function withoutRow<TRow extends { id: string }>(
  old: ListCache<TRow>,
  id: string,
): ListCache<TRow> {
  const dropId = (rows: TRow[]) => rows.filter((row) => row.id !== id);
  if (Array.isArray(old)) return dropId(old);
  if (!isPaged(old)) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({ ...page, rows: dropId(page.rows) })),
  };
}

/** Where `id` sits in one array of rows, as a site of the variant `key`. */
function siteIn<TRow extends { id: string }>(
  key: QueryKey,
  rows: readonly TRow[],
  pageIndex: number,
  id: string,
): RowSite<TRow> | null {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) return null;
  return {
    key,
    pageIndex,
    row,
    followerIds: new Set(rows.slice(rows.indexOf(row) + 1).map((next) => next.id)),
  };
}

/** Record where `id` sits in every cached variant of the list, before removal. */
function sitesOf<TRow extends { id: string }>(
  entries: [QueryKey, ListCache<TRow>][],
  id: string,
): RowSite<TRow>[] {
  const sites: RowSite<TRow>[] = [];
  for (const [key, data] of entries) {
    if (Array.isArray(data)) {
      const site = siteIn(key, data, FLAT, id);
      if (site) sites.push(site);
      continue;
    }
    if (!isPaged(data)) continue;
    data.pages.forEach((page, pageIndex) => {
      if (!Array.isArray(page.rows)) return;
      const site = siteIn(key, page.rows, pageIndex, id);
      if (site) sites.push(site);
    });
  }
  return sites;
}

/** `rows` with the recorded row back before its nearest surviving follower; null when it is already there. */
function rowsWith<TRow extends { id: string }>(
  rows: readonly TRow[],
  site: RowSite<TRow>,
): TRow[] | null {
  // Idempotent — never duplicate a row the cache has already got back.
  if (rows.some((row) => row.id === site.row.id)) return null;
  const next = [...rows];
  const follower = next.findIndex((row) => site.followerIds.has(row.id));
  next.splice(follower === -1 ? next.length : follower, 0, site.row);
  return next;
}

/**
 * Put one recorded row back on its own page (or in its flat array), touching
 * no other row.
 *
 * It goes in just before its nearest surviving follower, so it lands where it
 * was even though the rows around it have since moved; when every follower has
 * gone (a refetch, or another removal still pending) it is appended instead.
 */
function withRow<TRow extends { id: string }>(
  old: ListCache<TRow>,
  site: RowSite<TRow>,
): ListCache<TRow> {
  // A variant the cache has since dropped stays dropped: returning `undefined`
  // makes `setQueryData` a no-op rather than resurrecting a whole stale list.
  if (site.pageIndex === FLAT) {
    return Array.isArray(old) ? (rowsWith(old, site) ?? old) : old;
  }
  if (!isPaged(old)) return old;
  const page = old.pages.at(site.pageIndex);
  if (!(page && Array.isArray(page.rows))) return old;
  const rows = rowsWith(page.rows, site);
  if (!rows) return old;
  return {
    ...old,
    pages: old.pages.map((candidate, index) =>
      index === site.pageIndex ? { ...candidate, rows } : candidate,
    ),
  };
}

export interface DeferredRowRemovalInput {
  /** Row id — used to filter the cached lists and to key the toast. */
  id: string;
  /** Undoable toast copy, e.g. "Removing Sam…". */
  pendingMessage: string;
  /** Closing toast once the write lands, e.g. "Member removed". */
  committedMessage?: string;
  /** Toast id; must be unique per row so two removals never fight. */
  toastId: string;
  /** The write itself. Return the promise so a failure can roll the row back. */
  commit: () => Promise<unknown>;
  /** The undo window (default 5s); the clinic rooms' Undo toasts run 10s (D32). */
  delayMs?: number;
}

/**
 * Schedule a destructive row removal behind the shared undo toast — with the row
 * taken out of the list **immediately**.
 *
 * Four things this owns that the raw helper cannot (SET-7):
 *
 * 1. **The row leaves at schedule time, not at commit time.** The mutation's own
 *    `optimisticInfinite` patch runs in `onMutate`, which is five seconds away —
 *    so the toast said "Removing Sam…" while Sam sat in the table, untouched.
 *    The cached pages are patched here, and where the row sat is recorded so
 *    undo can put it back (point 4).
 * 2. **Undo and commit-failure both restore the row.** The mutation's own
 *    rollback snapshots at COMMIT time, when the row is already gone, so it
 *    cannot put it back; what is recorded here is the only thing that can.
 * 3. **Unmount cancels instead of leaking a timer.** Closing Settings inside the
 *    undo window used to leave a `setTimeout` pointed at a torn-down panel; it
 *    fired five seconds later and deleted the row from nowhere, with the undo
 *    affordance already gone. Committing at unmount instead is not the answer
 *    either — though NOT because the request would be stuck in the browser,
 *    which is what this comment used to claim. Under TanStack Query v5 the
 *    write does go out: the `Mutation` lives on the MutationCache, its
 *    `execute()` runs the `mutationFn` without ever consulting its observer
 *    list, and the mutation-level `onMutate`/`onSuccess`/`onError`/`onSettled`
 *    run with it. Unmounting only detaches the observer
 *    (`MutationObserver.onUnsubscribe` → `removeObserver`, which just schedules
 *    GC). What it DOES silently drop are the per-call callbacks handed to
 *    `mutate(vars, { onError })` — `MutationObserver` gates those behind
 *    `hasListeners()`. So committing here would fire a destructive write with
 *    its failure path muted and no undo left to press. The pending removal is
 *    CANCELLED instead — the row comes back and the user is told, rather than a
 *    confirmed delete silently happening (or silently not happening) after the
 *    surface is gone.
 * 4. **Undo is keyed per row, not per cache.** Removals overlap, so each
 *    schedule records only where ITS row sat and restores only that row. A
 *    whole-cache snapshot cannot: B's is captured while A is already out, so
 *    replaying it re-applies a list in which A is missing, and A stays missing
 *    until the list refetches. Per-row restores commute — any undo order, and
 *    the unmount loop's order, leave every restored row in place.
 *
 * @param queryKey Prefix matching every cached variant of the list (params are
 *   part of the key, so a single removal must patch them all).
 */
export function useDeferredRowRemoval<TRow extends { id: string }>(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  /** Scheduled commits that have not settled yet, keyed by row id. */
  const pending = useRef(new Map<string, DeferredCommit>());

  useEffect(() => {
    const scheduled = pending.current;
    return () => {
      // Iteration order is irrelevant: each handle restores only its own row,
      // so cancelling overlapping removals in any order leaves them all back.
      for (const [rowId, commit] of scheduled) {
        // Only claim "undone" when this call really did cancel. `cancel()` is
        // inert once the commit is under way, and this toast carries a
        // different id from the commit's — so an unguarded call could sit
        // "Undone" beside that very write's confirmation.
        if (!commit.cancel()) continue;
        // Say so. A destructive action the user confirmed and then did not get
        // is exactly the thing that must never happen quietly.
        notify.info(i18n.t(ERRORS_KEYS.toast.undone, { ns: ERRORS_NS }), {
          id: `deferred-cancelled-${rowId}`,
        });
      }
      scheduled.clear();
    };
  }, []);

  return useCallback(
    (input: DeferredRowRemovalInput) => {
      /*
       * RACE A — a second schedule for the SAME row must not leave two timers.
       *
       * `pending` is keyed by row id, so a duplicate schedule used to overwrite
       * the entry while the FIRST commit's timer kept running: two DELETEs for
       * one row. Worse, the first handle's `settle()` deletes whatever sits at
       * that key, so it removed the SECOND schedule's entry and left that timer
       * uncancellable at unmount.
       *
       * A double-click on Remove reaches this, so "callers must pass unique
       * ids" is not a defence for a hook that owns destructive writes. The
       * latest gesture wins: cancel the live one (restoring the row) before
       * scheduling its replacement, so exactly one timer is ever armed and the
       * user gets a full undo window from the click they actually made.
       */
      pending.current.get(input.id)?.cancel();

      /*
       * RACE B — patch the cache only once nothing can overwrite it.
       *
       * The optimistic removal below is a plain `setQueriesData`. A list
       * refetch already in flight resolves AFTER it and writes the row back, so
       * the row reappears mid-undo-window — and if the user then does nothing,
       * the commit deletes a row that is visibly on screen. Cancelling first is
       * the documented TanStack pattern; a cancelled query never writes its
       * result. Not awaited (this callback is sync by contract) but not
       * swallowed either — a genuine failure is reported.
       */
      void queryClient.cancelQueries({ queryKey }).catch((error: unknown) => {
        reportError(error, { scope: 'deferred-row-removal.cancel-queries' });
      });

      const sites = sitesOf<TRow>(
        queryClient.getQueriesData<ListCache<TRow>>({ queryKey }),
        input.id,
      );
      queryClient.setQueriesData<ListCache<TRow>>({ queryKey }, (old) =>
        withoutRow(old, input.id),
      );

      const restore = () => {
        for (const site of sites)
          queryClient.setQueryData<ListCache<TRow>>(site.key, (old) =>
            withRow(old, site),
          );
      };
      const settle = () => pending.current.delete(input.id);

      const handle = notifyDeferredCommit({
        pendingMessage: input.pendingMessage,
        committedMessage: input.committedMessage,
        toastId: input.toastId,
        ...(input.delayMs === undefined ? {} : { delayMs: input.delayMs }),
        onCommit: async () => {
          settle();
          await input.commit();
        },
        onCancel: () => {
          settle();
          restore();
        },
        onCommitError: () => {
          restore();
        },
      });
      pending.current.set(input.id, handle);
    },
    [queryClient, queryKey],
  );
}
