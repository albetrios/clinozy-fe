'use no memo';
// The table instance keeps its identity across state changes and is read
// through its methods (`getVisibleLeafColumns()` …): React Compiler
// memoisation would hand the toolbar's Columns chooser a stale answer.

import { Outlet, useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  organizationLead,
  organizationLeadCreate,
  organizationLeads,
} from '@/lib/routes/index.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import { LEAD_HOLD_DAYS, leadHold } from '@/shared/api/clinic/leads-hold.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { referrerFromPath } from '@/shared/clinic/clinic-referrer.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import {
  useAssignLead,
  useClaimLead,
  useConvertLead,
  useMarkLeadRead,
  useReleaseLead,
  useSetLeadInvolved,
} from '@/shared/hooks/useLeads/index.ts';

import { LeadDrawer, type LeadDrawerPane } from './components/LeadDrawer/index.ts';
import {
  LeadsTable,
  type LeadsTableContextValue,
  useLeadsTable,
} from './components/LeadsTable/index.ts';
import { LeadsToolbar } from './components/LeadsToolbar/index.ts';
import {
  NewLeadDrawer,
  type NewLeadDrawerProps,
} from './components/NewLeadDrawer/index.ts';
import {
  type LeadsDialogRoute,
  useLeadsDialogRoute,
} from './hooks/useLeadsDialogRoute/index.ts';
import { useLeadsList } from './hooks/useLeadsList/index.ts';
import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from './leads.constants.ts';

/** New lead's prefill belongs to its own URL: the list's and a lead's drop it. */
function withoutPrefill({
  name: _name,
  phone: _phone,
  ...rest
}: Record<string, unknown>): Record<string, unknown> {
  return rest;
}

/** Where a person's contact card goes: their file, a new appointment, a new patient. */
function personNavigation(
  navigate: ReturnType<typeof useNavigate>,
  organizationSlug: string,
  pathname: string,
) {
  return {
    patient: (recordId: string) =>
      void navigate(clinicCommandNavigation('patient', { organizationSlug, recordId })),
    newAppointment: (who: string) =>
      void navigate(
        clinicCommandNavigation('newAppointment', {
          organizationSlug,
          referrer: referrerFromPath(pathname),
          search: { who },
        }),
      ),
    newPatient: (lead: LeadRecord) =>
      void navigate(
        clinicCommandNavigation('newPatient', {
          organizationSlug,
          search: { name: lead.name, phone: lead.phone, fromLead: lead.id },
        }),
      ),
  };
}

/** New lead over the list while the URL is `/leads/create` and the member may create. */
function NewLeadDialog({
  dialog,
  canCreate,
  ...props
}: { dialog: LeadsDialogRoute; canCreate: boolean } & Omit<
  NewLeadDrawerProps,
  'prefill'
>) {
  if (dialog.kind !== 'create' || !canCreate) return null;
  const { prefill } = dialog;
  return (
    <NewLeadDrawer
      key={`${prefill.name ?? ''}:${prefill.phone ?? ''}`}
      prefill={prefill}
      {...props}
    />
  );
}

/** An action offered only where it applies — the contact card hides the rest. */
function offer(allowed: boolean, action: () => void): (() => void) | undefined {
  return allowed ? action : undefined;
}

/**
 * Leads room (KICKOFF §6.3): the toolbar — views, search, Filters, Columns,
 * "New lead" — over the list of leads. Its dialog routes — New lead
 * (`create/`) and the lead drawer (`$leadId/`) — render nothing: this page
 * reads the URL and opens their drawers over itself; a dead link stays on the
 * list with "Lead not found".
 */
