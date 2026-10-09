import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { AppointmentStaff } from '@/shared/api/clinic/appointments-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  PersonAvatar,
  personFullName,
  shortPersonName,
} from '@/shared/components/Cells/index.ts';
import {
  Picker,
  PICKER_KEYS,
  PICKER_NS,
  type PickerOption,
} from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useBookableStaff } from '@/shared/hooks/useAppointments/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';

import { APPOINTMENTS_KEYS, APPOINTMENTS_NS } from '../../appointments.constants.ts';

/** Props for {@link DoctorPicker}. */
export interface DoctorPickerProps {
  /** The doctors picked; none is "All doctors". */
  value: readonly string[];
  onChange: (ids: string[]) => void;
  /** 32px (the Day header, 240px) or 36px (Filters, the field's width). */
  size: 'sm' | 'md';
  /** A doctor's line at the inline end — the Day header's "<n> booked" / "free". */
  meta?: (doctorId: string) => string;
  /** "Show all" · "Done" under the list (the Day header, `appointments.md:191`). */
  withFooter?: boolean;
  /** The list's panel width (the Day header's 280px). */
  minWidth?: 280;
  align?: 'start' | 'end';
  testId: string;
  className?: string;
}

/** What the Day header's footer under the list needs. */
interface DoctorPickerFooterOptions {
  onShowAll: () => void;
  showAllLabel: string;
  doneLabel: string;
}

/**
 * "Show all" · "Done" under the list (the Day header, `appointments.md:191`) —
 * the Picker calls it with its `close`, which "Done" runs.
 */
function doctorPickerFooter(
  close: () => void,
  { onShowAll, showAllLabel, doneLabel }: DoctorPickerFooterOptions,
): ReactNode {
  return (
    <>
      <button
        type="button"
        onClick={onShowAll}
        className="text-muted-foreground hover:text-foreground px-1 text-xs transition-colors"
      >
        {showAllLabel}
      </button>
      <Button type="button" size="sm" onClick={close} className="text-detail">
        {doneLabel}
      </Button>
    </>
  );
}

/**
 * Who a view shows — "All doctors" / "<name>" / "<n> doctors" with the picked
 * doctors' avatars stacked before it (H:2010, H:2057) — on the one Picker:
 * "Search team", each doctor and therapist with their real role (the
 * prototype wrote "Doctor" for everyone, §7.3), any number picked.
 */
export function DoctorPicker({
  value,
  onChange,
  size,
  meta,
  withFooter = false,
  minWidth,
  align = 'start',
  testId,
  className,
}: DoctorPickerProps) {
  const { t } = useTranslation([APPOINTMENTS_NS, CLINIC_NS, PICKER_NS]);
  const staff = useBookableStaff();
  const keys = APPOINTMENTS_KEYS.filters;
  const people = staff.data ?? [];
  const options: PickerOption<AppointmentStaff>[] = people.map((person) => ({
    key: person.id,
    label: personFullName(person),
    sub: person.roles
      .map((role) => t(CLINIC_KEYS.roles[role], { ns: CLINIC_NS }))
      .join(' · '),
    meta: meta?.(person.id),
    tone: person.tone,
    leading: { kind: 'avatar', initials: person.initials },
    keywords: [person.initials],
    data: person,
  }));
  const picked = people.filter((person) => value.includes(person.id));
  let label = t(keys.allDoctors);
  if (picked.length === 1 && picked[0])
    label = shortPersonName(personFullName(picked[0]));
  else if (picked.length > 1) label = t(keys.doctors, { count: picked.length });

  return (
    <Picker
      multiple
      label={t(keys.appointedTo)}
      options={options}
      value={[...value]}
      onChange={(ids) => onChange(ids)}
      searchable
      searchPlaceholder={t(keys.searchTeam)}
      minWidth={minWidth}
      align={align}
      testId={testId}
      className={className}
      footer={
        withFooter
          ? (close) =>
              doctorPickerFooter(close, {
                onShowAll: () => onChange([]),
                showAllLabel: t(keys.showAll),
                doneLabel: t(keys.done),
              })
          : undefined
      }
      renderTrigger={({ open }) => (
        <button
          type="button"
          aria-label={t(PICKER_KEYS.triggerLabel, {
            ns: PICKER_NS,
            label: t(keys.appointedTo),
            value: label,
          })}
          data-testid={testId}
          className={cn(
            'border-border bg-card hover:bg-canvas flex w-full min-w-0 items-center gap-1.5 rounded-lg border pe-2.5 text-start transition-colors',
            size === 'sm' ? 'text-detail h-8 ps-1.25' : 'text-body h-9 ps-1.5 shadow-xs',
            open && 'border-disabled',
          )}
        >
          {picked.length > 0 ? (
            <span className="[&_[data-slot=avatar]]:ring-card flex flex-none items-center pe-1.5 [&_[data-slot=avatar]]:ring-[1.5px]">
              {picked.map((person) => (
                <PersonAvatar
                  key={person.id}
                  size="line"
                  initials={person.initials}
                  tone={person.tone}
                  className="-me-1.5"
                />
              ))}
            </span>
          ) : null}
          <span
            className={cn(
              'min-w-0 truncate',
              picked.length === 0 && 'text-muted-foreground',
            )}
          >
            {label}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'text-muted-foreground ms-auto size-3.5 flex-none transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
      )}
    />
  );
}
