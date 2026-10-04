import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { AppointmentStaff } from '@/shared/api/clinic/appointments-contracts.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { SKELETON_IN_PLACE } from '@/shared/components/SkeletonRows/index.ts';
import {
  useAppointmentSlotLabel,
  useBookableStaff,
} from '@/shared/hooks/useAppointments/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { dayLoad, RAIL_HEIGHT } from '../../appointments.calendar.ts';
import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { useAppointmentsNavigation } from '../../hooks/useAppointmentsNavigation/index.ts';
import { useCalendarClock } from '../../hooks/useCalendarClock/index.ts';
import { useCalendarRange } from '../../hooks/useCalendarRange/index.ts';
import { useAppointmentActions } from '../AppointmentActions/index.ts';
import { CalendarCard, DayColumn, HourRail } from '../CalendarGrid/index.ts';
import { DoctorPicker } from '../DoctorPicker/index.ts';

/** The strip's "All doctors" value — a doctor's is their id. */
const ALL_DOCTORS = 'all';

/** One pill of the phone Day strip. */
interface StripOption {
  value: string;
  label: string;
  tone: Tone;
  /** Live bookings that day (none drawn when 0). */
  count: number;
}

/**
 * The phone's sticky "Doctor" strip (H:2055; `appointments.md:51`): a radio
 * group — "All doctors", then one 32px pill per doctor, 12.5px/500 — the one
 * picked a solid fill of its tone, the others its tint, each with that day's
 * live bookings. Counts ignore the doctor filter, so every pill keeps its
 * count once one is picked (A-A2; the prototype counts through the filter).
 * Two or more doctors picked in Filters leave every pill unpicked.
 */
function DayStrip({
  options,
  value,
  onPick,
}: {
  options: readonly StripOption[];
  value: string;
  onPick: (value: string) => void;
}) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onPick}
      orientation="horizontal"
      loop
      aria-label={t(APPOINTMENTS_KEYS.calendar.doctor)}
      data-testid={APPOINTMENTS_TEST_IDS.dayStrip}
      data-slot="surface"
      className="bg-card sticky top-0 z-4 -mx-3 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-3 pt-2.5 pb-2"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            data-slot="pill"
            data-testid={APPOINTMENTS_TEST_IDS.dayStripOption}
            className={cn(
              'text-detail inline-flex h-8 flex-none items-center gap-1.5 rounded-full border border-transparent px-3 font-medium whitespace-nowrap',
              on ? TONE_CLASSES[option.tone].fill : TONE_CLASSES[option.tone].surface,
            )}
          >
            {option.label}
            {option.count > 0 ? (
              <span className="tabular-nums opacity-80">{option.count}</span>
            ) : null}
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}

/**
 * The Day view (KICKOFF §6.4 Day; H:2054–2066, H:5947–5962): the 52px hour
 * rail and one "All doctors" column from 9 am to 10 pm. From `md` a sticky
 * header — "All doctors" · "<n> booked · <h> h" or "Free all day" · the 240px
 * doctor picker with each doctor's "<n> booked" / "free"; on a phone the
 * Doctor strip, a 44px rail and roomier blocks. An empty spot books its slot
 * to the nearest 15 minutes ("New appointment · <day> · <time>"), never on a
 * past day ("Past dates can’t be booked") and only with Create. The Day reads
 * every doctor — the picker and the strip count each one — and shows the
 * picked ones.
 */
