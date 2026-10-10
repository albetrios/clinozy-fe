import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { PrintPreview } from '@/shared/components/PrintPreview/index.ts';

import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';
import { type RxPrintable, type RxSheet, rxSheetElement } from './use-rx-sheet.tsx';

/** Props of {@link RxPrintPreview}. */
export interface RxPrintPreviewProps {
  prescription: RxPrintable;
  /** The patient, doctor, clinic and branch the sheet prints. */
  sheet: RxSheet;
  onClose: () => void;
}

/**
 * The prescription viewer — `prescriptions/$prescriptionId/` (`S:36`; KICKOFF
 * §6.6 Print preview; `patient-file.md:301–315`): the shared print preview
 * (820px, "Print preview · Prescription #500", Close and "Print / Save PDF")
 * holding the prescription's A4 sheet as it was read — the browser prints it;
 * there is no server PDF and no share (§6 #26).
 */
export function RxPrintPreview({ prescription, sheet, onClose }: RxPrintPreviewProps) {
  const { t } = useTranslation(RX_NS);
  return (
    <PrintPreview
      title={t(RX_KEYS.preview, { number: displayId.prescription(prescription.seq) })}
      sheet={rxSheetElement(prescription, sheet)}
      onClose={onClose}
      testId={RX_TEST_IDS.preview}
    />
  );
}
