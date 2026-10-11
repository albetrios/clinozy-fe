import { createContext, useContext } from 'react';

import type {
  AppointmentPerson,
  AppointmentRow,
} from '@/shared/api/app/appointments-contracts.ts';

import type { AppointmentStatusView } from '../AppointmentStatusPopover/index.ts';

/** Which row's Change status popover is open, and on which list. */
export interface AgendaStatusTarget {
  id: string;
  view: AppointmentStatusView;
}

/** What the Agenda's cells read from the page — live state, not baked into the columns. */
export interface AgendaCellsValue {
  /** The slot as the toasts name it — the Time column's "10:30 am". */
  timeOf: (appointment: AppointmentRow) => string;
  canEdit: boolean;
  /** When the team was read — the doctor's team card's "Updated HH:MM". */
  teamUpdatedAt: string | null;
  statusTarget: AgendaStatusTarget | null;
  setStatusTarget: (target: AgendaStatusTarget | null) => void;
  /** The contact card's "+ Lead" and "+ Appointment", where the member may. */
  onNewLead?: (person: AppointmentPerson) => void;
  onNewAppointment?: (person: AppointmentPerson) => void;
}

/**
 * The cells' live state. A context, not column-closure values: the cell
 * renderers stay one function each, so a state change never gives TanStack a
 * new renderer — which would remount every cell, closing its popover and cards.
 */
export const AgendaCellsContext = createContext<AgendaCellsValue | null>(null);

/** The Agenda cells' live state — inside `AgendaCellsContext`. */
export function useAgendaCells(): AgendaCellsValue {
  const value = useContext(AgendaCellsContext);
  if (!value) throw new Error('Agenda cells need an AgendaCellsContext');
  return value;
}
