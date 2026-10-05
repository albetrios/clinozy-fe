import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import {
  fetchRxSheetContext,
  type RxCatalog,
} from '@/shared/api/clinic/prescriptions-api.ts';
import type { VisitDetail, VisitNote } from '@/shared/api/clinic/visits-contracts.ts';
import {
  PrescriptionPrint,
  printDocument,
} from '@/shared/components/PrintTemplate/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useRxCatalog } from '@/shared/hooks/usePrescriptions/index.ts';
import { useApproveVisitRx } from '@/shared/hooks/useVisits/index.ts';
import { notify } from '@/shared/notify/index.ts';

import type { VisitSave } from '../../hooks/useVisitSave/index.ts';
import {
  useVisitDraft,
  type VisitDraft,
  type VisitDraftLine,
} from '../../store/useVisitDraftStore/index.ts';
import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';
import { addedLine, approveReadiness, copiedLines } from '../../visits.rx.ts';
import { NeedsPatient } from '../VisitSheet/needs-patient.tsx';
import { ConsultHistory } from './consult-history.tsx';
import { ConsultNote } from './consult-note.tsx';
import { RxLines } from './rx-lines.tsx';

const K = VISIT_KEYS.consult;
const ids = VISIT_TEST_IDS.consult;

/** How many "Add" chips the row offers (H:3499 shows three). */
const ADD_CHIPS = 3;

/** Props of {@link VisitConsult}. */
export interface VisitConsultProps {
  detail: VisitDetail;
  save: VisitSave;
  /** Approve closes the sheet. */
  onClose: () => void;
}

/** Print the approved Rx on the A4 sheet (L-22): the patient, doctor, clinic and branch it names. */
async function printApproved(prescription: Prescription): Promise<void> {
  const sheet = await fetchRxSheetContext(prescription.patientId, prescription.doctorId);
  await printDocument(
    <PrescriptionPrint
      prescription={prescription}
      patient={sheet.patient}
      doctor={sheet.doctor}
      organization={sheet.organization}
      branch={sheet.branch}
    />,
  );
}

/** The note and the Rx lines the tab shows: the approved ones (read-only) once approved, else the draft's. */
function consultContent(
  detail: VisitDetail,
  draft: VisitDraft,
): { note: VisitNote; lines: VisitDraftLine[] } {
  const approved = detail.prescription;
  if (!approved) {
    const { complaint, findings, diagnoses, plan, lines } = draft;
    return { note: { complaint, findings, diagnoses, plan }, lines };
  }
  return {
    note: detail.visit.note ?? { complaint: '', findings: '', diagnoses: [], plan: '' },
    lines: approved.items.map((item, index) => ({
      key: `approved-${index}`,
      item,
      reviewed: true,
    })),
  };
}

