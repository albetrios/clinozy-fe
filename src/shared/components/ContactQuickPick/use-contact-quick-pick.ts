import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isContactSearchable } from '@/shared/api/app/contacts-api.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import { useContactSearch, useRecentContacts } from '@/shared/hooks/useContacts/index.ts';

import {
  CONTACT_QUICK_PICK_KEYS,
  CONTACT_QUICK_PICK_NS,
} from './contact-quick-pick.constants.ts';
import { type QuickAddDraft, quickAddDraftOf } from './contact-quick-pick-query.ts';

const K = CONTACT_QUICK_PICK_KEYS;

/** The add row's cmdk value — never a contact id (`con_…`). */
export const QUICK_PICK_ADD_VALUE = 'add';

/** What the list shows for the search as it stands. */
export interface QuickPickView {
  /** Trimmed. */
  typed: string;
  /** The text is a search the API takes (3 letters, 4 digits, a whole `C-12345`). */
  live: boolean;
  /** "Recent", before anything is typed. */
  recent: readonly ContactSummary[];
  /** The search's people — the last answer while the next one loads. */
  hits: readonly ContactSummary[];
  /** Nothing to show yet while an answer is on its way: the shimmer rows stand in. */
  waiting: boolean;
  /** A new answer is loading over the last: its rows stay, dimmed. */
  refreshing: boolean;
  searching: boolean;
  noMatch: boolean;
  /** The quick add's start. */
  draft: QuickAddDraft;
}

/** The status line: the search under way, then its answer; nothing for Recent. */
function useStatusText(view: QuickPickView): string {
  const { t } = useTranslation(CONTACT_QUICK_PICK_NS);
  if (!view.live) return '';
  if (view.searching) return t(K.searching);
  if (view.noMatch) return t(K.noMatch);
  return view.hits.length > 0 ? t(K.found, { count: view.hits.length }) : '';
}

/** The row the desk moved to, with the rows shown when they did. */
interface ActiveRow {
  value: string;
  /** The shown rows' values, joined — a highlight belongs to the rows it was chosen among. */
  rows: string;
}

/** Every row's cmdk value, in order: Recent, the search's people, the add row. */
function rowValuesOf(view: QuickPickView): string[] {
  return [...view.recent, ...view.hits].map((hit) => hit.id).concat(QUICK_PICK_ADD_VALUE);
}

/**
 * The highlight cmdk shows: the row the desk moved to, while the same rows are shown — else the
 * first row (the first person, or the add row), so ↵ always has something to pick. A highlight
 * chosen among other rows (cmdk's own pick of the lone add row while an answer loaded) does
 * not carry over to the people who arrive.
 */
function highlightOf(view: QuickPickView, active: ActiveRow): string {
  const values = rowValuesOf(view);
  if (active.rows === values.join(',') && values.includes(active.value)) {
    return active.value;
  }
  return values[0] ?? QUICK_PICK_ADD_VALUE;
}

/**
 * The contact picker's state: the search text, the quick add (open with its start, or not), the
 * highlight, and what the list shows — the search (`useContactSearch`) and, before anything is
 * typed, Recent (`useRecentContacts`, read only while it can be seen).
 */
export function useContactQuickPick({
  limit,
  disabled,
}: {
  limit: number;
  disabled: boolean;
}) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<QuickAddDraft | null>(null);
  const [activeRow, setActiveRow] = useState<ActiveRow>({ value: '', rows: '' });
  const typed = query.trim();
  const live = isContactSearchable(typed);
  const search = useContactSearch(query);
  const recent = useRecentContacts(!disabled && adding === null && typed === '');
  const hits = live ? search.hits.slice(0, limit) : [];

  const view: QuickPickView = {
    typed,
    live,
    recent: typed === '' ? recent.people : [],
    hits,
    waiting:
      (typed === '' && recent.loading) || (live && search.searching && hits.length === 0),
    refreshing: live && search.searching && hits.length > 0,
    searching: search.searching,
    noMatch: search.noMatch,
    draft: quickAddDraftOf(typed),
  };

  return {
    query,
    /** A new search starts its highlight on its first row. */
    setQuery: (next: string) => {
      setQuery(next);
      setActiveRow({ value: '', rows: '' });
    },
    adding,
    setAdding,
    highlighted: highlightOf(view, activeRow),
    /** cmdk moved the highlight (↑ ↓, a hover, or its own pick) among the rows shown now. */
    setActive: (value: string) =>
      setActiveRow({ value, rows: rowValuesOf(view).join(',') }),
    view,
    status: useStatusText(view),
  };
}
