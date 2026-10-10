import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { PersonAvatar, shortPersonName } from '@/shared/components/Cells/index.ts';
import {
  Picker,
  PICKER_KEYS,
  PICKER_NS,
  type PickerOption,
} from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';

import { APPOINTMENTS_KEYS, APPOINTMENTS_NS } from '../../appointments.constants.ts';

/** The "All doctors" option's key — a doctor's is their membership id (`mem_…`). */
const ALL_DOCTORS = 'all';

/** Props for {@link DoctorPicker}. */
export interface DoctorPickerProps {
  /** The doctor picked (`mem_…`); none is "All doctors". */
  value: string | undefined;
  onChange: (id: string | undefined) => void;
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
 * Who a view shows — "All doctors" or "<name>" with the doctor's avatar before
 * it (H:2010, H:2057) — on the one Picker: "Search team", "All doctors", then
 * every active member of the team directory (the API names no doctor role, so
 * each is bookable; no role line, api-integration M41). One doctor or everyone:
 * the API's `doctor_membership_id` takes one (G3).
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
  const { t } = useTranslation([APPOINTMENTS_NS, PICKER_NS]);
  const team = useTeamDirectory();
  const keys = APPOINTMENTS_KEYS.filters;
  const options: PickerOption[] = [
    {
      key: ALL_DOCTORS,
      label: t(keys.allDoctors),
      tone: 'stone',
      leading: { kind: 'none' },
    },
    ...team.members.map((member) => ({
      key: member.id,
      label: member.name,
      meta: meta?.(member.id),
      tone: member.tone,
      leading: { kind: 'avatar' as const, initials: member.initials },
      keywords: [member.initials],
    })),
  ];
  const picked = value ? team.byId.get(value) : undefined;
  const label = picked ? shortPersonName(picked.name) : t(keys.allDoctors);

  return (
    <Picker
      label={t(keys.appointedTo)}
      options={options}
      value={value ?? ALL_DOCTORS}
      onChange={(id) => onChange(id && id !== ALL_DOCTORS ? id : undefined)}
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
                onShowAll: () => onChange(undefined),
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
          {picked ? (
            <span className="[&_[data-slot=avatar]]:ring-card flex flex-none items-center pe-1.5 [&_[data-slot=avatar]]:ring-[1.5px]">
              <PersonAvatar
                size="line"
                initials={picked.initials}
                tone={picked.tone}
                className="-me-1.5"
              />
            </span>
          ) : null}
          <span className={cn('min-w-0 truncate', !picked && 'text-muted-foreground')}>
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
