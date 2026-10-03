import type { TFunction } from 'i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type {
  Branch,
  Organization,
  Patient,
  Prescription,
  PrescriptionItem,
  User,
} from '@/shared/api/clinic/clinic-schema.ts';
import { civilYearsBetween } from '@/shared/api/clinic/clinic-time.ts';
import {
  usePrintFormat,
  usePrintTranslation,
} from '@/shared/components/PrintTemplate/print-format.ts';
import {
  PRINT_TEMPLATE_KEYS,
  PRINT_TEMPLATE_TEST_IDS,
} from '@/shared/components/PrintTemplate/print-template.constants.ts';
import {
  PrintBox,
  PrintField,
  PrintFooter,
  PrintSheet,
} from '@/shared/components/PrintTemplate/PrintTemplate.tsx';

const keys = PRINT_TEMPLATE_KEYS.prescription;

/** Medicine · Dosage · When · Where · Qty. · Remark (H:470); the last takes the rest. */
const COLUMN_WIDTHS = [
  'w-[49.45mm]',
  'w-[15.78mm]',
  'w-[32.37mm]',
  'w-[50.75mm]',
  'w-[10.25mm]',
  undefined,
] as const;

const fullName = (person: Pick<Patient, 'firstName' | 'lastName'>) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ');

/** "1 - 0 - 1" morning-afternoon-night, "SOS", or both; blank when neither (H:4425). */
function dosage(
  item: PrescriptionItem,
  t: TFunction,
  count: (value: number) => string,
): string {
  const parts: string[] = [];
  if (item.doseMorning || item.doseAfternoon || item.doseNight) {
    parts.push(
      [item.doseMorning, item.doseAfternoon, item.doseNight].map(count).join(' - '),
    );
  }
  if (item.sos) parts.push(t(keys.sos));
  return parts.join(' · ');
}

