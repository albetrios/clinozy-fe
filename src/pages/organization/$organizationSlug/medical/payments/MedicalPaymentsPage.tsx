import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { Wallet } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../medical.constants.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';

/**
 * Medical › Payments (KICKOFF §6.7; `medical.md:121–135`): the Payments ledger
 * limited to Medical (`scope=medical`, `S:71`) under the Medical toolbar. The
 * ledger is the Payments room's (L-39) and mounts here once it is shared;
 * until then the tab shows its empty state under the toolbar.
 */
export function MedicalPaymentsPage() {
  const { t } = useTranslation(MEDICAL_NS);
  return (
    <section data-testid="medical-payments-page" className="flex min-h-0 flex-1 flex-col">
      <MedicalToolbar tab="payments" />
      <div
        data-slot="medical-payments-ledger"
        className="bg-card m-(--room-card-margin) flex flex-1 flex-col rounded-xl border max-md:m-0 max-md:rounded-none max-md:border-0"
      >
        <h2 className="sr-only">{t(MEDICAL_KEYS.tabs.payments)}</h2>
        <EmptyState
          tone="blush"
          icon={<Wallet />}
          title={t(MEDICAL_KEYS.payments.empty)}
          description={t(MEDICAL_KEYS.empty.hint)}
        />
      </div>
    </section>
  );
}
