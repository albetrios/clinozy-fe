import { useParams } from '@tanstack/react-router';

import {
  organizationAppointment,
  organizationAppointmentCreate,
} from '@/lib/routes/appointments-builders.ts';
import { safeReferrer } from '@/shared/clinic/clinic-referrer.ts';
import { AppointmentForm } from '@/shared/forms/AppointmentForm/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { useCrossRoomDialog } from '@/shared/hooks/useCrossRoomDialog/index.ts';

import { useAppointmentsDialogRoute } from '../../hooks/useAppointmentsDialogRoute/index.ts';
import { useAppointmentsNavigation } from '../../hooks/useAppointmentsNavigation/index.ts';

/**
 * The appointment form while the URL names a dialog route: `create/` in New
 * mode (a chat or task `source` starts step 1 collapsed), `$appointmentId/`
 * in Edit or Reschedule. A new booking closes onto its day; Copy opens
 * `create/?copyOf=`, a chat's "Appointment #…" chip that booking. Rendered by
 * the Appointments page over itself, and by the app's cross-room host over
 * the room a booking was opened from (A-P1) — where Copy and the chip keep
 * that room behind them too.
 */
export function AppointmentDialog() {
  const { dialog, close } = useAppointmentsDialogRoute();
  const navigation = useAppointmentsNavigation();
  const crossRoom = useCrossRoomDialog();
  const go = useClinicNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const from = crossRoom ? safeReferrer(crossRoom.search.from, '') : '';
  const openCreate = (copyOf: string) =>
    from
      ? void go({
          ...organizationAppointmentCreate(organizationSlug),
          search: { copyOf, from },
        })
      : navigation.openCreate({ copyOf });
  const openAppointment = (id: string) =>
    from
      ? void go({ ...organizationAppointment(organizationSlug, id), search: { from } })
      : navigation.openAppointment(id);

  if (dialog.kind === 'none') return null;
  if (dialog.kind === 'create') {
    const { prefill } = dialog;
    return (
      <AppointmentForm
        open
        mode="create"
        prefill={{
          whoId: prefill.who,
          date: prefill.date,
          time: prefill.time,
          doctorId: prefill.doctorId,
          copyOf: prefill.copyOf,
          collapsed: prefill.source !== undefined,
        }}
        onClose={() => close()}
        onSaved={(outcome) => close({ date: outcome.appointment.date })}
      />
    );
  }
  return (
    <AppointmentForm
      open
      mode={dialog.mode}
      appointmentId={dialog.appointmentId}
      appointment={dialog.appointment}
      readOnly={dialog.readOnly}
      onClose={() => close()}
      onSaved={() => close()}
      onCopy={(appointment) => openCreate(appointment.id)}
      onOpenAppointment={openAppointment}
    />
  );
}
