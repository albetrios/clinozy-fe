import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationLeads } from '@/lib/routes/leads-builders.ts';
import { fetchLead, leadQueryKeys } from '@/shared/api/clinic/leads-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';

import { LEADS_KEYS, LEADS_NS } from '../../leads.constants.ts';
import {
  type LeadCreateSearch,
  validateLeadCreateSearch,
} from '../../leads.dialog-search.ts';

/** The dialog the Leads URL opens over the list (KICKOFF §4, D24). */
export type LeadsDialogRoute =
  | { kind: 'none' }
  /** `/leads/create` — the New lead drawer, prefilled from `?name=&phone=` (`S:23`). */
  | { kind: 'create'; prefill: LeadCreateSearch }
  /** `/leads/$leadId` — the lead drawer; `lead` arrives once loaded. */
  | { kind: 'lead'; leadId: string; lead: LeadRecord | undefined; isPending: boolean };

const CREATE_PATH = /\/leads\/create\/?$/;

/**
 * Which dialog the URL opens over the Leads list — the room's dialog routes
 * render nothing, so the page reads them here. A lead id that names no lead (a
 * stale link, a removed lead, a contact thread) opens nothing: the URL goes
 * back to `/leads` in place, filters kept, with "Lead not found · it may have
 * been deleted" (`S:115`).
 */
export function useLeadsDialogRoute(): LeadsDialogRoute {
  const { organizationSlug = '', leadId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(LEADS_NS);

  const backToList = useCallback(() => {
    void navigate({
      ...organizationLeads(organizationSlug),
      search: true,
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);

  const drawer = useDialogRouteRecord({
    id: leadId,
    queryKey: leadQueryKeys.detail,
    fetchRecord: fetchLead,
    recordLabel: t(LEADS_KEYS.record),
    onMissing: backToList,
  });

  if (leadId !== undefined) {
    return drawer.isOpen
      ? { kind: 'lead', leadId, lead: drawer.record, isPending: drawer.isPending }
      : { kind: 'none' };
  }
  // The prefill is parsed again here: from the list's own match the router
  // hands back the URL's raw values, not the create route's.
  if (CREATE_PATH.test(pathname)) {
    return { kind: 'create', prefill: validateLeadCreateSearch(search) };
  }
  return { kind: 'none' };
}
