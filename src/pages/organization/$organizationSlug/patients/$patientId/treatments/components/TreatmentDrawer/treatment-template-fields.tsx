import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { kebabCase } from '@/lib/kebab-case.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TREATMENT_LIMITS } from '@/shared/api/app/treatments-contracts.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerStepBody,
  DrawerStepper,
  DrawerTextarea,
  DrawerToggle,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';

import { TREATMENT_KEYS, TREATMENT_NS } from '../../treatments.constants.ts';
import {
  ANAESTHESIA,
  DENTAL_PROCEDURES,
  FDI_QUADRANTS,
  GYNAC_VISIT_TYPES,
  PAIN_SCORES,
  PHYSIO_MODALITIES,
  PHYSIO_REGIONS,
  SKIN_AREAS,
  SKIN_THERAPY_TYPES,
  SKIN_TYPES,
  storedTeeth,
  teethOf,
  type TemplateOption,
  type TreatmentFormValues,
  WAVELENGTHS,
} from './treatment-form.ts';

const K = TREATMENT_KEYS;

/** What every template field renders from. */
interface FieldProps {
  values: TreatmentFormValues;
  setParameter: (key: string, value: string) => void;
  testId: string;
}

/** A parameter's test id: `skinType` → `<testId>-skin-type`. */
function parameterTestId(testId: string, parameter: string): string {
  return `${testId}-${kebabCase(parameter)}`;
}

/** One-pick chips that store their option's value in `parameters[parameter]`. */
function ParameterChips({
  label,
  hint,
  parameter,
  options,
  optionLabel,
  tone,
  span = 'full',
  values,
  setParameter,
  testId,
}: FieldProps & {
  label: string;
  hint?: string;
  parameter: string;
  options: readonly TemplateOption[];
  optionLabel: (option: TemplateOption) => string;
  tone?: Tone;
  span?: 'half' | 'full';
}) {
  const current = options.find((option) => option.value === values.parameters[parameter]);
  return (
    <DrawerField label={label} hint={hint} span={span}>
      <DrawerChips
        label={label}
        options={options.map((option) => ({
          value: option.key,
          label: optionLabel(option),
          tone,
        }))}
        value={current?.key ?? null}
        onChange={(key) =>
          setParameter(
            parameter,
            options.find((option) => option.key === key)?.value ?? '',
          )
        }
        clearable
        testId={parameterTestId(testId, parameter)}
      />
    </DrawerField>
  );
}

/** A text field stored in `parameters[parameter]` (≤ 80). */
function ParameterText({
  label,
  parameter,
  placeholder,
  span,
  multiline = false,
  values,
  setParameter,
  testId,
}: FieldProps & {
  label: string;
  parameter: string;
  placeholder?: string;
  span: 'half' | 'full';
  multiline?: boolean;
}) {
  const id = useId();
  const props = {
    id,
    maxLength: TREATMENT_LIMITS.parameter,
    placeholder,
    value: values.parameters[parameter] ?? '',
    'data-testid': parameterTestId(testId, parameter),
  };
  return (
    <DrawerField label={label} htmlFor={id} span={span}>
      {multiline ? (
        <DrawerTextarea
          {...props}
          rows={3}
          onChange={(event) => setParameter(parameter, event.currentTarget.value)}
        />
      ) : (
        <DrawerInput
          {...props}
          capitalize={false}
          onChange={(event) => setParameter(parameter, event.currentTarget.value)}
        />
      )}
    </DrawerField>
  );
}

/** The template's area chips — pick any — stored as keys in `areas`. */
function AreaChips({
  label,
  hint,
  options,
  optionLabel,
  tone,
  values,
  setAreas,
  testId,
}: {
  label: string;
  hint?: string;
  options: readonly TemplateOption[];
  optionLabel: (option: TemplateOption) => string;
  tone: Tone;
  values: TreatmentFormValues;
  setAreas: (areas: string[]) => void;
  testId: string;
}) {
  return (
    <DrawerField label={label} hint={hint} span="full">
      <DrawerChips
        multiple
        label={label}
        options={options.map((option) => ({
          value: option.key,
          label: optionLabel(option),
          tone,
        }))}
        value={values.areas}
        onChange={setAreas}
        testId={`${testId}-areas`}
      />
    </DrawerField>
  );
}

/**
 * Teeth (H:4816): FDI numbering in its four quadrants — Upper right 18–11,
 * Upper left 21–28, Lower right 48–41, Lower left 31–38 — as 28px buttons;
 * a picked tooth is dark.
 */
