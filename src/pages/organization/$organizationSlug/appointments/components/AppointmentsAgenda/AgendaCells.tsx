'use no memo';
// The cells read TanStack Table's live column and row objects (see DataTable).

import type { CellContext } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type {
  AppointmentRow,
  AppointmentStaff,
} from '@/shared/api/clinic/appointments-contracts.ts';
import {
  appointmentContactCard,
  serviceTone,
} from '@/shared/clinic/appointment-display.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import {
  PersonAvatar,
  PersonChip,
  shortPersonName,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import {
  ContactCard,
  TeamCard,
  type TeamCardData,
} from '@/shared/components/PersonCard/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { ChevronDown, Eye } from '@/shared/icons/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { latestEvent, PERSON_TONES } from '../../appointments.display.ts';
import { useLatestUpdateWords } from '../../hooks/useLatestUpdateWords/index.ts';
import { AppointmentQuickView } from '../AppointmentCard/index.ts';
import { AppointmentStatusPill } from '../AppointmentStatusPill/index.ts';
import { AppointmentStatusPopover } from '../AppointmentStatusPopover/index.ts';
import { useAgendaCells } from './agenda-cells-context.ts';

type AgendaCell = CellContext<DataTableFeatures, AppointmentRow, unknown>;

/**
 * The doctor as the team card reads them — the team directory's name, initials
 * and tone; it carries no role or presence, so the card shows neither
 * (api-integration M41). `updatedAt` is when the team was read.
 */
function teamCardOf(doctor: AppointmentStaff, updatedAt: string | null): TeamCardData {
  return {
    name: doctor.name,
    initials: doctor.initials,
    tone: doctor.tone,
    role: '',
    updatedAt,
  };
}

/** "10:30 am" over "<n> min" (13.5px/600 tabular over 11.5px). */
export function TimeCell({ row }: AgendaCell) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const { timeOf } = useAgendaCells();
  return (
    <span className="flex flex-col">
      <span className="text-field leading-[1.25] font-semibold whitespace-nowrap tabular-nums">
        {timeOf(row.original)}
      </span>
      <span className="text-caption text-muted-foreground leading-[1.25]">
        {t(APPOINTMENTS_KEYS.agenda.minutes, { minutes: row.original.durationMin })}
      </span>
    </span>
  );
}

/** The person chip under its contact card; a press opens the booking (it is the row). */
export function ContactCell({ row }: AgendaCell) {
  const { onNewLead, onNewAppointment } = useAgendaCells();
  const { person } = row.original;
  return (
    <ContactCard
      data={appointmentContactCard(person)}
      onNewLead={onNewLead ? () => onNewLead(person) : undefined}
      onNewAppointment={onNewAppointment ? () => onNewAppointment(person) : undefined}
    >
      <PersonChip
        name={person.name}
        sub={person.phone ? formatClinicPhone(person.phone) : undefined}
        tone={PERSON_TONES[person.kind]}
        patient={person.kind === 'patient'}
      />
    </ContactCard>
  );
}

/** The 24px service pill in the service's tone. */
export function ServiceCell({ row }: AgendaCell) {
  return (
    <TonePill tone={serviceTone(row.original)} className="tabular-nums">
      {row.original.serviceLabel}
    </TonePill>
  );
}

/** The 28px doctor chip: 22px avatar and the short name (H:2042) — no presence dot (M41). */
export function DoctorCell({ row }: AgendaCell) {
  const { teamUpdatedAt } = useAgendaCells();
  const { doctor } = row.original;
  if (!doctor) return null;
  return (
    // The chip is not the row (H:5915): a press only opens the team card.
    <span className="flex max-w-full min-w-0" data-row-click="ignore">
      <TeamCard data={teamCardOf(doctor, teamUpdatedAt)} triggerClassName="max-w-full">
        <span
          data-slot="pill"
          className="border-border bg-card inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border ps-0.75 pe-2.5 whitespace-nowrap"
        >
          <PersonAvatar size="chip" initials={doctor.initials} tone={doctor.tone} />
          <span className="text-detail min-w-0 truncate font-medium">
            {shortPersonName(doctor.name)}
          </span>
        </span>
      </TeamCard>
    </span>
  );
}

/** The "Latest update" pill — the booking's latest event — with its tooltip; "—" when there is none. */
export function LatestCell({ row }: AgendaCell) {
  const words = useLatestUpdateWords();
  const pill = latestEvent(row.original);
  if (!pill) {
    return (
      <span data-latest-empty="" className="text-detail text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex max-w-full min-w-0">
            <TonePill tone={pill.tone} className="text-caption gap-1 px-2.25">
              {words.label(pill)}
            </TonePill>
          </span>
        </TooltipTrigger>
        <TooltipContent>{words.hint(pill)}</TooltipContent>
      </Tooltip>
    </span>
  );
}

/** The 32px eye: the quick view, pinned at its inline start (H:2044). */
export function QuickViewCell({ row }: AgendaCell) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const { setStatusTarget } = useAgendaCells();
  const label = t(APPOINTMENTS_KEYS.agenda.columns.quickView);
  return (
    <span className="flex w-full justify-center" data-row-click="ignore">
      <Tooltip>
        <AppointmentQuickView
          appointment={row.original}
          onCancel={(appointment) =>
            setStatusTarget({ id: appointment.id, view: 'cancel' })
          }
        >
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={label}
              data-testid={APPOINTMENTS_TEST_IDS.quickView}
              className="bg-card text-muted-foreground-strong hover:bg-muted hover:text-foreground shadow-none md:max-xl:size-9"
            >
              <Eye aria-hidden="true" className="size-3.75" />
            </Button>
          </TooltipTrigger>
        </AppointmentQuickView>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </span>
  );
}

/** The 32px Status button: the status pill and a chevron that turns while the popover is open (H:2045). */
export function StatusCell({ row }: AgendaCell) {
  const { t } = useTranslation([APPOINTMENTS_NS, CLINIC_NS]);
  const { canEdit, statusTarget, setStatusTarget } = useAgendaCells();
  const appointment = row.original;
  if (!canEdit) return <AppointmentStatusPill status={appointment.status} />;
  const open = statusTarget?.id === appointment.id;
  const statusLabel = t(CLINIC_KEYS.appointments.statuses[appointment.status], {
    ns: CLINIC_NS,
  });
  return (
    <span className="flex max-w-full min-w-0" data-row-click="ignore">
      <AppointmentStatusPopover
        appointment={appointment}
        open={open}
        onOpenChange={(next) =>
          setStatusTarget(next ? { id: appointment.id, view: 'moves' } : null)
        }
        view={open ? statusTarget.view : 'moves'}
        onViewChange={(view) => setStatusTarget({ id: appointment.id, view })}
      >
        <button
          type="button"
          aria-label={t(APPOINTMENTS_KEYS.agenda.changeStatus, { status: statusLabel })}
          data-testid={APPOINTMENTS_TEST_IDS.statusButton}
          data-slot="button"
          className="border-border bg-card text-muted-foreground hover:bg-canvas inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border ps-1 pe-2 whitespace-nowrap shadow-xs transition-colors"
        >
          <AppointmentStatusPill status={appointment.status} />
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 flex-none transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
      </AppointmentStatusPopover>
    </span>
  );
}

/** The quick view's column header: named for screen readers only (H:2032 draws none). */
export function QuickViewHeader() {
  const { t } = useTranslation(APPOINTMENTS_NS);
  return <span className="sr-only">{t(APPOINTMENTS_KEYS.agenda.columns.quickView)}</span>;
}