/** The meal, the timing and any free-text timing of a line. */
function when(item: PrescriptionItem, t: TFunction): string {
  return [
    item.meal ? t(keys.meal[item.meal]) : null,
    item.timing ? t(keys.timing[item.timing]) : null,
    item.timingText,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Where it is applied: a listed place, or the line's own words for any other. */
function where(item: PrescriptionItem, t: TFunction): string {
  if (item.bodyPart && item.bodyPart !== 'other') return t(keys.bodyPart[item.bodyPart]);
  return item.bodyPartText ?? '';
}

/** What the prescription sheet prints from. */
export interface PrescriptionPrintProps {
  /** The prescription. */
  prescription: Prescription;
  /** Its patient: name, patient code and date of birth (the age on the Rx's date). */
  patient: Pick<Patient, 'firstName' | 'lastName' | 'seq' | 'dateOfBirth'>;
  /** The prescribing doctor. */
  doctor?: Pick<User, 'firstName' | 'lastName'> | null;
  /** The clinic: its name and specialties for the footer. */
  organization: Pick<Organization, 'name' | 'specialties'>;
  /** The branch it is printed at: its phone and GSTIN for the footer. */
  branch: Pick<Branch, 'phone' | 'gstNumber'>;
}

/**
 * The A4 prescription (KICKOFF §6.6, §6.13; H:455–514): the patient and the
 * prescription's details, the medicines with dosage, when, where, quantity and
 * remark, the lab reports, today's procedures, the advice, the follow-up date,
 * a space for the doctor's signature, and the clinic's footer. Presentational —
 * the caller passes every record; nothing is fetched here.
 */
export function PrescriptionPrint({
  prescription,
  patient,
  doctor = null,
  organization,
  branch,
}: PrescriptionPrintProps) {
  const { t } = usePrintTranslation();
  const format = usePrintFormat();
  const age = patient.dateOfBirth
    ? civilYearsBetween(patient.dateOfBirth, prescription.date)
    : null;
  const infoBoxClassName = 'min-h-[27.2mm] pt-[2.45mm]';
  const noteBoxClassName = 'min-h-[24.9mm] pt-[2.28mm]';
  const noteClassName = 'mt-[2.9mm] ps-[1mm] leading-[3.9mm] wrap-anywhere';

  return (
    <PrintSheet kind="prescription" testId={PRINT_TEMPLATE_TEST_IDS.prescription}>
      <div className="grid grid-cols-[86.9mm_86.7mm] gap-x-[4.5mm]">
        <PrintBox
          title={t(PRINT_TEMPLATE_KEYS.patientInformation)}
          className={infoBoxClassName}
          titleClassName="pb-[1.45mm]"
        >
          <dl className="mt-[1.3mm] flex flex-col">
            <PrintField
              label={t(PRINT_TEMPLATE_KEYS.name)}
              value={fullName(patient)}
              strong
            />
            <PrintField
              label={t(keys.patientId)}
              value={displayId.patientCode(patient.seq)}
              strong
            />
            <PrintField
              label={t(keys.age)}
              value={age === null ? '—' : t(keys.years, { count: age })}
            />
          </dl>
        </PrintBox>
        <PrintBox
          title={t(keys.details)}
          className={infoBoxClassName}
          titleClassName="pb-[1.45mm]"
        >
          <dl className="mt-[1.3mm] flex flex-col">
            <PrintField
              label={t(keys.date)}
              value={format.date(prescription.date)}
              strong
            />
            <PrintField
              label={t(keys.number)}
              value={displayId.prescription(prescription.seq)}
              strong
            />
            <PrintField label={t(keys.doctor)} value={doctor ? fullName(doctor) : '—'} />
          </dl>
        </PrintBox>
      </div>

      <div className="mt-[4.4mm] h-[3.9mm] leading-[3.9mm] font-bold">
        {t(keys.medicines)}
      </div>
      <PrescriptionItemsTable items={prescription.items} count={format.count} />

      <div className="mt-[4.55mm] grid grid-cols-[86.9mm_86.7mm] gap-x-[4.5mm]">
        <PrintBox
          title={t(keys.labReports)}
          className={noteBoxClassName}
          titleClassName="pb-[1.45mm]"
        >
          <p
            className={cn(
              noteClassName,
              !prescription.labReport && 'text-muted-foreground',
            )}
          >
            {prescription.labReport || t(keys.noLabReports)}
          </p>
        </PrintBox>
        <PrintBox
          title={t(keys.procedures)}
          className={noteBoxClassName}
          titleClassName="pb-[1.45mm]"
        >
          <p
            className={cn(
              noteClassName,
              !prescription.procedureToday && 'text-muted-foreground',
            )}
          >
            {prescription.procedureToday || t(keys.noProcedures)}
          </p>
        </PrintBox>
      </div>
      <PrintBox
        title={t(keys.advice)}
        className={cn('mt-[4.55mm]', noteBoxClassName)}
        titleClassName="pb-[1.45mm]"
      >
        <p className={cn(noteClassName, !prescription.advice && 'text-muted-foreground')}>
          {prescription.advice || t(keys.noAdvice)}
        </p>
      </PrintBox>

      <div className="mt-[4.55mm] grid grid-cols-[86.9mm_86.7mm] gap-x-[4.5mm]">
        <PrintBox
          title={t(keys.followUp)}
          className="min-h-[20.17mm] pt-[2.28mm]"
          titleClassName="pb-[1.45mm]"
        >
          <dl className="mt-[1.8mm] flex gap-[2.2mm] leading-[3.9mm]">
            <dt>{t(keys.followUpDate)}</dt>
            <dd className="font-bold">
              {prescription.followUpDate
                ? format.date(prescription.followUpDate)
                : t(keys.notScheduled)}
            </dd>
          </dl>
        </PrintBox>
        <PrintBox
          title={t(keys.signature)}
          className="min-h-[20.17mm] pt-[1.3mm]"
          titleClassName="pb-[1.3mm]"
        >
          <p className="text-muted-foreground mt-[5.6mm] leading-[3.9mm]">
            {t(keys.signHere)}
          </p>
        </PrintBox>
      </div>

      <PrintFooter kind="prescription" organization={organization} branch={branch} />
    </PrintSheet>
  );
}

/** The Medicines & Dosage table (H:469–476). */
function PrescriptionItemsTable({
  items,
  count,
}: {
  items: readonly PrescriptionItem[];
  count: (value: number) => string;
}) {
  const { t } = usePrintTranslation();
  // A line is known by its position; a printed list never reorders.
  const lines = items.map((item, lineIndex) => ({ item, lineIndex }));
  return (
    <div className="border-border-strong mt-[1.95mm] overflow-hidden rounded-md border">
      <table
        data-testid={PRINT_TEMPLATE_TEST_IDS.prescriptionItems}
        className="w-full table-fixed border-separate border-spacing-0 leading-[4.23mm]"
      >
        <colgroup>
          {COLUMN_WIDTHS.map((width) => (
            <col key={width ?? 'rest'} className={width} />
          ))}
        </colgroup>
        <thead>
          {/* The rule's 1px comes out of the padding: the row keeps its height. */}
          <tr className="*:border-border-strong font-bold *:border-b *:py-[2.07mm] *:pb-[calc(2.07mm-1px)]">
            <th scope="col" className="px-[2.28mm] text-start">
              {t(keys.medicine)}
            </th>
            <th scope="col" className="ps-[1.6mm] pe-[2.28mm] text-start">
              {t(keys.dosage)}
            </th>
            <th scope="col" className="px-[2.28mm] text-start">
              {t(keys.when)}
            </th>
            <th scope="col" className="px-[2.28mm] text-start">
              {t(keys.where)}
            </th>
            <th scope="col" className="text-center">
              {t(keys.qty)}
            </th>
            <th scope="col" className="px-[2.28mm] text-start">
              {t(keys.remark)}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map(({ item, lineIndex }) => (
            <tr
              key={lineIndex}
              className={cn(
                'break-inside-avoid *:py-[1.75mm]',
                lineIndex > 0 && '*:border-border *:border-t *:pt-[calc(1.75mm-1px)]',
              )}
            >
              <td className="ps-[2.28mm] pe-[0.6mm] wrap-anywhere">
                {item.medicineName}
              </td>
              <td className="ps-[1.6mm] pe-[1mm] whitespace-nowrap">
                {dosage(item, t, count)}
              </td>
              <td className="ps-[2.28mm] pe-[0.6mm]">{when(item, t)}</td>
              <td className="ps-[2.28mm] pe-[0.6mm]">{where(item, t)}</td>
              <td className="text-center">{count(item.qty)}</td>
              <td className="ps-[2.28mm] pe-[0.6mm] wrap-anywhere">{item.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