export function AppointmentsDay() {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const tier = useViewportTier();
  const navigation = useAppointmentsNavigation();
  const actions = useAppointmentActions();
  const clock = useCalendarClock();
  const slotLabel = useAppointmentSlotLabel();
  const { formatNumber } = useLocaleFormat();
  const staff = useBookableStaff();
  const read = useCalendarRange('day', 'every');
  const day = navigation.anchor;
  const picked = navigation.search.doctor ?? [];
  const shown =
    picked.length > 0
      ? read.rows.filter((row) => picked.includes(row.doctorId))
      : read.rows;
  const live = read.rows.filter((row) => row.status !== 'cancelled');
  const bookedBy = (doctorId: string) =>
    live.filter((row) => row.doctorId === doctorId).length;
  const load = dayLoad(shown);
  const loading = read.pending || read.refreshing;
  const keys = APPOINTMENTS_KEYS.calendar;

  const pickDoctors = (ids: string[]) =>
    navigation.patch({ doctor: ids.length > 0 ? ids : undefined });
  const bookSlot = (time: string) => {
    if (day < clock.today) {
      notify.info(t(keys.pastDay));
      return;
    }
    const label = slotLabel(day, time);
    navigation.openCreate({ date: day, time });
    notify.info(t(keys.newAt, { day: label.day, time: label.time }));
  };

  const people: AppointmentStaff[] = staff.data ?? [];
  // "All doctors", the one doctor picked — or none of the pills for two or more.
  let stripValue = '';
  if (picked.length === 0) stripValue = ALL_DOCTORS;
  else if (picked.length === 1) stripValue = picked[0] ?? '';

  return (
    <CalendarCard view="day">
      <div
        style={{ '--rail-height': `${RAIL_HEIGHT}px` } as CSSProperties}
        className="min-h-0 flex-1 overflow-auto px-3 pb-3"
      >
        {tier === 'phone' ? (
          <DayStrip
            value={stripValue}
            onPick={(value) => pickDoctors(value === ALL_DOCTORS ? [] : [value])}
            options={[
              {
                value: ALL_DOCTORS,
                label: t(APPOINTMENTS_KEYS.filters.allDoctors),
                tone: 'stone',
                count: live.length,
              },
              ...people.map((person) => ({
                value: person.id,
                label: shortPersonName(personFullName(person)),
                tone: person.tone,
                count: bookedBy(person.id),
              })),
            ]}
          />
        ) : (
          <div
            data-testid={APPOINTMENTS_TEST_IDS.dayHeader}
            data-slot="surface"
            className="bg-card border-border sticky top-0 z-3 grid grid-cols-[52px_minmax(170px,1fr)] border-b"
          >
            <span aria-hidden="true" />
            <div className="flex min-w-0 items-center gap-2.5 px-2 py-2.5">
              <span className="text-body leading-[1.25] font-semibold">
                {t(APPOINTMENTS_KEYS.filters.allDoctors)}
              </span>
              <span
                className={cn(
                  'text-caption text-muted-foreground leading-[1.25] whitespace-nowrap',
                  loading && SKELETON_IN_PLACE,
                )}
              >
                <span>
                  {load.booked > 0
                    ? t(keys.dayLoad, {
                        count: load.booked,
                        hours: formatNumber(load.hours, { maximumFractionDigits: 1 }),
                      })
                    : t(keys.free)}
                </span>
              </span>
              <span className="flex-1" />
              <DoctorPicker
                value={picked}
                onChange={pickDoctors}
                size="sm"
                meta={(doctorId) => {
                  const count = bookedBy(doctorId);
                  return count > 0 ? t(keys.doctorBooked, { count }) : t(keys.doctorFree);
                }}
                withFooter
                minWidth={280}
                align="end"
                testId={APPOINTMENTS_TEST_IDS.dayDoctors}
                className="w-60 flex-none"
              />
            </div>
          </div>
        )}
        <div className="relative grid h-(--rail-height) grid-cols-[52px_minmax(170px,1fr)] max-md:grid-cols-[44px_minmax(0,1fr)]">
          <HourRail />
          <DayColumn
            date={day}
            rows={shown}
            clock={clock}
            sayClash
            onSlot={actions.canCreate ? bookSlot : undefined}
            refreshing={read.refreshing}
          />
        </div>
      </div>
    </CalendarCard>
  );
}
