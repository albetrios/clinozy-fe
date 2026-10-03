import {
  organizationAppointmentCreate,
  organizationLead,
  organizationLeadCreate,
} from '@/lib/routes/builders.ts';

import { CLINIC_SECTION_ROUTES } from './clinic-home.ts';

/** One ⌘K destination. */
export type ClinicCommandTarget =
  | 'newLead'
  | 'newAppointment'
  | 'newPatient'
  | 'newReceipt'
  | 'openTasks'
  | 'patient'
  | 'lead'
  | 'invoice';

/**
 * Where ⌘K's clinic rows go (KICKOFF §6.0 Command menu; D24, D19 / D26): each
 * route's full path, `organizationSlug` its first param — navigated the way
 * the nav's `AppNavEntry.to` is. A route with a builder (`src/lib/routes`)
 * takes its path from it; the others land with later ledger rows, and until
 * one does its row lands on the org's not-found route (the role home and a
 * "Page not found" toast):
 *
 * | Target           | Route                  | Lands with                     |
 * | ---------------- | ---------------------- | ------------------------------ |
 * | `newLead`        | `/leads/create`        | live (L-33; the form L-35)     |
 * | `newAppointment` | `/appointments/create` | live (L-36; the form L-38)     |
 * | `newPatient`     | `/patients/create`     | L-32b                          |
 * | `newReceipt`     | `/payments/receive`    | L-39b                          |
 * | `openTasks`      | `/tasks`               | live                           |
 * | `patient`        | `/patients/$patientId` | L-42                           |
 * | `lead`           | `/leads/$leadId`       | live (L-33; the drawer L-34b)  |
 * | `invoice`        | `/invoices/$invoiceId` | L-40                           |
 *
 * Plain strings on purpose: a literal no registered route has yet would not
 * type-check as a `to`. When a row adds a route's builder, it swaps its
 * string here for the builder's path.
 */
export const CLINIC_COMMAND_TARGETS: Readonly<Record<ClinicCommandTarget, string>> = {
  // A builder's `to` is the route's path; the slug and id ride in its params.
  newLead: organizationLeadCreate('').to,
  newAppointment: organizationAppointmentCreate('').to,
  newPatient: '/organization/$organizationSlug/patients/create',
  newReceipt: '/organization/$organizationSlug/payments/receive',
  openTasks: CLINIC_SECTION_ROUTES.tasks,
  patient: '/organization/$organizationSlug/patients/$patientId',
  lead: organizationLead('', '').to,
  invoice: '/organization/$organizationSlug/invoices/$invoiceId',
};

/** The record param of a record target's route. */
const RECORD_PARAM: Readonly<Partial<Record<ClinicCommandTarget, string>>> = {
  patient: 'patientId',
  lead: 'leadId',
  invoice: 'invoiceId',
};

/**
 * The drawers that keep the page they open from behind them through `from`
 * (KICKOFF §4: `/invoices/*`, `/payments/receive`, `/appointments/create`);
 * the others open over their own room.
 */
const KEEPS_REFERRER: ReadonlySet<ClinicCommandTarget> = new Set([
  'newAppointment',
  'newReceipt',
  'invoice',
]);

/** A ⌘K navigation: a `to` with its params and search, as `navigate()` takes it. */
export interface ClinicCommandNavigation {
  to: string;
  params: Record<string, string>;
  search?: Record<string, string>;
}

/**
 * The navigation to a target: its route, the org slug and record id as params,
 * `from` when the target keeps its referrer and the page it opens from is an
 * allowed one (`referrerFromPath`), and any other search the row adds (the
 * patient file's `activity`).
 */
export function clinicCommandNavigation(
  target: ClinicCommandTarget,
  context: {
    organizationSlug: string;
    recordId?: string;
    referrer?: string | null;
    search?: Record<string, string>;
  },
): ClinicCommandNavigation {
  const param = RECORD_PARAM[target];
  const search = {
    ...context.search,
    ...(KEEPS_REFERRER.has(target) && context.referrer ? { from: context.referrer } : {}),
  };
  return {
    to: CLINIC_COMMAND_TARGETS[target],
    params: {
      organizationSlug: context.organizationSlug,
      ...(param && context.recordId ? { [param]: context.recordId } : {}),
    },
    ...(Object.keys(search).length > 0 ? { search } : {}),
  };
}
