import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { APPOINTMENT_TYPE_VALUES, type Tone } from '@/shared/api/app/app-schema.ts';
import {
  APPOINTMENT_LENGTHS,
  type AppointmentStaff,
  type AppointmentTreatment,
} from '@/shared/api/app/appointments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { APPOINTMENT_TYPE_TONES, serviceTone } from '@/shared/app/appointment-display.ts';
import { PersonAvatar } from '@/shared/components/Cells/index.ts';
import {
  DrawerChips,
  DrawerInput,
  DrawerTextarea,
} from '@/shared/components/DrawerField/index.ts';
import {
  Picker,
  PICKER_KEYS,
  PICKER_NS,
  type PickerOption,
} from '@/shared/components/Picker/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
  APPOINTMENT_FORM_TEST_IDS,
} from './appointment-form.constants.ts';
import {
  APPOINTMENT_FORM_LIMITS,
  type AppointmentDraft,
  type AppointmentFormChange,
  COMMON_TREATMENTS,
} from './appointment-form-model.ts';
import { StepField } from './AppointmentStep.tsx';

const K = APPOINTMENT_FORM_KEYS.details;
const IDS = APPOINTMENT_FORM_TEST_IDS;

/** The "Common" treatments' tones (`AP_SVC`, H:3416). */
const COMMON_TONES: Readonly<Record<string, Tone>> = {
  Treatment: 'sage',
  'LHR Treatment': 'lav',
  Peel: 'blush',
  Hydrafacial: 'mint',
};

/** A "Common" option's key — treatments key by their offering's id. */
const commonKey = (label: string) => `common:${label}`;

/** Props for {@link AppointmentDetails}. */
export interface AppointmentDetailsProps {
  draft: AppointmentDraft;
  onChange: (change: AppointmentFormChange) => void;
  staff: readonly AppointmentStaff[];
  /** The clinic's active treatments ("From offerings"). */
  treatments: readonly AppointmentTreatment[];
  /** View only — every control inert. */
  disabled: boolean;
  idPrefix: string;
}

/**
 * Type chips and the hint line under them (H:2764, H:3903). A Package session names no
 * package — the package picker went with the backend (A12, route map §4 #20).
 */
function TypeField({
  draft,
  onChange,
  disabled,
}: Pick<AppointmentDetailsProps, 'draft' | 'onChange' | 'disabled'>) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const line =
    draft.type === 'treatment' || draft.type === 'package_session'
      ? null
      : t(K.typeLines[draft.type]);
  return (
    <StepField label={t(K.type)}>
      <DrawerChips
        label={t(K.typeGroup)}
        value={draft.type}
        disabled={disabled}
        onChange={(type) => {
          if (type) onChange({ kind: 'type', type });
        }}
        options={APPOINTMENT_TYPE_VALUES.map((type) => ({
          value: type,
          label: t(K.types[type]),
          tone: APPOINTMENT_TYPE_TONES[type],
          hint: t(K.typeHints[type]),
        }))}
        testId={IDS.type}
      />
      {line ? (
        <span className="text-caption text-muted-foreground mt-1.5 block">{line}</span>
      ) : null}
    </StepField>
  );
}

/**
 * "Pick a treatment" (H:2765): the four common treatments, then the clinic's active treatment
 * offerings by specialty — without their price until the clinic's money moves to rupees with the
 * Payments room (api-integration F10).
 */
function TreatmentField({
  draft,
  onChange,
  treatments,
  disabled,
}: Pick<AppointmentDetailsProps, 'draft' | 'onChange' | 'treatments' | 'disabled'>) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, APP_NS]);
  const minutes = (count: number) => t(K.minutes, { minutes: count });
  const common: PickerOption[] = COMMON_TREATMENTS.map((treatment) => ({
    key: commonKey(treatment.label),
    label: treatment.label,
    meta: minutes(treatment.minutes),
    group: t(K.common),
    tone: COMMON_TONES[treatment.label],
    // A tone pill, in the list and on the trigger (`AP_SVC`'s bg / ink, H:6008).
    leading: { kind: 'pill' },
    data: { label: treatment.label, offeringId: null, minutes: treatment.minutes },
  }));
  const named = new Set<string>(COMMON_TREATMENTS.map((treatment) => treatment.label));
  const fromOfferings: PickerOption[] = treatments
    .filter((treatment) => !named.has(treatment.name))
    .map((treatment) => ({
      key: treatment.id,
      label: treatment.name,
      sub: t(APP_KEYS.offerings.specialties[treatment.specialty], { ns: APP_NS }),
      meta: minutes(treatment.durationMin || 30),
      group: t(K.fromOfferings),
      tone: treatment.tone,
      data: {
        label: treatment.name,
        offeringId: treatment.id,
        minutes: treatment.durationMin || 30,
      },
    }));
  const options = [...common, ...fromOfferings];
  const value = draft.offeringId ?? commonKey(draft.serviceLabel);
  return (
    <StepField label={t(K.treatment)} align="picker">
      <Picker
        label={t(K.treatment)}
        placeholder={t(K.pickTreatment)}
        searchPlaceholder={t(K.searchTreatments)}
        searchable
        size="lg"
        minWidth={320}
        options={options}
        value={options.some((option) => option.key === value) ? value : null}
        disabled={disabled}
        onChange={(_key, option) => {
          const picked = option?.data as
            { label: string; offeringId: string | null; minutes: number } | undefined;
          if (picked) onChange({ kind: 'treatment', ...picked });
        }}
        testId={IDS.treatment}
        className="max-w-80"
      />
    </StepField>
  );
}