/** The "Add" row: the clinic's most prescribed that the Rx doesn't name yet. */
function AddChips({
  suggestions,
  catalog,
  onAdd,
}: {
  suggestions: readonly string[];
  catalog: RxCatalog | undefined;
  onAdd: (line: VisitDraftLine) => void;
}) {
  const { t } = useTranslation(VISIT_NS);
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.25 pt-1">
      <span className="text-muted-foreground-strong text-xs">{t(K.add)}</span>
      {suggestions.map((name) => {
        const medicine = catalog?.medicines.find((row) => row.name === name);
        return (
          <button
            key={name}
            type="button"
            onClick={() =>
              onAdd(addedLine(name, medicine?.medicineId ?? null, medicine?.last ?? null))
            }
            data-testid={ids.add}
            className="hover:bg-muted rounded-md border bg-transparent px-2.25 py-0.75 text-xs"
          >
            {t(K.addChip, { name })}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Visit sheet › Consult & Rx (KICKOFF §6.13; `today.md:78–93, 255–259`;
 * H:2523–2579, H:4617–4621): "Relevant history", the consult note and the
 * prescription — copy the last Rx (each line unreviewed), "Add" the clinic's
 * most prescribed, review every line, print in English (Q-X2), then "Approve ·
 * print · send to pharmacy": one write (the Rx with the visit's booking and the
 * note on the visit), the A4 print, the sheet closes, and the card moves to
 * Treatment (a session due) or Checkout. Until Approve the draft survives
 * closing the sheet (the page store). Three columns from `md`, one below.
 */
export function VisitConsult({ detail, save, onClose }: VisitConsultProps) {
  const { t } = useTranslation(VISIT_NS);
  const clock = useClinicClock();
  const visitId = detail.visit.id;
  const { draft, update } = useVisitDraft(visitId);
  const approve = useApproveVisitRx();
  const patientId = detail.person.patientId;
  const catalog = useRxCatalog(patientId ?? '').data;

  if (!patientId) return <NeedsPatient />;

  const approved = detail.prescription;
  const { note, lines } = consultContent(detail, draft);
  const { ready, pending } = approveReadiness(lines);
  const busy = approve.isPending;
  const named = new Set(lines.map((line) => line.item.medicineName.toLowerCase()));
  const suggestions = (catalog?.often ?? [])
    .filter((name) => !named.has(name.toLowerCase()))
    .slice(0, ADD_CHIPS);

  let approveLabel = t(K.approve);
  if (busy) approveLabel = t(K.approving);
  else if (lines.length === 0) approveLabel = t(K.reviewNone);
  else if (!ready) approveLabel = t(K.reviewFirst, { count: pending });

  const onApprove = () => {
    if (!ready || busy) return;
    const stageBefore = detail.visit.stage;
    void save.run(
      () =>
        approve.mutateAsync({
          visitId,
          note,
          items: lines.map((line) => line.item),
          language: draft.language,
        }),
      ({ visit, prescription }) => {
        update({ complaint: '', findings: '', diagnoses: [], plan: '', lines: [] });
        void printApproved(prescription);
        const moved =
          visit.stage !== stageBefore &&
          (visit.stage === 'treatment' || visit.stage === 'checkout');
        const values = { name: detail.person.name, language: t(K.languages.en) };
        notify.success(
          moved
            ? t(K.approved, {
                ...values,
                lane: t(K.movedTo[visit.stage as 'treatment' | 'checkout']),
              })
            : t(K.approvedHere, values),
        );
        onClose();
      },
    );
  };

  return (
    <div
      data-testid={ids.root}
      className="grid h-full min-h-0 grid-cols-1 max-md:h-auto md:grid-cols-[240px_minmax(0,1fr)_minmax(0,1.15fr)]"
    >
      <ConsultHistory detail={detail} />
      <ConsultNote
        note={note}
        readOnly={Boolean(approved)}
        onChange={(patch) => update(patch)}
      />
      <div className="flex min-h-0 flex-col gap-2.5 border-t px-4.5 py-3.5 max-md:px-3 md:border-s md:border-t-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-title font-semibold tracking-[-0.02em]">
            {t(K.rx)}
          </h3>
          {!approved && detail.lastPrescription ? (
            <button
              type="button"
              onClick={() => {
                if (detail.lastPrescription)
                  update({ lines: copiedLines(detail.lastPrescription) });
              }}
              data-testid={ids.copyLast}
              className="text-detail hover:bg-muted rounded-lg border bg-transparent px-2.75 py-1.25 font-medium shadow-(--elevation-control)"
            >
              {t(K.copyLast, { date: clock.date(detail.lastPrescription.date) })}
            </button>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto max-md:overflow-visible">
          {approved ? (
            <p
              data-testid={ids.approved}
              className="text-body border-tone-sage-border bg-tone-sage text-tone-sage-foreground rounded-lg border px-3 py-2.5"
            >
              {t(K.approvedLine, {
                number: displayId.prescription(approved.seq),
                count: approved.items.length,
              })}
            </p>
          ) : null}
          <RxLines
            lines={lines}
            readOnly={Boolean(approved)}
            onChange={(next) => update({ lines: next })}
          />
          {approved ? null : (
            <AddChips
              suggestions={suggestions}
              catalog={catalog}
              onAdd={(line) => update((current) => ({ lines: [...current.lines, line] }))}
            />
          )}
        </div>
        {approved ? null : (
          <>
            <div className="text-muted-foreground-strong flex items-center gap-1.5 text-xs">
              {t(K.printIn)}
              <span
                data-slot="pill"
                aria-current="true"
                className="bg-tone-butter text-foreground rounded-full border px-2.5 py-0.75 text-xs"
              >
                {t(K.languages.en)}
              </span>
            </div>
            <button
              type="button"
              aria-disabled={!ready || busy}
              onClick={onApprove}
              data-testid={ids.approve}
              className={cn(
                'bg-tone-butter text-foreground rounded-lg border px-3.5 py-2.5 text-sm font-medium max-md:min-h-11',
                ready ? 'border-primary' : 'cursor-not-allowed opacity-55',
              )}
            >
              {approveLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
