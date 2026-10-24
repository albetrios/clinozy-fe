import { cn } from '@/lib/utils.ts';
import type { PatientFile } from '@/shared/api/app/patient-file-contracts.ts';
import { patientName } from '@/shared/api/app/patients-contracts.ts';
import {
  ChatColumn,
  type ChatHistoryTarget,
} from '@/shared/components/ChatColumn/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useContactActivityAccess } from '@/shared/hooks/useContactActivities/index.ts';
import { useLead } from '@/shared/hooks/useLeads/index.ts';
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
 * chat column in its own card — the person's activity on clinozy-be (their
 * contact's, which their lead shares), with the history pills and the
 * composer; "Send via" shows icons only, the column being under
 * 460px. Below `md` the card loses its radius and side borders and takes the
 * whole body (the layout hides the main card). The divider names the lead the
 * file came from (`lead_id`, P10) for a member who reads leads, and never says
 * "no lead" for a patient who has one. The layout mounts it only for a member
 * who reads the stream (`contact_activity:read`); the composer needs
 * `contact_activity:create` — the codes in force, a View-as preview's too.
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
  const access = useAppAccess();
  // A lead of another branch is a 404 to this member: the divider then only says there was one.
  const lead = useLead(
    access.canCode('lead:read') ? (patient.leadId ?? undefined) : undefined,
    { notifyOnError: false },
  ).data;
  const stream = useContactActivityAccess();
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
        person={{ kind: 'contact', contactId: patient.contactId }}
        contact={{
          name: patientName(patient),
          phone: patient.phone,
          isPatient: true,
          instagram: file.instagram,
        }}
        lead={
          lead
            ? {
                leadId: lead.id,
                kind: lead.kind,
                createdAt: lead.createdAt,
                source: lead.source,
                patientId: lead.patientId,
              }
            : undefined
        }
        hasLead={patient.leadId !== null}
        maskMoney={masked}
        canSend={stream.writes}
        onOpenHistory={onOpenHistory}
        onBookAppointment={onBookAppointment ? () => onBookAppointment() : undefined}
      />
    </div>
  );
}
