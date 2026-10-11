import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useId,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { readCreatedFilter } from '@/shared/api/app/app-list-filters.ts';
import { APPOINTMENT_STATUS_VALUES } from '@/shared/api/app/app-schema.ts';
import type { AppointmentView } from '@/shared/api/app/appointments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { APPOINTMENT_STATUS_TONES } from '@/shared/app/app-tones.ts';
import { DrawerChips } from '@/shared/components/DrawerField/drawer-chip-controls.tsx';
import { PickerSheet } from '@/shared/components/Picker/index.ts';
import {
  ROOM_FILTERS_KEYS,
  ROOM_TOOLBAR_NS,
  RoomDateFilter,
  RoomFiltersClear,
  RoomFiltersTrigger,
  type RoomFilterValues,
  roomToolbarTestIds,
} from '@/shared/components/RoomToolbar/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { useAppointmentsNavigation } from '../../hooks/useAppointmentsNavigation/index.ts';
import { DoctorPicker } from '../DoctorPicker/index.ts';
import {
  appliedFilters,
  type AppointmentFilterValues,
  CLEARED_FILTERS,
  countFilters,
  filtersPatch,
} from './appointment-filters-model.ts';
import { FiltersCalendar } from './FiltersCalendar.tsx';

/** The STATUS chips in order (H:5945): All · Active (open) · each status. */
const STATUS_CHIPS = ['all', 'active', ...APPOINTMENT_STATUS_VALUES] as const;

/**
 * A section: 11px/600 uppercase label over its control (H:2009, H:2022). The
 * section is the labelled group, unless its control is a group of its own —
 * the chips, handed the label's id to name themselves.
 */
function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode | ((labelId: string) => ReactNode);
}) {
  const labelId = useId();
  const heading = (
    <span
      id={labelId}
      className="text-micro text-muted-foreground font-semibold tracking-[0.04em] uppercase"
    >
      {label}
    </span>
  );
  if (typeof children === 'function') {
    return (
      <div className="flex flex-col gap-1.5">
        {heading}
        {children(labelId)}
      </div>
    );
  }
  return (
    <fieldset
      aria-labelledby={labelId}
      className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0"
    >
      {heading}
      {children}
    </fieldset>
  );
}

/** Props for {@link AppointmentFilters}. */
export interface AppointmentFiltersProps {
  /** The view shown: the day counts as a filter in the Agenda only. */
  view: AppointmentView;
  className?: string;
}

/**
 * The Appointments Filters (KICKOFF §6.4 Filters; H:1997–2025,
 * `appointments.md:103–117, 135–147`): the shared Filters button with its
 * count and joined ×, opening a 560px popover from `md` — the mini calendar
 * in a 250px column; then APPOINTED TO (one doctor), STATUS (Active by
 * default) and CREATED — no FOLLOW-UP DATE: the API has no follow-up filter on
 * bookings (G3) — and "Apply filter" after a hairline. Below `md` the 82%
 * bottom sheet, in one column with the calendar on top (the prototype kept the
 * 250px column in a 375px sheet, §7.3). Choices stay pending until Apply;
 * "Clear all" and the × apply at once; Esc or a tap outside drops them (D33).
 */
