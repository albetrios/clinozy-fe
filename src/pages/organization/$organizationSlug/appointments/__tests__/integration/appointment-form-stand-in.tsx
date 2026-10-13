import type { AppointmentFormProps } from '@/shared/forms/AppointmentForm/index.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';

import { STAND_IN_BOOKED_DATE, STAND_IN_OTHER_ID } from './appointments-test-data.ts';

/**
 * The shared appointment form as the room's tests see it — its props and its callbacks; the
 * form itself is `AppointmentForm`'s own suites'. Swap it in with
 * `vi.mock('@/shared/forms/AppointmentForm/index.ts', …)`: "Save" books on
 * {@link STAND_IN_BOOKED_DATE} (New) or saves the booking as read (Edit), "Copy" copies the
 * booking, "Open" follows a chat's "Appointment #…" chip.
 */
export function AppointmentFormStandIn(props: AppointmentFormProps) {
  const { appointment } = props;
  return (
    <section aria-label="Appointment form" data-testid="appointment-form-stand-in">
      <output data-testid="form">
        {JSON.stringify({
          mode: props.mode,
          prefill: props.prefill,
          appointmentId: props.appointmentId,
          seq: appointment?.seq ?? null,
          readOnly: props.readOnly ?? false,
        })}
      </output>
      <button type="button" onClick={props.onClose}>
        Close
      </button>
      <button
        type="button"
        onClick={() =>
          props.onSaved?.(
            props.mode === 'create'
              ? {
                  kind: 'created',
                  appointment: appointmentRow({ date: STAND_IN_BOOKED_DATE }),
                }
              : { kind: 'updated', appointment: appointment ?? appointmentRow() },
          )
        }
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          if (appointment) props.onCopy?.(appointment);
        }}
      >
        Copy
      </button>
      <button type="button" onClick={() => props.onOpenAppointment?.(STAND_IN_OTHER_ID)}>
        Open
      </button>
    </section>
  );
}
