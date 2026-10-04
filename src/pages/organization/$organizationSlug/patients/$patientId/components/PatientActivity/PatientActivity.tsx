import { cn } from '@/lib/utils.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import {
  ChatColumn,
  type ChatHistoryTarget,
} from '@/shared/components/ChatColumn/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

/** The Activity column's test id. */
export const PATIENT_ACTIVITY_TEST_ID = 'patient-file-activity-column';

/** Props of {@link PatientActivity}. */
export interface PatientActivityProps {
  file: PatientFile;
  /** The file's money mask: every ₹ in the history reads "₹ ••••" (Q-F4, H:4848). */
  masked: boolean;
  /** A history chip was clicked: the appointment or the file's section. */
  onOpenHistory: (target: ChatHistoryTarget) => void;
  /** "Book an appointment" — hidden without Appointments create. */
  onBookAppointment?: () => void;
  className?: string;
}

/**
 * The patient file's Activity column (KICKOFF §6.6; H:837–873): the shared
 * chat column in its own card — the patient's thread, their lead's or the
 * contact thread their first message opens (Q-F6), with the history pills
 * and the composer; "Send via" shows icons only, the column being under
 * 460px. Below `md` the card loses its radius and side borders and takes the
 * whole body (the layout hides the main card).
 */
export function PatientActivity({
  file,
  masked,
  onOpenHistory,
  onBookAppointment,
  className,
}: PatientActivityProps) {
  const phone = useViewportTier() === 'phone';
  const { patient } = file;
  return (
    <div
      data-slot={phone ? 'patient-activity' : 'card'}
      data-testid={PATIENT_ACTIVITY_TEST_ID}
      className={cn(
        'bg-card flex min-h-0 flex-col overflow-hidden rounded-xl border max-md:rounded-none max-md:border-x-0',
        className,
      )}
    >
      <ChatColumn
        person={{ kind: 'patient', patientId: patient.id }}
        contact={{
          name: patientName(patient),
          phone: patient.phone,
          isPatient: true,
          instagram: file.instagram,
        }}
        maskMoney={masked}
        onOpenHistory={onOpenHistory}
        onBookAppointment={onBookAppointment ? () => onBookAppointment() : undefined}
      />
    </div>
  );
}