/**
 * "Pick a doctor" (H:2770): the team — the API names no doctor role and no roles on the picker
 * (M41); a pick clears the time.
 */
function DoctorField({
  draft,
  onChange,
  staff,
  disabled,
}: Pick<AppointmentDetailsProps, 'draft' | 'onChange' | 'staff' | 'disabled'>) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, APP_NS, PICKER_NS]);
  const options: PickerOption<AppointmentStaff>[] = staff.map((person) => ({
    key: person.id,
    label: person.name,
    tone: person.tone,
    leading: { kind: 'avatar', initials: person.initials },
    keywords: [person.initials],
    data: person,
  }));
  const picked = staff.find((person) => person.id === draft.doctorId);
  const name = picked ? picked.name : t(K.pickDoctor);
  return (
    <StepField label={t(K.doctor)} align="picker">
      <Picker
        label={t(K.doctor)}
        placeholder={t(K.pickDoctor)}
        searchPlaceholder={t(K.searchDoctors)}
        searchable
        minWidth={260}
        options={options}
        value={draft.doctorId}
        disabled={disabled}
        onChange={(key) => {
          if (key) onChange({ kind: 'doctor', doctorId: key });
        }}
        testId={IDS.doctor}
        className="max-w-95"
        renderTrigger={({ open }) => (
          <button
            type="button"
            disabled={disabled}
            aria-label={t(PICKER_KEYS.triggerLabel, {
              ns: PICKER_NS,
              label: t(K.doctor),
              value: name,
            })}
            data-testid={IDS.doctor}
            className={cn(
              'border-border bg-card hover:bg-canvas flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border ps-1.75 pe-3 text-start shadow-xs transition-colors disabled:opacity-50',
              open && 'border-disabled',
            )}
          >
            {picked ? (
              <span
                data-slot="pill"
                className="bg-card inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border ps-0.75 pe-2.5 whitespace-nowrap"
              >
                <PersonAvatar size="chip" initials={picked.initials} tone={picked.tone} />
                <span className="text-detail min-w-0 truncate font-medium">{name}</span>
              </span>
            ) : (
              <span className="text-body text-muted-foreground ps-1.25">{name}</span>
            )}
            <ChevronDown
              aria-hidden="true"
              className="text-muted-foreground ms-auto size-3.5 flex-none"
            />
          </button>
        )}
      />
    </StepField>
  );
}

/**
 * Step 1 · Appointment (H:2764–2773; `appointments.md:71–77`): Type — and its
 * Treatment — Doctor, Length (in the service's tone), Reason and Notes. Each
 * row's 88px label stacks above its control in a narrow form.
 */
export function AppointmentDetails({
  draft,
  onChange,
  staff,
  treatments,
  disabled,
  idPrefix,
}: AppointmentDetailsProps) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const tone = serviceTone({ serviceLabel: draft.serviceLabel, type: draft.type });
  return (
    <div className="flex flex-col gap-4">
      <TypeField draft={draft} onChange={onChange} disabled={disabled} />
      {draft.type === 'treatment' ? (
        <TreatmentField
          draft={draft}
          onChange={onChange}
          treatments={treatments}
          disabled={disabled}
        />
      ) : null}
      <DoctorField draft={draft} onChange={onChange} staff={staff} disabled={disabled} />
      <StepField label={t(K.length)}>
        <DrawerChips
          label={t(K.length)}
          value={String(draft.durationMin)}
          disabled={disabled}
          onChange={(minutes) => {
            if (minutes) onChange({ kind: 'length', minutes: Number(minutes) });
          }}
          options={APPOINTMENT_LENGTHS.map((minutes) => ({
            value: String(minutes),
            label: t(K.minutes, { minutes }),
            tone,
            hint: t(K.minutesHint, { minutes }),
          }))}
          testId={IDS.length}
        />
      </StepField>
      <StepField label={t(K.reason)} htmlFor={`${idPrefix}-reason`} align="input">
        <DrawerInput
          id={`${idPrefix}-reason`}
          value={draft.reason}
          maxLength={APPOINTMENT_FORM_LIMITS.reason}
          placeholder={t(K.reasonPlaceholder)}
          disabled={disabled}
          onChange={(event) =>
            onChange({ kind: 'reason', text: event.currentTarget.value })
          }
          dictation
          data-testid={IDS.reason}
          className="text-body md:text-body"
        />
      </StepField>
      <StepField label={t(K.notes)} htmlFor={`${idPrefix}-notes`} align="input">
        <DrawerTextarea
          id={`${idPrefix}-notes`}
          rows={2}
          value={draft.notes}
          maxLength={APPOINTMENT_FORM_LIMITS.notes}
          placeholder={t(K.notesPlaceholder)}
          disabled={disabled}
          onChange={(event) =>
            onChange({ kind: 'notes', text: event.currentTarget.value })
          }
          data-testid={IDS.notes}
          className="text-body md:text-body min-h-0 resize-none"
        />
      </StepField>
    </div>
  );
}
