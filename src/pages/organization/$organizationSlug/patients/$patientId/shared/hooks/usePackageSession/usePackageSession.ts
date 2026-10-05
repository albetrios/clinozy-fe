import { useTranslation } from 'react-i18next';

import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-api.ts';
import { useConsumePackageSession } from '@/shared/hooks/usePatientPackages/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PATIENT_FILE_KEYS, PATIENT_FILE_NS } from '../../patient-file.constants.ts';

const K = PATIENT_FILE_KEYS.package;

/**
 * A package's session used by hand — Packages' "Use a session" and the
 * Overview's "Use session" (H:833, H:773): "Session 2 of 7 used", or "No
 * sessions left" when none is. The contract counts sessions only through
 * treatments (`S:452–466`) — a backend request.
 */
export function usePackageSession(): (row: PatientPackageRow) => void {
  const { t } = useTranslation(PATIENT_FILE_NS);
  const consume = useConsumePackageSession();
  return ({ package: record }) => {
    if (record.sessionsUsed >= record.sessionsTotal) {
      notify.info(t(K.noneLeft));
      return;
    }
    consume.mutate(record.id, {
      onSuccess: (saved) =>
        notify.success(
          t(K.sessionUsed, { used: saved.sessionsUsed, total: saved.sessionsTotal }),
        ),
    });
  };
}