export function LeadsPage() {
  const { t } = useTranslation(LEADS_NS);
  const dialog = useLeadsDialogRoute();
  const state = useLeadsList();
  // The phone's pane — Chat first, kept between leads (KICKOFF §6.3).
  const [pane, setPane] = useState<LeadDrawerPane>('chat');
  const access = useClinicAccess();
  const navigate = useNavigate();
  const { organizationSlug = '', leadId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const markRead = useMarkLeadRead();
  const claim = useClaimLead();
  const release = useReleaseLead();
  const assign = useAssignLead();
  const setInvolved = useSetLeadInvolved();
  const convert = useConvertLead();
  // The lead New lead just created: first in the list and picked out (D28).
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { rows } = state.list;
  // One "now" per set of rows — the hold and the "Updated" words agree — read
  // again when the rows change (the stored-previous-value pattern, keyed on
  // the rows' ids and stamps: a refetch that brings the same rows keeps the
  // clock, and the columns built on it, and so the cells under the pointer).
  const rowsKey = rows.map((lead) => `${lead.id}:${lead.updatedAt}`).join(',');
  const [clock, setClock] = useState(() => ({ rowsKey, now: new Date() }));
  if (clock.rowsKey !== rowsKey) setClock({ rowsKey, now: new Date() });
  const { now } = clock;
  const table = useLeadsTable({
    rows,
    sorting: state.sorting,
    onSortingChange: state.setSorting,
    now,
  });

  const viewerId = state.viewer?.id ?? null;
  const canCreate = access.can('leads', 'create');
  const canClaim = access.can('leads', 'edit') && viewerId !== null;
  const ownerGone = (ownerId: string | null) => {
    if (ownerId === null) return true;
    const owner = state.staffById.get(ownerId);
    return owner !== undefined && !owner.active;
  };

  const newLead = (prefill?: { name: string; phone: string }) =>
    void navigate({
      ...organizationLeadCreate(organizationSlug),
      search: (previous: Record<string, unknown>) => ({ ...previous, ...prefill }),
      hash: true,
    });
  const openLead = (lead: LeadRecord) => {
    if (lead.unreadCount > 0) markRead.mutate(lead.id);
    setCreatedId(null);
    void navigate({
      ...organizationLead(organizationSlug, lead.id),
      search: true,
      hash: true,
    });
  };
  const claimLead = (lead: LeadRecord) => {
    if (viewerId === null) return;
    const owner = lead.ownerId ? state.staffById.get(lead.ownerId) : undefined;
    claim.mutate({
      lead,
      viewerId,
      ownerName: owner ? shortPersonName(personFullName(owner)) : null,
    });
  };

  /** The contact card's actions for a lead's person — the rows', the drawer's, the contact editor's. */
  const goTo = personNavigation(navigate, organizationSlug, pathname);
  const contactActions = (lead: LeadRecord): ContactCardActions => {
    const hold = leadHold(
      { ...lead, ownerGone: ownerGone(lead.ownerId) },
      LEAD_HOLD_DAYS,
      now,
    );
    const { patientId } = lead;
    return {
      onOpenPatientFile: patientId ? () => goTo.patient(patientId) : undefined,
      onNewLead: offer(canCreate, () => newLead({ name: lead.name, phone: lead.phone })),
      onNewAppointment: offer(access.can('appointments', 'create'), () =>
        goTo.newAppointment(lead.id),
      ),
      onNewPatient: offer(patientId === null && access.can('patients', 'create'), () =>
        goTo.newPatient(lead),
      ),
      onClaim: offer(canClaim && hold.open && lead.ownerId !== viewerId, () =>
        claimLead(lead),
      ),
    };
  };

  const closeDrawer = () =>
    void navigate({
      ...organizationLeads(organizationSlug),
      search: withoutPrefill,
      hash: true,
    });
  const drawerLead = dialog.kind === 'lead' ? dialog.lead : undefined;
  const drawer = drawerLead
    ? (() => {
        const lead = drawerLead;
        const owner = lead.ownerId ? state.staffById.get(lead.ownerId) : undefined;
        const hold = leadHold(
          { ...lead, ownerGone: ownerGone(lead.ownerId) },
          LEAD_HOLD_DAYS,
          now,
        );
        const mine = viewerId !== null && lead.ownerId === viewerId;
        const ownerShort = owner ? shortPersonName(personFullName(owner)) : null;
        return (
          <LeadDrawer
            lead={lead}
            staff={state.staff}
            staffById={state.staffById}
            viewer={state.viewer}
            canEdit={access.can('leads', 'edit')}
            canDelete={access.can('leads', 'delete')}
            canBook={access.can('appointments', 'create')}
            pane={pane}
            onPaneChange={setPane}
            onClose={closeDrawer}
            onConvert={() => convert.mutate({ id: lead.id, name: lead.name })}
            contactActions={contactActions(lead)}
            people={{
              onClaim:
                canClaim && hold.open && !mine && viewerId !== null && state.viewer
                  ? () =>
                      claim.mutate({
                        lead,
                        viewerId,
                        ownerName: ownerShort,
                        message: ownerShort
                          ? t(LEADS_KEYS.drawer.toasts.claimedAfter, {
                              me: shortPersonName(personFullName(state.viewer!)),
                              count: hold.idleDays,
                              owner: ownerShort,
                            })
                          : undefined,
                      })
                  : undefined,
              onRelease:
                mine && !hold.open && !hold.closed && viewerId !== null
                  ? () => release.mutate({ id: lead.id, viewerId })
                  : undefined,
              onAssign: (person) =>
                assign.mutate({
                  lead,
                  ownerId: person.id,
                  ownerName: personFullName(person),
                }),
              onToggleInvolved: (person, involved) =>
                setInvolved.mutate({
                  id: lead.id,
                  involvedIds: involved
                    ? [...lead.involvedIds, person.id]
                    : lead.involvedIds.filter((id) => id !== person.id),
                  message: t(
                    involved
                      ? LEADS_KEYS.drawer.toasts.addedInvolved
                      : LEADS_KEYS.drawer.toasts.removedInvolved,
                    { name: personFullName(person) },
                  ),
                }),
            }}
          />
        );
      })()
    : null;

  const context: LeadsTableContextValue = {
    staffById: state.staffById,
    staffUpdatedAt: state.staffUpdatedAt,
    viewerId,
    holdOf: (lead) =>
      leadHold({ ...lead, ownerGone: ownerGone(lead.ownerId) }, LEAD_HOLD_DAYS, now),
    canClaim,
    onClaim: claimLead,
    contactActions,
  };

  const empty = state.list.isPending ? (
    <SkeletonRows
      rows={8}
      avatar
      label={t(LEADS_KEYS.manifest.title)}
      rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
    />
  ) : (
    <div
      data-testid={LEADS_TEST_IDS.empty}
      className="flex flex-col items-center gap-3 p-5.5 text-center"
    >
      <p className="text-detail text-foreground-soft">{t(LEADS_KEYS.list.empty)}</p>
      {state.filtered ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={state.clearFilters}
          className="text-detail rounded-lg"
        >
          {t(LEADS_KEYS.list.clearFilters)}
        </Button>
      ) : null}
      {!state.filtered && canCreate ? (
        <EmptyStateAction onClick={() => newLead()}>
          {t(LEADS_KEYS.list.newLead)}
        </EmptyStateAction>
      ) : null}
    </div>
  );

  return (
    <section data-testid="leads-page" className="flex min-h-0 flex-1 flex-col">
      <LeadsToolbar
        view={state.view}
        onViewChange={state.setView}
        unreplied={state.unreplied}
        staff={state.staff}
        table={table}
        canCreate={canCreate}
        onNewLead={() => newLead()}
      />
      <LeadsTable
        table={table}
        context={context}
        list={state.list}
        openLeadId={leadId ?? createdId}
        onOpen={openLead}
        empty={empty}
      />
      <Outlet />
      {drawer}
      <NewLeadDialog
        dialog={dialog}
        canCreate={canCreate}
        staff={state.staff}
        viewer={state.viewer}
        onClose={closeDrawer}
        onCreated={(lead) => {
          setCreatedId(lead.id);
          closeDrawer();
        }}
        onOpenLead={(id) =>
          void navigate({
            ...organizationLead(organizationSlug, id),
            search: withoutPrefill,
            hash: true,
          })
        }
      />
    </section>
  );
}
