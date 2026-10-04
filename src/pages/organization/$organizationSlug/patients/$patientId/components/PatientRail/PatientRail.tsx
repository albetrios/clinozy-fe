import { cn } from '@/lib/utils.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';

import { PATIENT_RAIL_TEST_ID } from './patient-rail.constants.ts';
import { RailAbout } from './rail-about.tsx';
import { RailIdentity } from './rail-identity.tsx';
import { RailReach } from './rail-reach.tsx';
import { RailUpNext, type RailUpNextActions } from './rail-up-next.tsx';

/** Props of {@link PatientRail}. */
export interface PatientRailProps {
  file: PatientFile;
  /**
   * Identity only — a member who reads the billing sections alone (the
   * Accountant, Q-F1, AMBER A-F14): Reach, About and Up next hide.
   */
  limited?: boolean;
  /** The file's money mask (Q-F4) and its toggle — the due card's eye. */
  masked: boolean;
  onToggleMasked: () => void;
  /** "Edit contact" — hidden without Patients edit. */
  onEditContact?: () => void;
  /** Book / Reschedule, Collect, Feedback — each hidden when the member can't. */
  actions: RailUpNextActions;
  /** The rail's tier rule (the layout's: from `lg` with Activity closed, from `xl` open). */
  className?: string;
}

/**
 * The patient file's rail (KICKOFF §6.6 Rail; H:712–727): 288px at the
 * inline start of the main card, its identity fixed at the top, Reach and
 * About scrolling between, Up next fixed at the bottom. The layout decides
 * when it shows (D23).
 */
export function PatientRail({
  file,
  limited = false,
  masked,
  onToggleMasked,
  onEditContact,
  actions,
  className,
}: PatientRailProps) {
  return (
    <aside
      aria-label={patientName(file.patient)}
      data-testid={PATIENT_RAIL_TEST_ID}
      className={cn(
        'bg-card min-h-0 w-72 flex-none flex-col overflow-hidden border-e',
        className,
      )}
    >
      <RailIdentity patient={file.patient} onEditContact={onEditContact} />
      {limited ? null : (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <RailReach file={file} />
            <RailAbout file={file} />
          </div>
          <RailUpNext
            file={file}
            masked={masked}
            onToggleMasked={onToggleMasked}
            actions={actions}
          />
        </>
      )}
    </aside>
  );
}
