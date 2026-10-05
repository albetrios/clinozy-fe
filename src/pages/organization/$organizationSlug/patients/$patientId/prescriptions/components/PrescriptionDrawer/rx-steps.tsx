import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  DrawerField,
  DrawerFieldGrid,
  DrawerStepBody,
  DrawerTextarea,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';

import { PatientStaffPicker } from '../../../shared/components/PatientStaffPicker/index.ts';
import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import { RX_NOTES, type RxFormValues } from './rx-form.ts';

const K = RX_KEYS;

/** What a step's fields render from. */
interface RxStepFieldsProps {
  form: UseFormReturn<RxFormValues>;
  values: RxFormValues;
  readOnly: boolean;
}

/**
 * Step 1 "Prescription" (H:4805; `patient-file.md:109–110`): Date — today
 * prefilled; the next 14 days, then 180 back — and Doctor.
 */
export function RxPrescriptionFields({
  form,
  values,
  readOnly,
  today,
}: RxStepFieldsProps & { today: string }) {
  const { t } = useTranslation(RX_NS);
  const ids = useId();
  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.date)} htmlFor={`${ids}-date`} span="third">
          <DatePicker
            id={`${ids}-date`}
            label={t(K.date)}
            value={values.date}
            onChange={(date) =>
              form.setValue('date', date ?? today, { shouldDirty: true })
            }
            today={today}
            future={14}
            past={180}
            disabled={readOnly}
            size="md"
            testId="rx-drawer-date"
          />
        </DrawerField>
        <DrawerField label={t(K.doctor)} htmlFor={`${ids}-doctor`} span="half">
          <PatientStaffPicker
            id={`${ids}-doctor`}
            staffRole="doctor"
            label={t(K.doctor)}
            placeholder={t(K.doctorPlaceholder)}
            value={values.doctorId}
            onChange={(doctorId) =>
              form.setValue('doctorId', doctorId, { shouldDirty: true })
            }
            disabled={readOnly}
            testId="rx-drawer-doctor"
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/**
 * Step 3 "Clinical notes" (H:4808; `patient-file.md:115–117`): Notes, Lab
 * report and Today's procedure, a third each, ≤1,000 characters.
 */
export function RxNotesFields({ form, readOnly }: Omit<RxStepFieldsProps, 'values'>) {
  const { t } = useTranslation(RX_NS);
  const ids = useId();
  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid>
        {RX_NOTES.map((note) => (
          <DrawerField
            key={note.field}
            label={t(K.notes[note.label])}
            htmlFor={`${ids}-${note.field}`}
            span="third"
          >
            <DrawerTextarea
              id={`${ids}-${note.field}`}
              rows={4}
              maxLength={1000}
              placeholder={t(K.notes[note.placeholder])}
              data-testid={`rx-drawer-${note.testId}`}
              {...form.register(note.field)}
            />
          </DrawerField>
        ))}
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}
