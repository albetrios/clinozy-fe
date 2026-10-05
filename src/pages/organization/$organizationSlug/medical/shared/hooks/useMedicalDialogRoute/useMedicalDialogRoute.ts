import type { QueryKey } from '@tanstack/react-query';

import type { MedicalTab } from '@/lib/routes/medical-builders.ts';
import {
  type RoomDialogRoute,
  type RoomDialogRouteState,
  useRoomDialogRoute,
} from '@/shared/hooks/useRoomDialogRoute/index.ts';

import {
  type MedicalCreateSearch,
  validateMedicalCreateSearch,
} from '../../../medical.dialog-search.ts';
import { useMedicalNav } from '../useMedicalNav/index.ts';

/** The dialog a Medical tab's URL opens over its list, with Medical's create prefill. */
export type MedicalDialogRoute<T> = RoomDialogRoute<T, MedicalCreateSearch>;

/** The dialog, and how it closes: back to the tab with the list's own params. */
export type MedicalDialogRouteState<T> = RoomDialogRouteState<T, MedicalCreateSearch>;

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
 * Which drawer a Medical tab's URL opens (KICKOFF §6.7 Routes) — the shared
 * room dialog route over the Medical section: a create needs Medical Create,
 * an unknown id goes back to the list with "<Record> not found", and `close`
 * keeps the tab's search, filters and sort.
 */
export function useMedicalDialogRoute<T>({
  tab,
  ...options
}: UseMedicalDialogRouteOptions<T>): MedicalDialogRouteState<T> {
  const nav = useMedicalNav();
  return useRoomDialogRoute({
    ...options,
    section: 'medical',
    close: () => nav.close(tab),
    readPrefill: validateMedicalCreateSearch,
  });
}
