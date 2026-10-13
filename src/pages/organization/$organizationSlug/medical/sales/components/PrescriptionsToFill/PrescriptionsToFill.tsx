import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { RoomViewAction } from '@/shared/components/RoomToolbar/index.ts';
import { Pill } from '@/shared/icons/index.ts';

import {
  MEDICAL_KEYS,
  MEDICAL_NS,
  MEDICAL_TABLE_IDS,
} from '../../../medical.constants.ts';
import { useMedicalDates } from '../../../shared/components/MedicalCells/medical-dates.ts';
import { usePrescriptionsToFill } from '../../../shared/hooks/useMedicalFlows/index.ts';
import type { PrescriptionToFill } from '../../../shared/medical-contracts.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';

/** Props of {@link PrescriptionsToFill}. */
export interface PrescriptionsToFillProps {
  /** A prescription picked: New sale opens on it. */
  onPick: (prescription: PrescriptionToFill) => void;
}

/**
 * "Prescriptions to fill" (KICKOFF §6.7 Popups; `medical.md:417–431`): Sales'
 * view action with Status All — a 340px list under the button (a bottom sheet
 * on a phone) of the approved prescriptions no sale has filled, newest first
 * (`GET /app/patient-prescriptions?status=approved&is_filled=false`, MD29): the
 * patient, "Rx #500 · 17 Sep · Flubolt 400, Clonix-B Lotion". Picking one
 * opens New sale on it — its patient and the prescription. Hidden while every
 * prescription is filled.
 */
export function PrescriptionsToFill({ onPick }: PrescriptionsToFillProps) {
  const { t } = useTranslation(MEDICAL_NS);
  const { t: tDrawer } = useTranslation(MEDICAL_DRAWERS_NS);
  const dates = useMedicalDates();
  const list = usePrescriptionsToFill().data ?? [];
  if (list.length === 0) return null;
  const label = t(MEDICAL_KEYS.viewActions.prescriptions);
  return (
    <Picker
      menu
      label={label}
      value={null}
      options={list.map((rx) => ({
        key: rx.id,
        label: rx.patientName,
        sub: tDrawer(MEDICAL_DRAWER_KEYS.prescriptions.sub, {
          rx: displayId.prescription(rx.seq),
          date: dates.day(rx.date),
          medicines: rx.medicines.join(', '),
        }),
        leading: { kind: 'icon', icon: Pill },
        tone: 'blush',
        data: rx,
      }))}
      onChange={(_id, option) => {
        if (option?.data) onPick(option.data);
      }}
      minWidth={340}
      testId={MEDICAL_DRAWER_TEST_IDS.prescriptions}
      className="flex flex-none"
      renderTrigger={() => (
        <RoomViewAction
          actionId="prescriptions"
          tableId={MEDICAL_TABLE_IDS.sales}
          icon={Pill}
          label={label}
        />
      )}
    />
  );
}
