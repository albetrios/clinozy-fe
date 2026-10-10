import {
  type InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import {
  type ContactActivityEntry,
  type ContactActivityFilter,
  type ContactActivityPage,
  contactActivityQueryKeys,
  listContactActivities,
  sendContactActivity,
} from '@/shared/api/clinic/contact-activities-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/** A person's team notes: the `note` entries of their stream (§6 #3). */
export const CONTACT_NOTES_FILTER: ContactActivityFilter = { type: ['note'] };

/**
 * What a note write refreshes: the person's thread and every stream read (`['clinic',
 * 'messages']` — the Activity column shows the note too).
 */
const NOTE_WRITE_KEYS = [['clinic', 'messages']];

/** {@link useContactActivities}: the pages read so far, the server's total, the paging. */
export interface ContactActivityList {
  /** Every entry of the pages read so far, newest first. */
  entries: ContactActivityEntry[];
  /** The entries the filter matches, as the server counts them; null until it answers. */
  total: number | null;
  /** The first page is out. */
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  /** The entries on screen are another filter's while this one loads. */
  isRefreshing: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Read the next page — once at a time, however often it is pressed. */
  fetchNextPage: () => void;
  refetch: () => void;
}

/**
 * A person's stream for a filter, newest first, `limit` entries a page — "Load more" reads the
 * next (`GET /app/contacts/:contact_id/activities`; §6 #2, #3). Idle without a contact or an
 * organization, or with `enabled` false (the member's `contact_activity:read`,
 * {@link useContactActivityAccess}). A failed read raises no toast: the screen says so in place
 * and offers Retry.
 */
export function useContactActivities(
  contactId: string | null | undefined,
  filter: ContactActivityFilter,
  { limit, enabled = true }: { limit: number; enabled?: boolean },
): ContactActivityList {
  const organizationId = useOrganizationId();
  const contact = contactId ?? '';
  const query = useInfiniteQuery({
    queryKey: contactActivityQueryKeys.list(organizationId, contact, filter, limit),
    queryFn: ({ pageParam }) =>
      listContactActivities({ contactId: contact, filter, limit, after: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.next ?? undefined) : undefined),
    placeholderData: keepPreviousData,
    // The screen renders this failure itself (see above).
    meta: { notifyOnError: false },
    enabled: enabled && organizationId !== null && contact !== '',
  });

  const { fetchNextPage } = query;
  const inFlight = useRef(false);
  const loadMore = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    fetchNextPage()
      .catch(() => {
        // The query's own isError says so.
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [fetchNextPage]);

  const { data } = query;
  const entries = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data]);
  return {
    entries,
    total: data?.pages[0]?.total ?? null,
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    isError: query.isError,
    isRefreshing: query.isPlaceholderData,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: loadMore,
    refetch: () => {
      query.refetch().catch(() => {
        // The query's own isError says so.
      });
    },
  };
}

/** What the member may do with a person's stream. */
export interface ContactActivityAccess {
  /** Read it (`contact_activity:read`): the Overview's timeline, Team notes. */
  reads: boolean;
  /** Add a team note (`contact_activity:create`). */
  writes: boolean;
}

/**
 * The member's stream access, from the codes in force (a View-as preview's too). Both false
 * until the access has answered.
 */
export function useContactActivityAccess(): ContactActivityAccess {
  const access = useClinicAccess();
  return useMemo(() => {
    if (!access.isResolved) return { reads: false, writes: false };
    return {
      reads: access.canCode('contact_activity:read'),
      writes: access.canCode('contact_activity:create'),
    };
  }, [access]);
}

/** Add note: the text, trimmed and not blank (the route's `body`). */
export interface ContactNoteVars {
  body: string;
}

/** A note's most: the composer's 500 (H:834, H:778), inside the route's 1,000. */
export const CONTACT_NOTE_MAX = 500;

/** A note still on its way: tops the notes at once, its author the signed-in member (`''`). */
function draftNote(body: string): ContactActivityEntry {
  return {
    id: `draft-${crypto.randomUUID()}`,
    type: 'note',
    group: 'messages',
    body,
    occurredAt: new Date().toISOString(),
    authorId: '',
    link: null,
  };
}

/**
 * Add a team note to a person's stream (`POST …/activities/add-note`; §6 #3) — optimistic: it
 * tops every read of their notes at once, and goes again if the server refuses it (the error
 * toasts). There is no delete and no Undo: the API has no way back for a note (G4).
 */
export function useAddContactNote(contactId: string | null | undefined) {
  const organizationId = useOrganizationId();
  const contact = contactId ?? '';
  return useAppMutation<unknown, ContactNoteVars>({
    mutationFn: ({ body }, action) =>
      sendContactActivity({ contactId: contact, channel: 'note', body, ...action }),
    invalidateKeys: NOTE_WRITE_KEYS,
    optimisticQueries: {
      queryKey: contactActivityQueryKeys.list(
        organizationId,
        contact,
        CONTACT_NOTES_FILTER,
      ),
      update: (data, { body }) => {
        const read = data as InfiniteData<ContactActivityPage>;
        const [first, ...rest] = read.pages;
        if (!first) return data;
        const draft = draftNote(body);
        return {
          ...read,
          pages: [
            { ...first, rows: [draft, ...first.rows], total: (first.total ?? 0) + 1 },
            ...rest,
          ],
        };
      },
    },
  });
}
