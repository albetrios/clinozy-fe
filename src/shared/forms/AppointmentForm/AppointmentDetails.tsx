import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  APPOINTMENT_LENGTHS,
  type AppointmentPackageOption,
  type AppointmentStaff,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { APPOINTMENT_TYPE_VALUES, type Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import {
  APPOINTMENT_TYPE_TONES,
  serviceTone,
} from '@/shared/clinic/appointment-display.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { PersonAvatar, personFullName } from '@/shared/components/Cells/index.ts';
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
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
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

/** A "Common" option's key — offerings key by their id. */
const commonKey = (label: string) => `common:${label}`;

/** Props for {@link AppointmentDetails}. */
export interface AppointmentDetailsProps {
  draft: AppointmentDraft;
  onChange: (change: AppointmentFormChange) => void;
  /** The person's active packages (patients only). */
  packages: readonly AppointmentPackageOption[];
  staff: readonly AppointmentStaff[];
  offerings: readonly OfferingRecord[];
  /** View only — every control inert. */
  disabled: boolean;
  idPrefix: string;
}

/** Type chips and the hint line under them (H:2764, H:3903). */
function TypeField({
  draft,
  onChange,
  packages,
  disabled,
}: Pick<AppointmentDetailsProps, 'draft' | 'onChange' | 'packages' | 'disabled'>) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const picked =
    draft.type === 'package_session'
      ? packages.find((option) => option.id === draft.packageId)
      : undefined;
  let line: string | null = null;
  if (draft.type === 'package_session') {
    line = picked
      ? t(K.typeLines.package_session, {
          next: picked.sessionsUsed + 1,
          total: picked.sessionsTotal,
        })
      : null;
  } else if (draft.type !== 'treatment') {
    line = t(K.typeLines[draft.type]);
  }
  return (
    <StepField label={t(K.type)}>
      <DrawerChips
        label={t(K.typeGroup)}
        value={draft.type}
        disabled={disabled}
        onChange={(type) => {
          if (type) onChange({ kind: 'type', type, packages });
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

/** "Pick a treatment" (H:2765): the four common treatments, then the clinic's treatment offerings. */
function TreatmentField({
  draft,
  onChange,
  offerings,
  disabled,
}: Pick<AppointmentDetailsProps, 'draft' | 'onChange' | 'offerings' | 'disabled'>) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  const money = usePaiseFormat();
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
  const fromOfferings: PickerOption[] = offerings
    .filter(
      (offering) =>
        offering.active && offering.category === 'treatment' && !named.has(offering.name),
    )
    .map((offering) => ({
      key: offering.id,
      label: offering.name,
      sub: [
        t(CLINIC_KEYS.offerings.specialties[offering.specialty], { ns: CLINIC_NS }),
        offering.price > 0 ? money(offering.price) : '',
      ]
        .filter(Boolean)
        .join(' · '),
      meta: minutes(offering.durationMin || 30),
      group: t(K.fromOfferings),
      tone: offering.tone,
      data: {
        label: offering.name,
        offeringId: offering.id,
        minutes: offering.durationMin || 30,
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

/** The person's packages as radios, or why there are none (H:2766–2768). */
function PackageField({
  draft,
  onChange,
  packages,
  disabled,
}: Pick<AppointmentDetailsProps, 'draft' | 'onChange' | 'packages' | 'disabled'>) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const { formatDate } = useLocaleFormat();
  return (
    <StepField label={t(K.package)} align="picker">
      {packages.length > 0 ? (
        <div
          role="radiogroup"
          aria-label={t(K.package)}
          data-testid={IDS.package}
          className="flex flex-col gap-1.5"
        >
          {packages.map((option) => {
            const on = draft.packageId === option.id;
            const tone = TONE_CLASSES[option.tone];
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => onChange({ kind: 'package', option })}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2.25 text-start transition-colors disabled:opacity-50',
                  on
                    ? cn(tone.bg, 'border-current', tone.ink)
                    : 'bg-card hover:border-current',
                )}
              >
                <span
                  aria-hidden="true"
                  data-slot="pill"
                  className={cn(
                    'flex size-4 flex-none items-center justify-center rounded-full border-[1.5px]',
                    on ? 'border-current' : 'border-border-strong',
                  )}
                >
                  {on ? (
                    <span data-slot="pill" className="size-2 rounded-full bg-current" />
                  ) : null}
                </span>
                <span className="text-foreground flex min-w-0 flex-1 flex-col leading-[1.3]">
                  <span className="text-body truncate font-medium">{option.name}</span>
                  <span className="text-caption text-muted-foreground truncate tabular-nums">
                    {t(K.packageNext, {
                      next: option.sessionsUsed + 1,
                      total: option.sessionsTotal,
                      date: formatDate(
                        localDateOf(option.validUntil),
                        { day: 'numeric', month: 'short', year: 'numeric' },
                        { civilDay: true },
                      ),
                    })}
                  </span>
                </span>
                <span
                  data-slot="pill"
                  className={cn(
                    'inline-flex h-6 flex-none items-center rounded-full px-2.5 text-xs font-medium tabular-nums',
                    tone.surface,
                  )}
                >
                  {t(K.packageLeft, {
                    count: option.sessionsTotal - option.sessionsUsed,
                  })}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="border-border-strong bg-canvas flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2.5">
          <span className="text-detail text-muted-foreground-strong flex-1">
            {draft.who
              ? t(K.noPackage, { name: draft.who.name })
              : t(K.pickContactPackages)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={disabled}
            data-testid={IDS.packageAsTreatment}
            onClick={() => onChange({ kind: 'type', type: 'treatment', packages })}
            className="bg-card hover:bg-muted text-xs shadow-none"
          >
            {t(K.asTreatment)}
          </Button>
        </div>
      )}
    </StepField>
  );
}

/** "Pick a doctor" (H:2770): doctors and therapists with their real roles; a pick clears the time. */
function DoctorField({
  draft,
  onChange,
  staff,
  disabled,
}: Pick<AppointmentDetailsProps, 'draft' | 'onChange' | 'staff' | 'disabled'>) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS, PICKER_NS]);
  const options: PickerOption<AppointmentStaff>[] = staff.map((person) => ({
    key: person.id,
    label: personFullName(person),
    sub: person.roles
      .map((role) => t(CLINIC_KEYS.roles[role], { ns: CLINIC_NS }))
      .join(' · '),
    tone: person.tone,
    leading: { kind: 'avatar', initials: person.initials },
    keywords: [person.initials],
    data: person,
  }));
  const picked = staff.find((person) => person.id === draft.doctorId);
  const name = picked ? personFullName(picked) : t(K.pickDoctor);
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
 * Treatment or Package — Doctor, Length (in the service's tone), Reason and
 * Notes. Each row's 88px label stacks above its control in a narrow form.
 */
export function AppointmentDetails({
  draft,
  onChange,
  packages,
  staff,
  offerings,
  disabled,
  idPrefix,
}: AppointmentDetailsProps) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const tone = serviceTone({ serviceLabel: draft.serviceLabel, type: draft.type });
  return (
    <div className="flex flex-col gap-4">
      <TypeField
        draft={draft}
        onChange={onChange}
        packages={packages}
        disabled={disabled}
      />
      {draft.type === 'treatment' ? (
        <TreatmentField
          draft={draft}
          onChange={onChange}
          offerings={offerings}
          disabled={disabled}
        />
      ) : null}
      {draft.type === 'package_session' ? (
        <PackageField
          draft={draft}
          onChange={onChange}
          packages={packages}
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
