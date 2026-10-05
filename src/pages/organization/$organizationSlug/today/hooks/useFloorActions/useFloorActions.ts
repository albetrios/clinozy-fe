import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import type { TodayFloorRow, TodayLane } from '@/shared/api/clinic/today-contracts.ts';
import {
  type ClinicCommandNavigation,
  clinicCommandNavigation,
} from '@/shared/clinic/clinic-command-targets.ts';
import { taskTargetNavigation } from '@/shared/clinic/task-targets.ts';
import { canUseVisitTab, type VisitTab } from '@/shared/clinic/visit-access.ts';
import { useSetAppointmentStatus } from '@/shared/hooks/useAppointments/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useSetVisitStage, useUndoVisitChange } from '@/shared/hooks/useVisits/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { TODAY_KEYS, TODAY_NS } from '../../today.constants.ts';
import { rememberVisitCard } from '../../today.focus.ts';
import type { TodayCard } from '../../today.lanes.ts';

/** A booking's card (the lanes past Enquiries). */
type BookingCard = Extract<TodayCard, { kind: 'booking' }>;

/** The room path Today's drawers keep behind them (`from`, KICKOFF §4). */
const REFERRER = 'today';

/** What the floor's cards do. */
export interface FloorActions {
  /** A card's lane action, or null when the member can't take it (hidden, §3.7). */
  actionOf: (card: TodayCard) => (() => void) | null;
  /** The name and service area: the lead, else the patient file, else a toast. */
  open: (card: TodayCard) => void;
}

/**
 * The floor's actions (KICKOFF §6.2 lanes table, Stage machine): "Book" opens
 * the enquiry's lead drawer; "Check in" moves the booking to Checked in and
 * "Send in" moves its visit to the doctor — both at once, with their own toast
 * and Undo, which reverts the side effects too; "Open consult", "Open
 * session" and "Checkout" open the Visit sheet on their tab; "Dispense" opens
 * the sale drawer from the Rx. Each is hidden from a member who can't take
 * it: Book needs Leads View, Check in and Send in Appointments Edit, the
 * Visit's tab its own access (§6.13), Dispense Medical Create.
 */
export function useFloorActions(organizationSlug: string): FloorActions {
  const { t } = useTranslation(TODAY_NS);
  const navigate = useNavigate();
  const access = useClinicAccess();
  const checkIn = useSetAppointmentStatus({
    announce: ({ appointment }) =>
      t(TODAY_KEYS.toasts.checkedIn, { name: appointment.person.name }),
  });
  const moveStage = useSetVisitStage();
  const undoStage = useUndoVisitChange();
  const go = (navigation: ClinicCommandNavigation) => void navigate(navigation);
  const canEditBookings = access.can('appointments', 'edit');

  const sendIn = async (card: TodayCard) => {
    try {
      const change = await moveStage.mutateAsync({
        appointmentId: card.id,
        stage: 'with_doctor',
      });
      notify.undo(t(TODAY_KEYS.toasts.sentIn, { name: card.name }), {
        onUndo: () => undoStage.mutate(change.undoToken),
      });
    } catch {
      // The write's hook has toasted its error, and the card is back in Waiting.
    }
  };

  const openLead = (leadId: string) =>
    go(taskTargetNavigation({ kind: 'lead', leadId }, organizationSlug, REFERRER));

  /** "Dispense": the sale drawer, prefilled from the Rx. */
  const dispense = (row: TodayFloorRow) => {
    const prescription = row.prescription?.id;
    if (!(prescription && access.can('medical', 'create'))) return null;
    return () =>
      go(
        clinicCommandNavigation('newSale', {
          organizationSlug,
          referrer: REFERRER,
          search: { prescription },
        }),
      );
  };

  /** "Open consult" · "Open session" · "Checkout": the Visit sheet on the lane's tab. */
  const openVisit = (row: TodayFloorRow, tab: VisitTab) => {
    if (!canUseVisitTab(tab, access)) return null;
    return () => {
      // A visit the floor moved a moment ago has no id until the refetch.
      if (!row.visit?.id) return;
      rememberVisitCard(row.id);
      go(
        clinicCommandNavigation('visit', {
          organizationSlug,
          recordId: row.visit.id,
          search: { tab },
        }),
      );
    };
  };

  /** Each lane's card action, or null when the member can't take it. */
  const laneActions: Readonly<
    Record<TodayLane, (card: BookingCard) => (() => void) | null>
  > = {
    enquiries: () => null,
    arriving: ({ row }) =>
      canEditBookings ? () => checkIn.mutate({ id: row.id, status: 'checked_in' }) : null,
    waiting: (card) => (canEditBookings ? () => void sendIn(card) : null),
    with_doctor: ({ row }) => openVisit(row, 'consult'),
    treatment: ({ row }) => openVisit(row, 'treatment'),
    checkout: ({ row }) => openVisit(row, 'checkout'),
    pharmacy: ({ row }) => dispense(row),
  };

  const actionOf: FloorActions['actionOf'] = (card) => {
    if (card.kind === 'booking') return laneActions[card.lane](card);
    return access.can('leads', 'view') ? () => openLead(card.id) : null;
  };

  const open: FloorActions['open'] = (card) => {
    if (card.kind === 'enquiry') {
      openLead(card.id);
      return;
    }
    const { person } = card.row;
    if (person.patientId) {
      go(
        taskTargetNavigation(
          { kind: 'patient', patientId: person.patientId, section: 'timeline' },
          organizationSlug,
          REFERRER,
        ),
      );
      return;
    }
    // A chat-only contact has a thread, not a lead the Leads room shows.
    if (person.leadId && person.kind === 'lead') {
      openLead(person.leadId);
      return;
    }
    notify.info(t(TODAY_KEYS.toasts.noRecord, { name: card.name }));
  };

  return { actionOf, open };
}