function TeethChart({ values, setParameter, testId }: FieldProps) {
  const { t } = useTranslation(TREATMENT_NS);
  const picked = teethOf(values.parameters.teeth);
  const toggle = (tooth: number) =>
    setParameter(
      'teeth',
      storedTeeth(
        picked.includes(tooth)
          ? picked.filter((one) => one !== tooth)
          : [...picked, tooth],
      ),
    );
  return (
    <DrawerField label={t(K.dental.teeth)} hint={t(K.dental.teethHint)} span="full">
      <div className="grid gap-3 md:grid-cols-2">
        {FDI_QUADRANTS.map((quadrant) => (
          <fieldset
            key={quadrant.key}
            aria-label={t(K.dental.quadrants[quadrant.key])}
            className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0"
          >
            <span className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase">
              {t(K.dental.quadrants[quadrant.key])}
            </span>
            <div className="flex flex-wrap gap-1">
              {quadrant.teeth.map((tooth) => {
                const on = picked.includes(tooth);
                return (
                  <button
                    key={tooth}
                    type="button"
                    aria-pressed={on}
                    aria-label={t(K.dental.tooth, { tooth })}
                    onClick={() => toggle(tooth)}
                    data-testid={`${testId}-tooth-${tooth}`}
                    className={cn(
                      'text-caption flex size-7 items-center justify-center rounded-md border font-medium tabular-nums transition-colors',
                      on
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted',
                    )}
                  >
                    {tooth}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </DrawerField>
  );
}

/** A number field stored as text: a stepper with its unit (weeks, kg). */
function ParameterStepper({
  label,
  parameter,
  suffix,
  max,
  span,
  values,
  setParameter,
  testId,
}: FieldProps & {
  label: string;
  parameter: string;
  suffix: string;
  max: number;
  span: 'third' | 'half';
}) {
  const id = useId();
  return (
    <DrawerField label={label} htmlFor={id} span={span}>
      <DrawerStepper
        id={id}
        label={label}
        value={Number(values.parameters[parameter] ?? 0)}
        onValueChange={(value) => setParameter(parameter, value ? String(value) : '')}
        min={0}
        max={max}
        suffix={suffix}
        testId={parameterTestId(testId, parameter)}
      />
    </DrawerField>
  );
}

/** Skin · laser (H:4813–4815). */
function SkinFields(props: FieldProps & { setAreas: (areas: string[]) => void }) {
  const { t } = useTranslation(TREATMENT_NS);
  return (
    <DrawerFieldGrid>
      <ParameterChips
        {...props}
        label={t(K.skin.therapyType)}
        parameter="type"
        options={SKIN_THERAPY_TYPES}
        optionLabel={(option) =>
          t(K.skin.therapyTypes[option.key as keyof typeof K.skin.therapyTypes])
        }
        tone="lav"
      />
      <AreaChips
        {...props}
        label={t(K.skin.bodyPart)}
        hint={t(K.skin.pickAny)}
        options={SKIN_AREAS}
        optionLabel={(option) => t(K.skin.areas[option.key as keyof typeof K.skin.areas])}
        tone="sky"
      />
      <ParameterChips
        {...props}
        label={t(K.skin.skinType)}
        parameter="skinType"
        options={SKIN_TYPES}
        optionLabel={(option) => t(K.skin.skinTypeValue, { type: option.key })}
        tone="butter"
      />
      <ParameterText
        {...props}
        label={t(K.skin.machine)}
        parameter="machine"
        placeholder={t(K.skin.machinePlaceholder)}
        span="half"
      />
      <ParameterChips
        {...props}
        label={t(K.skin.wavelength)}
        parameter="wavelength"
        options={WAVELENGTHS}
        optionLabel={(option) => option.value}
        span="half"
      />
      <ParameterText
        {...props}
        label={t(K.skin.startReading)}
        parameter="startReading"
        placeholder={t(K.skin.readingPlaceholder)}
        span="half"
      />
      <ParameterText
        {...props}
        label={t(K.skin.endReading)}
        parameter="endReading"
        placeholder={t(K.skin.readingPlaceholder)}
        span="half"
      />
      <ParameterText
        {...props}
        label={t(K.skin.power)}
        parameter="power"
        placeholder={t(K.skin.powerPlaceholder)}
        span="full"
      />
    </DrawerFieldGrid>
  );
}

/** Dental (H:4816–4817). */
function DentalFields(props: FieldProps) {
  const { t } = useTranslation(TREATMENT_NS);
  return (
    <DrawerFieldGrid>
      <ParameterChips
        {...props}
        label={t(K.dental.procedure)}
        parameter="procedure"
        options={DENTAL_PROCEDURES}
        optionLabel={(option) =>
          t(K.dental.procedures[option.key as keyof typeof K.dental.procedures])
        }
        tone="mint"
      />
      <TeethChart {...props} />
      <ParameterText
        {...props}
        label={t(K.dental.material)}
        parameter="material"
        placeholder={t(K.dental.materialPlaceholder)}
        span="half"
      />
      <DrawerField label={t(K.dental.anaesthesia)} span="half">
        <DrawerToggle
          aria-label={t(K.dental.anaesthesia)}
          checked={props.values.parameters.anaesthesia === ANAESTHESIA.given}
          onCheckedChange={(given) =>
            props.setParameter(
              'anaesthesia',
              given ? ANAESTHESIA.given : ANAESTHESIA.notGiven,
            )
          }
          onLabel={t(K.dental.given)}
          offLabel={t(K.dental.notGiven)}
          data-testid={`${props.testId}-anaesthesia`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** Physio (H:4818–4819). */
function PhysioFields(props: FieldProps & { setAreas: (areas: string[]) => void }) {
  const { t } = useTranslation(TREATMENT_NS);
  return (
    <DrawerFieldGrid>
      <AreaChips
        {...props}
        label={t(K.physio.region)}
        options={PHYSIO_REGIONS}
        optionLabel={(option) =>
          t(K.physio.regions[option.key as keyof typeof K.physio.regions])
        }
        tone="sage"
      />
      <ParameterChips
        {...props}
        label={t(K.physio.modality)}
        parameter="modality"
        options={PHYSIO_MODALITIES}
        optionLabel={(option) =>
          t(K.physio.modalities[option.key as keyof typeof K.physio.modalities])
        }
        tone="sky"
      />
      <ParameterChips
        {...props}
        label={t(K.physio.painBefore)}
        hint={t(K.physio.painHint)}
        parameter="painBefore"
        options={PAIN_SCORES}
        optionLabel={(option) => option.value}
        tone="blush"
      />
      <ParameterChips
        {...props}
        label={t(K.physio.painAfter)}
        hint={t(K.physio.painHint)}
        parameter="painAfter"
        options={PAIN_SCORES}
        optionLabel={(option) => option.value}
        tone="sage"
      />
      <ParameterText
        {...props}
        label={t(K.physio.exercises)}
        parameter="exercises"
        placeholder={t(K.physio.exercisesPlaceholder)}
        span="full"
        multiline
      />
    </DrawerFieldGrid>
  );
}

/** Gynac (H:4820–4821). */
function GynacFields(props: FieldProps) {
  const { t } = useTranslation(TREATMENT_NS);
  const lmpId = useId();
  return (
    <DrawerFieldGrid>
      <ParameterChips
        {...props}
        label={t(K.gynac.visitType)}
        parameter="visitType"
        options={GYNAC_VISIT_TYPES}
        optionLabel={(option) =>
          t(K.gynac.visitTypes[option.key as keyof typeof K.gynac.visitTypes])
        }
        tone="butter"
      />
      <DrawerField label={t(K.gynac.lmp)} htmlFor={lmpId} span="half">
        <DatePicker
          id={lmpId}
          label={t(K.gynac.lmp)}
          value={props.values.parameters.lmp || null} // NOSONAR(S6606): a cleared date is stored as "" — it means no date
          onChange={(date) => props.setParameter('lmp', date ?? '')}
          past={300}
          future={0}
          clearable
          size="md"
          testId={`${props.testId}-lmp`}
        />
      </DrawerField>
      <ParameterStepper
        {...props}
        label={t(K.gynac.gestation)}
        parameter="gestationWeeks"
        suffix={t(K.gynac.weeks)}
        max={42}
        span="half"
      />
      <ParameterText
        {...props}
        label={t(K.gynac.bp)}
        parameter="bp"
        placeholder={t(K.gynac.bpPlaceholder)}
        span="half"
      />
      <ParameterStepper
        {...props}
        label={t(K.gynac.weight)}
        parameter="weightKg"
        suffix={t(K.gynac.kg)}
        max={250}
        span="half"
      />
      <ParameterText
        {...props}
        label={t(K.gynac.findings)}
        parameter="findings"
        placeholder={t(K.gynac.findingsPlaceholder)}
        span="full"
        multiline
      />
    </DrawerFieldGrid>
  );
}

/** General (H:4822). */
function GeneralFields(props: FieldProps) {
  const { t } = useTranslation(TREATMENT_NS);
  return (
    <DrawerFieldGrid>
      <ParameterText
        {...props}
        label={t(K.general.area)}
        parameter="area"
        placeholder={t(K.general.areaPlaceholder)}
        span="full"
      />
      <ParameterText
        {...props}
        label={t(K.general.parameters)}
        parameter="parameters"
        placeholder={t(K.general.parametersPlaceholder)}
        span="full"
        multiline
      />
    </DrawerFieldGrid>
  );
}

/**
 * Step 2 "<template> details" (H:4812–4822; `patient-file.md:364–368`): the
 * fields of the template the Type switch picked.
 */
export function TreatmentTemplateFields({
  values,
  setParameter,
  setAreas,
  readOnly,
  testId,
}: FieldProps & { setAreas: (areas: string[]) => void; readOnly: boolean }) {
  const props = { values, setParameter, setAreas, testId };
  let fields = <GeneralFields {...props} />;
  if (values.template === 'skin') fields = <SkinFields {...props} />;
  else if (values.template === 'dental') fields = <DentalFields {...props} />;
  else if (values.template === 'physio') fields = <PhysioFields {...props} />;
  else if (values.template === 'gynac') fields = <GynacFields {...props} />;
  return <DrawerStepBody readOnly={readOnly}>{fields}</DrawerStepBody>;
}
