import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import type { RxSheetContext } from '@/shared/api/clinic/prescriptions-api.ts';
import { PrintPreview } from '@/shared/components/PrintPreview/index.ts';
import { PrescriptionPrint } from '@/shared/components/PrintTemplate/index.ts';

import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';

/** Props of {@link RxPrintPreview}. */
export interface RxPrintPreviewProps {
  prescription: Prescription;
  /** The patient, doctor, clinic and branch the sheet prints. */
  sheet: RxSheetContext;
  onClose: () => void;
}

/**
 * The prescription viewer — `prescriptions/$prescriptionId/` (`S:36`; KICKOFF
 * §6.6 Print preview; `patient-file.md:301–315`): the shared print preview
 * (820px, "Print preview · Prescription #500", Close and "Print / Save PDF")
 * holding the prescription's A4 sheet (L-22, the clinic's own identity).
 */
export function RxPrintPreview({ prescription, sheet, onClose }: RxPrintPreviewProps) {
  const { t } = useTranslation(RX_NS);
  return (
    <PrintPreview
      title={t(RX_KEYS.preview, { number: displayId.prescription(prescription.seq) })}
      sheet={
        <PrescriptionPrint
          prescription={prescription}
          patient={sheet.patient}
          doctor={sheet.doctor}
          organization={sheet.organization}
          branch={sheet.branch}
        />
      }
      onClose={onClose}
      testId={RX_TEST_IDS.preview}
    />
  );
}
