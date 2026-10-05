import { useTranslation } from 'react-i18next';

import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { useBookableStaff } from '@/shared/hooks/useAppointments/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { usePatientPrescriptions } from '@/shared/hooks/usePrescriptions/index.ts';
import { usePatientTreatments } from '@/shared/hooks/useTreatments/index.ts';

import { VISIT_KEYS, VISIT_NS } from '../../visits.constants.ts';

const K = VISIT_KEYS.consult;

/** How many earlier records the column lists (H:2526–2529 shows three). */
const HISTORY_LIMIT = 3;

/** One entry of "Relevant history": its heading and its line. */
interface HistoryEntry {
  id: string;
  /** For the order: newest first. */
  at: string;
  heading: string;
  text: string;
}

/**
 * "Relevant history" (KICKOFF §6.13; H:2524–2531): the patient's last three
 * prescriptions and sessions before this visit — "12 Aug · Dr. Mavani" over
 * the advice or the medicines, "12 Aug · Laser hair reduction · session 3"
 * over its settings and remark. The safety box waits for the allergies and
 * contraindications the schema lacks (Appendix F), so it is not shown.
 */
export function ConsultHistory({ detail }: { detail: VisitDetail }) {
  const { t } = useTranslation(VISIT_NS);
  const clock = useClinicClock();
  const staff = useBookableStaff().data ?? [];
  const patientId = detail.person.patientId ?? '';
  const prescriptions = usePatientPrescriptions(patientId).data ?? [];
  const treatments = usePatientTreatments(patientId).data ?? [];
  const nameOf = (id: string | null) => {
    const member = staff.find((candidate) => candidate.id === id);
    return member ? shortPersonName(personFullName(member)) : '';
  };
  const excluded = new Set([detail.prescription?.id, detail.treatment?.id]);

  const entries: HistoryEntry[] = [
    ...prescriptions
      .filter((rx) => !excluded.has(rx.id))
      .map((rx) => ({
        id: `rx-${rx.id}`,
        at: rx.createdAt,
        heading: t(K.historyEntry, {
          date: clock.date(rx.date),
          who: nameOf(rx.doctorId),
        }),
        text: rx.advice ?? rx.items.map((item) => item.medicineName).join(', '),
      })),
    ...treatments
      .filter((treatment) => !excluded.has(treatment.id))
      .map((treatment) => ({
        id: `session-${treatment.id}`,
        at: treatment.performedAt,
        heading: t(K.historyEntry, {
          date: clock.date(clock.dayOf(treatment.performedAt)),
          who: t(K.historySession, {
            name: treatment.name,
            session: treatment.sessionNo,
          }),
        }),
        text: [
          Object.entries(treatment.params)
            .filter(([key]) => key !== 'type' && key !== 'areas')
            .map(([, value]) => value)
            .join(', '),
          treatment.remark,
        ]
          .filter(Boolean)
          .join('. '),
      })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, HISTORY_LIMIT);

  return (
    <div className="bg-canvas flex min-h-0 flex-col gap-2.5 overflow-auto border-b px-4 py-3.5 max-md:overflow-visible max-md:px-3 md:border-e md:border-b-0">
      <h3 className="text-micro text-muted-foreground-strong font-normal tracking-[0.08em] uppercase">
        {t(K.history)}
      </h3>
      {entries.map((entry) => (
        <div key={entry.id} className="text-detail leading-[1.5]">
          <div className="font-medium">{entry.heading}</div>
          {entry.text}
        </div>
      ))}
    </div>
  );
}
