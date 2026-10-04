import { useId, useState } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { MRVisit } from '@/shared/api/clinic/clinic-schema.ts';
import {
  addCivilDays,
  addCivilMonths,
  clinicToday,
} from '@/shared/api/clinic/clinic-time.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerQuickChips,
  DrawerStepBody,
  DrawerTextarea,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import {
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';

import { useMedicalDates } from '../../../shared/components/MedicalCells/medical-dates.ts';
import { useLogMrVisit } from '../../../shared/hooks/useMedicalPartners/index.ts';
import type { MrRow } from '../../../shared/medical-contracts.ts';
import { textOrNull } from '../../../shared/medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';

const K = MEDICAL_DRAWER_KEYS.visit;

/** Four light fields: 560px (`medical.md:336`). */
const CONTENT_PROFILE = { fieldCount: 4 } as const;

/** A visit is logged on a past day or today, as far back as the date list goes. */
const PAST_DAYS = 120;
/** The next visit is set within the next 120 days (as an MR's own). */
const NEXT_DAYS = 120;

/** The form: the visit's day, the next one, what was left, and a note. */
interface VisitFormValues {
  date: string;
  nextVisitOn: string | null;
  samples: string;
  notes: string;
}

/** The next visit's quick picks, counted from the visit's day (§7.3). */
type NextVisitPick = 'twoWeeks' | 'oneMonth';

/** The day a quick pick sets from the visit's day. */
function nextVisitFor(pick: NextVisitPick, date: string): string {
  return pick === 'twoWeeks' ? addCivilDays(date, 14) : addCivilMonths(date, 1);
}

/** What the steps' bodies read. */
interface BodyProps {
  form: UseFormReturn<VisitFormValues>;
  values: VisitFormValues;
  idPrefix: string;
  testId: string;
  today: string;
}

/** VISIT: the day it happened. */
function VisitFields({ form, idPrefix, testId, today }: BodyProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const date = field('date');
  return (
    <DrawerFieldGrid>
      <DrawerField span="half" stretch={false} label={t(K.fields.date)} htmlFor={date.id}>
        <Controller
          control={form.control}
          name="date"
          render={({ field: control }) => (
            <DatePicker
              id={date.id}
              label={t(K.fields.date)}
              value={control.value}
              onChange={(next) => control.onChange(next ?? today)}
              today={today}
              max={today}
              past={PAST_DAYS}
              future={0}
              size="md"
              testId={`${testId}-date`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** DETAILS: the next visit ("2 weeks" · "1 month" from the visit) and the samples left. */
function DetailFields({ form, values, idPrefix, testId, today }: BodyProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const next = field('nextVisitOn');
  const samples = field('samples');
  const picks: readonly NextVisitPick[] = ['twoWeeks', 'oneMonth'];
  const matching =
    picks.find((pick) => nextVisitFor(pick, values.date) === values.nextVisitOn) ?? null;
  return (
    <DrawerFieldGrid>
      <DrawerField span="half" label={t(K.fields.nextVisit)} htmlFor={next.id}>
        <Controller
          control={form.control}
          name="nextVisitOn"
          render={({ field: control }) => (
            <div className="flex min-w-0 flex-col gap-1.5">
              <DatePicker
                id={next.id}
                label={t(K.fields.nextVisit)}
                value={control.value}
                onChange={control.onChange}
                today={today}
                min={values.date}
                past={0}
                future={NEXT_DAYS}
                clearable
                size="md"
                testId={`${testId}-next-visit`}
              />
              <DrawerQuickChips
                label={t(K.fields.nextVisit)}
                options={picks.map((pick) => ({ label: t(K.fields[pick]), value: pick }))}
                value={matching}
                onChange={(pick) => control.onChange(nextVisitFor(pick, values.date))}
                testId={`${testId}-next-visit-quick`}
              />
            </div>
          )}
        />
      </DrawerField>
      <DrawerField span="half" label={t(K.fields.samples)} htmlFor={samples.id}>
        <DrawerInput
          {...samples.control}
          {...form.register('samples')}
          maxLength={120}
          placeholder={t(K.fields.samplesPlaceholder)}
          autoComplete="off"
          data-testid={`${testId}-samples`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** NOTES: anything else from the visit. */
function NoteFields({ form, idPrefix, testId }: BodyProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const note = field('notes');
  return (
    <DrawerFieldGrid>
      <DrawerField label={t(K.fields.note)} htmlFor={note.id}>
        <DrawerTextarea
          {...note.control}
          {...form.register('notes')}
          rows={3}
          maxLength={1000}
          data-testid={`${testId}-note`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** Visit → Details → Notes (`medical.md:433`), each peeking its values. */
function useSteps(body: BodyProps): DrawerStep[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const dates = useMedicalDates();
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const { values } = body;
  const date = dates.day(values.date);
  const next = values.nextVisitOn ? dates.day(values.nextVisitOn) : '';
  const samples = values.samples.trim();
  const notes = values.notes.trim();
  return [
    {
      id: 'visit',
      title: t(K.steps.visit),
      summary: date,
      peek: [{ kind: 'value', label: t(K.fields.date), value: date }],
      content: (
        <DrawerStepBody readOnly={false}>
          <VisitFields {...body} />
        </DrawerStepBody>
      ),
    },
    {
      id: 'details',
      title: t(K.steps.details),
      summary: [next, samples].filter(Boolean).join(' · ') || notFilled,
      peek: [
        { kind: 'value', label: t(K.fields.nextVisit), value: next },
        { kind: 'value', label: t(K.fields.samples), value: samples },
      ],
      content: (
        <DrawerStepBody readOnly={false}>
          <DetailFields {...body} />
        </DrawerStepBody>
      ),
    },
    {
      id: 'notes',
      title: t(K.steps.notes),
      summary: notes || notFilled,
      peek: [{ kind: 'value', label: t(K.fields.note), value: notes }],
      content: (
        <DrawerStepBody readOnly={false}>
          <NoteFields {...body} />
        </DrawerStepBody>
      ),
    },
  ];
}

/** One opening: the visit's form and its save. */
function VisitSession({
  open,
  onClose,
  mr,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  mr: MrRow;
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const dates = useMedicalDates();
  const idPrefix = `mr-visit-${useId().replace(/:/g, '')}`;
  const [today] = useState(() => clinicToday());
  const form = useForm<VisitFormValues>({
    defaultValues: {
      date: today,
      nextVisitOn: nextVisitFor('twoWeeks', today),
      samples: '',
      notes: '',
    },
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('visit');
  const log = useLogMrVisit({
    notifyOnError: false,
    successMessage: (_visit, input) =>
      input.nextVisitOn
        ? t(K.saved, { date: dates.day(input.nextVisitOn) })
        : t(K.savedNoReminder),
  });
  const { saveState, save } = useDrawerSave<VisitFormValues, MRVisit>({
    form,
    fieldOrder: ['date', 'nextVisitOn', 'samples', 'notes'],
    toastId: 'rep-visit-save-failed',
    onField: (field) => {
      if (field === 'date') setOpenStep('visit');
      else setOpenStep(field === 'notes' ? 'notes' : 'details');
    },
    write: () => {
      const current = form.getValues();
      return log.mutateAsync({
        mrId: mr.id,
        date: current.date,
        nextVisitOn: current.nextVisitOn,
        samples: textOrNull(current.samples),
        notes: textOrNull(current.notes),
      });
    },
    onDone: () => onClose(),
  });

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title)}
      sub={mr.name}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.medical}
      steps={useSteps({ form, values, idPrefix, testId, today })}
      openStep={openStep}
      onOpenStepChange={setOpenStep}
      summary={
        values.nextVisitOn ? t(K.summary, { date: dates.day(values.nextVisitOn) }) : ''
      }
      saveLabel={t(K.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={testId}
    />
  );
}

/**
 * Log MR visit (KICKOFF §6.7 Drawers; `medical.md:239–252`) — 560px over
 * Medical › MRs: "Visit" (the day, today by default), "Details" (the next
 * visit, two weeks on by default, "2 weeks" · "1 month" counted from the
 * visit's day — not the prototype's fixed dates, §7.3 — and the samples
 * left), "Notes". "Log visit" writes the visit and the MR's next one: "Visit
 * logged · reminder set for 12 Oct"; the row's Last / Next visit and Samples
 * update. Nothing on it can fail validation.
 */
export function MrVisitDrawer({
  open,
  onClose,
  mr,
  testId = MEDICAL_DRAWER_TEST_IDS.visit,
}: {
  open: boolean;
  onClose: () => void;
  /** The MR the visit is with; `undefined` while a deep link loads. */
  mr: MrRow | undefined;
  testId?: string;
}) {
  const { session } = useDrawerSession(open);
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  if (!mr) {
    return (
      <RecordDrawerPending
        open={open}
        onClose={onClose}
        title={t(K.title)}
        sub=""
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.mr)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  return (
    <VisitSession
      key={`${session}-${mr.id}`}
      open={open}
      onClose={onClose}
      mr={mr}
      testId={testId}
    />
  );
}
