'use no memo';
// The table instance keeps its identity across state changes and is read
// through its methods (`getVisibleLeafColumns()` …): React Compiler
// memoisation would hand the toolbar's Columns chooser a stale answer.

import { Outlet, useLocation, useParams } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  organizationLead,
  organizationLeadCreate,
  organizationLeads,
} from '@/lib/routes/leads-builders.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import { leadHold } from '@/shared/api/clinic/leads-hold.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { referrerFromPath } from '@/shared/clinic/clinic-referrer.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';
import { EmptyState, EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import {
  LEAD_TOASTS_KEYS,
  useAssignLead,
  useClaimLead,
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

/**
 * Where a person's contact card goes: their file, a new appointment for the contact (an
 * appointment points at a contact, route map §4 #6). The design's "+ Patient" went with the
 * backend: a check-in opens the file (§4 #5, #7).
 */
function personNavigation(
  navigate: ReturnType<typeof useClinicNavigate>,
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

/** An action, or nothing where it does not apply (`false`) — the contact card hides the rest. */
function offered(action: (() => void) | false): (() => void) | undefined {
  return action === false ? undefined : action;
}

/**
 * The list's empty line (H:1745; `leads.md:393`): "No leads match" in the soft
 * ink, with "Clear filters" while filters are on, else "New lead" for a member
 * who may create.
 */
function LeadsEmpty({
  filtered,
  onClearFilters,
  onNewLead,
}: {
  filtered: boolean;
  onClearFilters: () => void;
  onNewLead?: () => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  let action: ReactNode;
  if (filtered) {
    action = (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClearFilters}
        className="text-detail rounded-lg"
      >
        {t(LEADS_KEYS.list.clearFilters)}
      </Button>
    );
  } else if (onNewLead) {
    action = (
      <EmptyStateAction onClick={onNewLead}>
        {t(LEADS_KEYS.list.newLead)}
      </EmptyStateAction>
    );
  }
  return (
    <EmptyState
      variant="inline"
      title={t(LEADS_KEYS.list.empty)}
      testId={LEADS_TEST_IDS.empty}
      className="text-foreground-soft flex flex-col items-center gap-3 p-5.5 text-center"
      action={action}
    />
  );
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
  const navigate = useClinicNavigate();
  const { organizationSlug = '', leadId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const claim = useClaimLead();
  const release = useReleaseLead();
  const assign = useAssignLead();
  const setInvolved = useSetLeadInvolved();
  // The lead New lead just created: first in the list and picked out (D28).
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { rows } = state.list;
  // One "now" per set of rows — the hold and the "Updated" words agree — read
  // again when the rows change (the stored-previous-value pattern, keyed on
  // the rows' ids and stamps: a refetch that brings the same rows keeps the
  // clock, and the columns built on it, and so the cells under the pointer).
  const rowsKey = rows
    .map((lead) => `${lead.id}:${lead.updatedAt}:${lead.lastActivityAt ?? ''}`)
    .join(',');
  const [clock, setClock] = useState(() => ({ rowsKey, now: new Date() }));
  if (clock.rowsKey !== rowsKey) setClock({ rowsKey, now: new Date() });
  const { now } = clock;
  const table = useLeadsTable({
    rows,
    sorting: state.sorting,
    onSortingChange: state.setSorting,
    now,
  });

  const { viewerId, team } = state;
  const canCreate = access.can('leads', 'create');
  const canEdit = access.can('leads', 'edit');
  // Claiming makes the caller the owner: only a member of the team claims (`403 not_a_member`).
  const canClaim = canEdit && viewerId !== null;
  const ownerShortName = (lead: LeadRecord) => {
    const owner = lead.ownerId ? team.get(lead.ownerId) : undefined;
    return owner ? shortPersonName(owner.name) : null;
  };

  const newLead = (prefill?: { name: string; phone: string }) =>
    void navigate({
      ...organizationLeadCreate(organizationSlug),
      search: (previous: Record<string, unknown>) => ({ ...previous, ...prefill }),
      hash: true,
    });
  const openLead = (lead: LeadRecord) => {
    setCreatedId(null);
    void navigate({
      ...organizationLead(organizationSlug, lead.id),
      search: true,
      hash: true,
    });
  };
  const claimLead = (lead: LeadRecord) => {
    if (!canClaim) return;
    claim.mutate({ lead, ownerName: ownerShortName(lead) });
  };
  /** Take over a lead someone holds: the viewer becomes its owner, the owner stays involved. */
  const takeOverLead = (lead: LeadRecord) => {
    const viewer = viewerId ? team.get(viewerId) : undefined;
    const owner = ownerShortName(lead);
    if (!(canClaim && viewer && owner)) return;
    assign.mutate({
      lead,
      ownerId: viewer.id,
      ownerName: viewer.name,
      message: t(LEAD_TOASTS_KEYS.claimed, { name: lead.name, owner }),
    });
  };

  /** The contact card's actions for a lead's person — the rows', the drawer's, the contact editor's. */
  const goTo = personNavigation(navigate, organizationSlug, pathname);
  const contactActions = (lead: LeadRecord): ContactCardActions => {
    const hold = leadHold(lead, now);
    const { patientId, phone } = lead;
    const canClaimLead = canClaim && hold.open && lead.ownerId !== viewerId;
    return {
      onOpenPatientFile: patientId ? () => goTo.patient(patientId) : undefined,
      onNewLead: offered(
        canCreate && phone !== null && (() => newLead({ name: lead.name, phone })),
      ),
      onNewAppointment: offered(
        access.can('appointments', 'create') &&
          (() => goTo.newAppointment(lead.contactId)),
      ),
      onClaim: offered(canClaimLead && (() => claimLead(lead))),
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
        const hold = leadHold(lead, now);
        const mine = viewerId !== null && lead.ownerId === viewerId;
        return (
          <LeadDrawer
            lead={lead}
            members={state.members}
            team={team}
            canEdit={canEdit}
            canDelete={access.can('leads', 'delete')}
            canEditContact={access.canCode('contact:update')}
            pane={pane}
            onPaneChange={setPane}
            onClose={closeDrawer}
            contactActions={contactActions(lead)}
            people={{
              onClaim: canClaim && hold.open && !mine ? () => claimLead(lead) : undefined,
              onRelease: mine && !hold.closed ? () => release.mutate(lead) : undefined,
              onAssign: (member) =>
                assign.mutate({ lead, ownerId: member.id, ownerName: member.name }),
              onToggleInvolved: (member, involved) =>
                setInvolved.mutate({
                  id: lead.id,
                  involvedIds: involved
                    ? [...lead.involvedIds, member.id]
                    : lead.involvedIds.filter((id) => id !== member.id),
                }),
            }}
          />
        );
      })()
    : null;

  const context: LeadsTableContextValue = {
    team,
    teamUpdatedAt: state.teamUpdatedAt,
    viewerId,
    holdOf: (lead) => leadHold(lead, now),
    canClaim,
    onClaim: claimLead,
    onTakeOver: takeOverLead,
    contactActions,
  };

  const empty = state.loading ? (
    <SkeletonRows
      rows={8}
      avatar
      label={t(LEADS_KEYS.manifest.title)}
      rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
    />
  ) : (
    <LeadsEmpty
      filtered={state.filtered}
      onClearFilters={state.clearFilters}
      onNewLead={canCreate ? () => newLead() : undefined}
    />
  );

  return (
    <section data-testid="leads-page" className="bg-canvas flex min-h-0 flex-1 flex-col">
      <LeadsToolbar
        view={state.view}
        onViewChange={state.setView}
        unreplied={state.unreplied}
        members={state.members}
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
        members={state.members}
        viewerId={viewerId}
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