export function AppointmentFilters({ view, className }: AppointmentFiltersProps) {
  const { t } = useTranslation([APPOINTMENTS_NS, ROOM_TOOLBAR_NS, APP_NS]);
  const navigation = useAppointmentsNavigation();
  const { preferences } = usePreferences();
  const ids = roomToolbarTestIds('appointments');
  const applied = appliedFilters(navigation.search);
  const count = countFilters(applied, view);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<AppointmentFilterValues>(applied);
  const keys = APPOINTMENTS_KEYS.filters;

  const apply = (values: AppointmentFilterValues) =>
    navigation.patch(filtersPatch(values));
  const onOpenChange = (next: boolean) => {
    if (next) setPending(applied);
    setOpen(next);
  };
  const dateValues: RoomFilterValues = pending.created
    ? { created: [pending.created] }
    : {};
  const setDateValues: Dispatch<SetStateAction<RoomFilterValues>> = (update) =>
    setPending((current) => {
      const before: RoomFilterValues = current.created
        ? { created: [current.created] }
        : {};
      const next = typeof update === 'function' ? update(before) : update;
      return { ...current, created: readCreatedFilter(next.created?.[0]) };
    });

  const statusLabel = (value: (typeof STATUS_CHIPS)[number]) => {
    if (value === 'all') return t(keys.all);
    if (value === 'active') return t(keys.active);
    return t(APP_KEYS.appointments.statuses[value], { ns: APP_NS });
  };

  return (
    <div className={cn('flex h-9 flex-none items-stretch max-md:h-10', className)}>
      <PickerSheet
        open={open}
        onOpenChange={onOpenChange}
        sheet="filters"
        title={t(keys.label)}
        align="end"
        testId={ids.filters}
        panelClassName="w-140 max-w-[calc(100vw-1rem)] max-h-[min(calc(100vh-1rem),var(--radix-popover-content-available-height))] rounded-xl"
        sheetClassName="overflow-hidden"
        trigger={
          <RoomFiltersTrigger
            count={count}
            open={open}
            data-testid={ids.filtersTrigger}
          />
        }
      >
        <div className="grid min-h-0 grid-cols-1 gap-3.5 overflow-y-auto p-3.5 md:grid-cols-[250px_minmax(0,1fr)]">
          <div className="-mb-1 flex items-center justify-between md:col-span-2">
            <span className="text-field font-semibold">
              {t(ROOM_FILTERS_KEYS.title, { ns: ROOM_TOOLBAR_NS })}
            </span>
            <button
              type="button"
              data-testid={ids.filtersClearAll}
              onClick={() => {
                setPending(CLEARED_FILTERS);
                apply(CLEARED_FILTERS);
              }}
              className="text-muted-foreground hover:text-foreground rounded-sm text-xs transition-colors"
            >
              {t(ROOM_FILTERS_KEYS.clearAll, { ns: ROOM_TOOLBAR_NS })}
            </button>
          </div>
          <FiltersCalendar
            value={pending.date}
            onChange={(date) => setPending((current) => ({ ...current, date }))}
            branchIds={preferences.branchFilter}
          />
          <div className="flex min-w-0 flex-col gap-3.5">
            <Section label={t(keys.appointedTo)}>
              <DoctorPicker
                size="md"
                value={pending.doctor}
                onChange={(doctor) => setPending((current) => ({ ...current, doctor }))}
                testId={APPOINTMENTS_TEST_IDS.filtersDoctors}
              />
            </Section>
            <Section label={t(keys.status)}>
              {(labelId) => (
                <DrawerChips
                  labelledBy={labelId}
                  options={STATUS_CHIPS.map((value) => ({
                    value,
                    label: statusLabel(value),
                    tone:
                      value === 'all' || value === 'active'
                        ? 'stone'
                        : APPOINTMENT_STATUS_TONES[value],
                  }))}
                  value={pending.status}
                  onChange={(status) => {
                    if (status) setPending((current) => ({ ...current, status }));
                  }}
                  testId={APPOINTMENTS_TEST_IDS.filtersStatus}
                />
              )}
            </Section>
            <RoomDateFilter
              fieldKey="created"
              kind="created"
              values={dateValues}
              onChange={setDateValues}
            />
          </div>
          <div className="flex justify-end border-t pt-1 md:col-span-2">
            <Button
              type="button"
              size="sm"
              data-testid={ids.filtersApply}
              onClick={() => {
                apply(pending);
                setOpen(false);
              }}
              className="text-body h-8 rounded-lg px-3.5"
            >
              {t(ROOM_FILTERS_KEYS.apply, { ns: ROOM_TOOLBAR_NS })}
            </Button>
          </div>
        </div>
      </PickerSheet>
      {count > 0 ? (
        <RoomFiltersClear
          onClear={() => apply(CLEARED_FILTERS)}
          testId={ids.filtersClear}
        />
      ) : null}
    </div>
  );
}
