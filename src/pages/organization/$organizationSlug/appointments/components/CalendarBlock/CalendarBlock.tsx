import { type CSSProperties, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import type { AppointmentStatus } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { APPOINTMENT_STATUS_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  PersonAvatar,
  personInitials,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import { useAppointmentSlotLabel } from '@/shared/hooks/useAppointments/index.ts';

import type { BlockGeometry } from '../../appointments.calendar.ts';
import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { blockPersonTone, serviceTone, staffName } from '../../appointments.display.ts';
import { useAppointmentActions } from '../AppointmentActions/index.ts';
import { AppointmentHoverCard } from '../AppointmentCard/index.ts';
import { AppointmentStatusPill } from '../AppointmentStatusPill/index.ts';
import {
  AppointmentStatusPopover,
  type AppointmentStatusView,
} from '../AppointmentStatusPopover/index.ts';

/** The block's 3px inline-start edge in its status's ink (H:2063) — literal classes for Tailwind. */
const STATUS_EDGE: Readonly<Record<AppointmentStatus, string>> = {
  scheduled: 'border-s-tone-butter-foreground',
  confirmed: 'border-s-tone-sky-foreground',
  checked_in: 'border-s-tone-lav-foreground',
  completed: 'border-s-tone-sage-foreground',
  cancelled: 'border-s-tone-stone-foreground',
  no_show: 'border-s-tone-blush-foreground',
};

/**
 * Each variant's box: placed on the column; a Month line — 22px, so with the
 * cell's 4px gap each takes the 26px `monthFit` counts in (H:5938); a popover
 * row.
 */
const VARIANT_BOX = {
  grid: 'absolute start-(--block-start) top-(--block-top) z-1 h-(--block-height) w-(--block-width) py-1 max-md:px-2 max-md:text-xs',
  chip: 'relative h-5.5 w-full flex-none',
  list: 'relative w-full flex-none py-1',
} as const;

/** A `grid` block's place as the CSS variables its box reads. */
function placeOf(geometry: BlockGeometry | undefined): CSSProperties | undefined {
  if (!geometry) return undefined;
  return {
    '--block-top': `${geometry.top}px`,
    '--block-height': `${geometry.height}px`,
    '--block-start': geometry.insetInlineStart,
    '--block-width': geometry.width,
  } as CSSProperties;
}

/**
 * The block's paint (H:2063): 1px border with the 3px status edge, the status
 * tint, 11px text; white with a shadow under the pointer.
 */
function blockClassName(
  status: AppointmentStatus,
  variant: CalendarBlockVariant,
  oneLine: boolean,
): string {
  return cn(
    'border-border text-foreground text-micro box-border flex min-w-0 content-start items-center gap-x-1.25 gap-y-0.75 overflow-hidden rounded-lg border border-s-3 px-1.5 text-start leading-[1.25] transition-[background-color,box-shadow] duration-150',
    'hover:bg-card hover:shadow-(--elevation-menu)',
    TONE_CLASSES[APPOINTMENT_STATUS_TONES[status]].bg,
    STATUS_EDGE[status],
    oneLine ? 'flex-nowrap' : 'flex-wrap',
    VARIANT_BOX[variant],
  );
}

/**
 * How a block sits: `grid` — placed on a Day or Week column by its geometry;
 * `chip` — a Month cell's single line: the person, the doctor and the time
 * (the tint and the edge carry the status); `list` — a row of the Month day
 * popover, its two lines wrapping like a tall block's.
 */
export type CalendarBlockVariant = 'grid' | 'chip' | 'list';

/** Props for {@link CalendarBlock}. */
export interface CalendarBlockProps {
  appointment: AppointmentRow;
  variant: CalendarBlockVariant;
  /** Where a `grid` block sits in its column. */
  geometry?: BlockGeometry;
  /** It overlaps another booking of the same doctor (Day) — said in the tooltip. */
  clash?: boolean;
}

/**
 * One booking on a calendar (KICKOFF §6.4 Blocks; H:2063, H:5929–5930): a real
 * button with a 3px inline-start edge in the status's ink on its tint — the
 * person's 18px avatar with its "P" or "L" badge, the name, the doctor's 16px
 * initials disc, then "10:30 am · 20m", the service pill and the status pill.
 * Under 40px (a `grid` block) or as a Month chip everything stays on one line.
 * Its tooltip names the booking ("… · overlaps another booking" when the same
 * doctor clashes on a Day); hovered 420ms it shows the appointment card, a
 * press opens the booking's drawer.
 */
export function CalendarBlock({
  appointment,
  variant,
  geometry,
  clash = false,
}: CalendarBlockProps) {
  const { t } = useTranslation([APPOINTMENTS_NS, CLINIC_NS]);
  const actions = useAppointmentActions();
  const slotLabel = useAppointmentSlotLabel();
  const { person, doctor } = appointment;
  const time = slotLabel(appointment.date, appointment.startTime).time;
  const statusLabel = t(CLINIC_KEYS.appointments.statuses[appointment.status], {
    ns: CLINIC_NS,
  });
  const doctorName = doctor ? staffName(doctor) : '';
  const title = t(
    clash ? APPOINTMENTS_KEYS.calendar.blockClash : APPOINTMENTS_KEYS.calendar.block,
    {
      name: person.name,
      time,
      minutes: appointment.durationMin,
      service: appointment.serviceLabel,
      doctor: doctorName,
      status: statusLabel,
    },
  );
  const oneLine =
    variant === 'chip' || (variant === 'grid' && geometry?.oneLine === true);
  const blockRef = useRef<HTMLButtonElement>(null);
  // The card's "Cancel" opens the Change status popover under the block, on
  // its cancel view (`null` = closed).
  const [statusView, setStatusView] = useState<AppointmentStatusView | null>(null);

  return (
    <>
      <AppointmentHoverCard
        appointment={appointment}
        onCancel={() => setStatusView('cancel')}
      >
        <button
          ref={blockRef}
          type="button"
          title={title}
          data-slot="calendar-block"
          data-testid={APPOINTMENTS_TEST_IDS.block}
          data-status={appointment.status}
          onClick={() => actions.open(appointment)}
          style={variant === 'grid' ? placeOf(geometry) : undefined}
          className={blockClassName(appointment.status, variant, oneLine)}
        >
          <PersonAvatar
            size="line"
            initials={personInitials(person.name)}
            tone={blockPersonTone(person.kind)}
            patient={person.kind === 'patient'}
            lead={person.kind === 'lead'}
          />
          <span className="text-caption min-w-0 flex-[1_1_60px] truncate leading-[1.25] font-semibold">
            {person.name}
          </span>
          {doctor ? (
            <PersonAvatar size="disc" initials={doctor.initials} tone={doctor.tone} />
          ) : null}
          {oneLine ? null : <span aria-hidden="true" className="h-0 basis-full" />}
          <span className="text-foreground-soft flex-none whitespace-nowrap tabular-nums">
            {t(APPOINTMENTS_KEYS.calendar.blockTime, {
              time,
              minutes: appointment.durationMin,
            })}
          </span>
          {variant === 'chip' ? null : (
            <>
              <TonePill
                tone={serviceTone(appointment)}
                size="xs"
                className="flex-[0_1_auto]"
              >
                {appointment.serviceLabel}
              </TonePill>
              <AppointmentStatusPill
                status={appointment.status}
                size="xs"
                className="bg-card ps-1.5 pe-1.75"
              />
            </>
          )}
        </button>
      </AppointmentHoverCard>
      {statusView ? (
        <AppointmentStatusPopover
          appointment={appointment}
          anchorRef={blockRef}
          open
          onOpenChange={(open) => {
            if (!open) setStatusView(null);
          }}
          view={statusView}
          onViewChange={setStatusView}
        />
      ) : null}
    </>
  );
}
