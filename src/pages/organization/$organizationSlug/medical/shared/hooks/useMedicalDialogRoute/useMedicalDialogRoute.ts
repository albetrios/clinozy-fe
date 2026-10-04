import type { QueryKey } from '@tanstack/react-query';
import { useLocation, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type { MedicalTab } from '@/lib/routes/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  type MedicalCreateSearch,
  validateMedicalCreateSearch,
} from '../../../medical.search.ts';
import { useMedicalNav } from '../useMedicalNav/index.ts';

/**
 * The dialog a Medical tab's URL opens over its list (KICKOFF §4, D24):
 * `<tab>/create` with its prefill, or a record's route — `<tab>/<id>` (a
 * view), `…/edit`, `…/receive`, `…/return`, `…/visits/create` — with the
 * record once loaded.
 */
export type MedicalDialogRoute<T> =
  | { kind: 'none' }
  | { kind: 'create'; prefill: MedicalCreateSearch }
  | {
      kind: 'record';
      /** What follows the id in the URL: '' (the view), 'edit', 'receive', 'return', 'visits/create'. */
      action: string;
      id: string;
      record: T | undefined;
    };

/** The dialog, and how it closes: back to the tab with the list's own params. */
export interface MedicalDialogRouteState<T> {
  dialog: MedicalDialogRoute<T>;
  close: () => void;
}

/** Options of {@link useMedicalDialogRoute}. */
export interface UseMedicalDialogRouteOptions<T> {
  tab: MedicalTab;
  /** The route param naming the record (`medicineId`, `supplierId`). */
  param: string;
  queryKey: (id: string) => QueryKey;
  fetchRecord: (id: string) => Promise<T>;
  /** The record's name in "<Record> not found · it may have been deleted". */
  recordLabel: string;
}

/**
 * Which drawer a Medical tab's URL opens — its dialog routes render nothing,
 * so the tab page reads them here (KICKOFF §6.7 Routes). A member without
 * Create who follows a create link lands back on the list with the permission
 * toast. An id that names no record (a stale link, a deleted record) opens
 * nothing: the URL goes back to the list in place, with "<Record> not found ·
 * it may have been deleted" (`S:115`). Record routes stay open to a viewer —
 * the drawer is view only. `close` returns to the list with its search,
 * filters and sort, and drops the prefill.
 */
export function useMedicalDialogRoute<T>({
  tab,
  param,
  queryKey,
  fetchRecord,
  recordLabel,
}: UseMedicalDialogRouteOptions<T>): MedicalDialogRouteState<T> {
  const params: Record<string, string | undefined> = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const { t } = useTranslation(ERRORS_NS);
  const access = useClinicAccess();
  const nav = useMedicalNav();
  const close = () => nav.close(tab);

  const id = params[param];
  const drawer = useDialogRouteRecord({
    id,
    queryKey,
    fetchRecord,
    recordLabel,
    onMissing: close,
  });

  const isCreate = id === undefined && /\/create\/?$/.test(pathname);
  const refused = isCreate && access.isResolved && !access.can('medical', 'create');
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403));
    nav.close(tab);
  }, [refused, pathname, nav, tab, t]);

  if (id !== undefined) {
    const after = pathname.split(`/${id}`)[1] ?? '';
    return {
      dialog: drawer.isOpen
        ? {
            kind: 'record',
            action: after.replace(/^\/|\/$/g, ''),
            id,
            record: drawer.record,
          }
        : { kind: 'none' },
      close,
    };
  }
  if (!isCreate || refused) return { dialog: { kind: 'none' }, close };
  // The prefill is parsed again here: the list's own match hands back the
  // URL's raw values, not the create route's.
  return {
    dialog: { kind: 'create', prefill: validateMedicalCreateSearch(search) },
    close,
  };
}
