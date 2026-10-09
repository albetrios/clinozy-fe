import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  type AppointmentCalendarView,
  appointmentViewRange,
} from '@/shared/api/clinic/appointment-views.ts';
import type { AppointmentView } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { RoomToolbar, RoomViewTabs } from '@/shared/components/RoomToolbar/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { ChevronLeft, ChevronRight } from '@/shared/icons/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import {
  isCurrentPeriod,
  useAppointmentsNavigation,
} from '../../hooks/useAppointmentsNavigation/index.ts';
import { useAppointmentActions } from '../AppointmentActions/index.ts';
import { AppointmentFilters } from '../AppointmentFilters/index.ts';

/** The table id the toolbar's test ids and the floating "New" carry. */
const TABLE_ID = 'appointments';

/**
 * "Today" / "This week" / "This month" and the period group "‹ <period> ›"
 * (H:1994; KICKOFF §6.4 Toolbar): 36px; the arrows 34px with their own
 * names; the label at least 150px, 13.5px/600 — "Sat 3 Oct 2026",
 * "27 Sep – 3 Oct", "October 2026" in the member's date format.
 */
function PeriodControls({ view }: { view: AppointmentCalendarView }) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const { formatDate } = useLocaleFormat();
  const navigation = useAppointmentsNavigation();
  const keys = APPOINTMENTS_KEYS.toolbar;
  const { anchor } = navigation;
  const current = isCurrentPeriod(view, anchor, clinicToday());
  const day = (date: string, options: Intl.DateTimeFormatOptions) =>
    formatDate(localDateOf(date), options, { civilDay: true });
  let label = day(anchor, { month: 'long', year: 'numeric' });
  if (view === 'day') {
    label = day(anchor, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } else if (view === 'week') {
    const { from, to } = appointmentViewRange('week', anchor);
    label = t(keys.weekRange, {
      from: day(from, { day: 'numeric', month: 'short' }),
      to: day(to, { day: 'numeric', month: 'short' }),
    });
  }
  const arrow =
    'hover:bg-muted flex h-full w-8.5 flex-none items-center justify-center transition-colors';

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-pressed={current}
            data-testid={APPOINTMENTS_TEST_IDS.today}
            onClick={navigation.goToday}
            className={cn(
              'px-3 shadow-none',
              current ? 'bg-muted' : 'bg-card hover:bg-muted',
            )}
          >
            {t(keys.today[view])}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t(keys.jump[view])}</TooltipContent>
      </Tooltip>
      <fieldset
        aria-label={t(keys.period)}
        data-slot="surface"
        className="bg-card m-0 flex h-9 min-w-0 flex-none items-center overflow-hidden rounded-lg border p-0"
      >
        <button
          type="button"
          aria-label={t(keys.previous[view])}
          title={t(keys.previous[view])}
          data-testid={APPOINTMENTS_TEST_IDS.periodPrevious}
          onClick={() => navigation.shiftPeriod(view, -1)}
          className={cn(arrow, 'border-e')}
        >
          <ChevronLeft aria-hidden="true" className="size-3.75 rtl:rotate-180" />
        </button>
        <span
          aria-live="polite"
          data-testid={APPOINTMENTS_TEST_IDS.periodLabel}
          className="text-field min-w-37.5 px-3 text-center font-semibold whitespace-nowrap tabular-nums"
        >
          {label}
        </span>
        <button
          type="button"
          aria-label={t(keys.next[view])}
          title={t(keys.next[view])}
          data-testid={APPOINTMENTS_TEST_IDS.periodNext}
          onClick={() => navigation.shiftPeriod(view, 1)}
          className={cn(arrow, 'border-s')}
        >
          <ChevronRight aria-hidden="true" className="size-3.75 rtl:rotate-180" />
        </button>
      </fieldset>
    </>
  );
}

/** Props for {@link AppointmentsToolbar}. */
export interface AppointmentsToolbarProps {
  /** The view shown (Week renders Day on a phone). */
  view: AppointmentView;
  /** The id of the view's panel (each tab's `aria-controls`). */
  panelId: string;
}

/**
 * The Appointments toolbar (KICKOFF §6.4 Toolbar; H:1991–2029,
 * `appointments.md:17`) on the shared room toolbar: the h1, the view tabs
 * "Agenda" · "Day" · "Week" · "Month" (Week not on a phone, H:5941), on a
 * calendar the period controls, the search "Patient, phone or #ID", the
 * Filters and "New appointment" — floating as the 52px pill on a phone, hidden
 * without Create. The Agenda has no period control (A-A1).
 */
export function AppointmentsToolbar({ view, panelId }: AppointmentsToolbarProps) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const tier = useViewportTier();
  const navigation = useAppointmentsNavigation();
  const actions = useAppointmentActions();
  const keys = APPOINTMENTS_KEYS.toolbar;
  const views: readonly AppointmentView[] =
    tier === 'phone' ? ['agenda', 'day', 'month'] : ['agenda', 'day', 'week', 'month'];

  return (
    <RoomToolbar
      title={t(APPOINTMENTS_KEYS.manifest.title)}
      tableId={TABLE_ID}
      tabs={
        <RoomViewTabs
          label={t(keys.viewsLabel)}
          tabs={views.map((id) => ({ id, label: t(keys.views[id]) }))}
          value={view}
          onValueChange={(next) => navigation.setView(next as AppointmentView)}
          controls={panelId}
          testIdPrefix={TABLE_ID}
        />
      }
      period={view === 'agenda' ? undefined : <PeriodControls view={view} />}
      search={{ placeholder: t(keys.search), label: t(keys.searchLabel) }}
      filtersSlot={<AppointmentFilters view={view} />}
      primary={
        actions.canCreate
          ? {
              action: {
                id: 'new-appointment',
                label: t(keys.newAppointment),
                onSelect: () => navigation.openCreate(),
              },
            }
          : undefined
      }
    />
  );
}
