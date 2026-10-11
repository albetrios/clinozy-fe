import { useParams } from '@tanstack/react-router';
import { Fragment, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import {
  organizationPatientPhoto,
  organizationPatientSection,
  organizationPrescriptionEdit,
  organizationReport,
  organizationTreatmentEdit,
} from '@/lib/routes/patient-file-builders.ts';
import { cn } from '@/lib/utils.ts';
import { type CivilDayReading, civilDayReading } from '@/shared/api/app/app-time.ts';
import type { ContactActivityEntry } from '@/shared/api/app/contact-activities-api.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { PatientFileSectionSlug } from '@/shared/app/patient-file-sections.ts';
import { PersonAvatar, shortPersonName } from '@/shared/components/Cells/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  type RoomViewTab,
  RoomViewTabs,
} from '@/shared/components/RoomToolbar/RoomTabs/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import {
  useContactActivities,
  useContactActivityAccess,
} from '@/shared/hooks/useContactActivities/index.ts';
import { ClipboardList } from '@/shared/icons/index.ts';

import {
  type StaffChip,
  useStaffLookup,
} from '../../../shared/hooks/useStaffLookup/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import {
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import {
  ACTIVITY_VIEW_LOOKS,
  activityLook,
  activityRows,
  type ActivityView,
  activityViewFilter,
  activityViews,
  maskedBody,
} from './activity-timeline.ts';

const K = TIMELINE_KEYS.activity;

/** How many entries a page of the timeline reads — "Load more" reads the next. */
const PAGE_SIZE = 20;

/** The readings whose name is a word or a weekday, so the date follows it. */
const NAMED_DAYS = new Set<CivilDayReading>([
  'today',
  'yesterday',
  'tomorrow',
  'thisWeek',
]);

/**
 * A day's header (H:4861), named by the rooms' one time rule: "Today",
 * "Yesterday" or "Sat" over the date ("3 Oct"); a week back the date alone
 * ("24 Sep").
 */
function useDayHeading(): (day: string) => { main: string; sub: string | null } {
  const clock = useAppClock();
  return (day) => ({
    main: clock.day(day),
    sub: NAMED_DAYS.has(civilDayReading(clock.today, day)) ? clock.date(day) : null,
  });
}

/**
 * What a row opens: its record where the file has a route for it (the Rx and treatment
 * drawers, the photo viewer, the report), else its record's section — each only for a member
 * who may open it; a note opens Team notes; a task's event or one with no record opens nothing.
 */
function useEntryOpen(): (entry: ContactActivityEntry) => (() => void) | null {
  const navigate = useAppNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId, viewable } = usePatientFileContext();
  const record = (section: PatientFileSectionSlug, go: () => Promise<void>) =>
    viewable.includes(section) ? () => void go() : null;
  const section = (target: PatientFileSectionSlug) =>
    record(target, () =>
      navigate(organizationPatientSection(organizationSlug, patientId, target)),
    );
  return (entry) => {
    if (entry.type === 'note') return section('notes');
    const { link } = entry;
    switch (link?.kind) {
      case 'prescription':
        return record('prescriptions', () =>
          navigate(organizationPrescriptionEdit(organizationSlug, patientId, link.id)),
        );
      case 'treatment':
        return record('treatments', () =>
          navigate(organizationTreatmentEdit(organizationSlug, patientId, link.id)),
        );
      case 'image':
        return record('images', () =>
          navigate(organizationPatientPhoto(organizationSlug, patientId, link.id)),
        );
      case 'report':
        return record('reports', () =>
          navigate(organizationReport(organizationSlug, patientId, link.id)),
        );
      case 'clinicalNote':
      case 'checkIn':
      case 'review':
        return section('overview');
      case 'appointment':
        return section('visits');
      case 'invoice':
        return section('invoices');
      case 'payment':
        return section('payments');
      case 'offering':
        return section('packages');
      default:
        return null;
    }
  };
}

/**
 * The view tabs (H:4864) — the room view tabs' track: each group's icon, "All"
 * spelled out, the open one in its tone's ink; the server counts no group, so
 * no tab carries a count (§6 #2). In-page views of the list: the arrows move,
 * Enter or Space opens.
 */
function ActivityFilters({
  views,
  active,
  onSelect,
  controls,
}: {
  views: readonly ActivityView[];
  active: ActivityView;
  onSelect: (view: ActivityView) => void;
  controls?: string;
}) {
  const { t } = useTranslation(TIMELINE_NS);
  const tabs: RoomViewTab[] = views.map((view) => {
    const label = t(K.filters[view]);
    if (view === 'all') {
      return { id: view, label, badge: <span>{label}</span>, iconOnly: true };
    }
    const look = ACTIVITY_VIEW_LOOKS[view];
    return {
      id: view,
      label,
      icon: look.icon,
      iconOnly: true,
      selectedClassName: TONE_CLASSES[look.tone].ink,
    };
  });
  return (
    <RoomViewTabs
      label={t(K.filtersLabel)}
      tabs={tabs}
      value={active}
      onValueChange={(next) => {
        const view = views.find((entry) => entry === next);
        if (view) onSelect(view);
      }}
      controls={controls}
      testIds={{ list: TIMELINE_TEST_IDS.filters, tab: TIMELINE_TEST_IDS.filter }}
      className="w-auto"
    />
  );
}

/**
 * One row (H:4856–4863): the record's tile, the server's line — a note's text
 * — its time and who wrote it; it opens its record when the member may.
 */
function ActivityRowView({
  entry,
  body,
  time,
  by,
  onOpen,
}: {
  entry: ContactActivityEntry;
  body: string;
  time: string;
  by: StaffChip | null;
  onOpen: (() => void) | null;
}) {
  const look = activityLook(entry);
  const Icon = look.icon;
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-7 flex-none items-center justify-center rounded-lg',
          TONE_CLASSES[look.tone].surface,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span
        className={cn(
          'text-body min-w-0 flex-1 break-words',
          entry.type === 'note' ? 'text-muted-foreground-strong' : 'font-medium',
        )}
      >
        {body}
      </span>
      <span className="text-muted-foreground flex-none text-xs tabular-nums">{time}</span>
      {by ? (
        <span title={shortPersonName(by.name)} className="flex-none">
          <PersonAvatar size="chip" initials={by.initials} tone={by.tone} />
        </span>
      ) : null}
    </>
  );
  const shared = {
    'data-testid': TIMELINE_TEST_IDS.activityRow,
    'data-kind': entry.link?.kind ?? entry.type,
  };
  const className =
    '-mx-2 flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 text-start';
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      {...shared}
      className={cn(className, 'hover:bg-canvas transition-colors')}
    >
      {content}
    </button>
  ) : (
    <div {...shared} className={className}>
      {content}
    </div>
  );
}

/**
 * The Overview's activity timeline (KICKOFF §6.6, D19; H:4840–4864; §6 #2): a
 * card after the bento — the person's activity on clinozy-be, not a feed of
 * its own: the server's record events and the team's notes, newest first under
 * their days, a page at a time ("Load more"), each opening its record. The
 * tabs are the stream's own filters — All, Clinical, Billing (billing view
 * only), Notes. The conversation is the Activity column's. Nothing for a member
 * who may not read the stream (`contact_activity:read`).
 */
export function ActivityTimeline() {
  const { t } = useTranslation([TIMELINE_NS, ERRORS_NS]);
  const titleId = useId();
  const listId = useId();
  const heading = useDayHeading();
  const clock = useAppClock();
  const open = useEntryOpen();
  const staff = useStaffLookup();
  const { file, viewable, masked } = usePatientFileContext();
  const { reads } = useContactActivityAccess();
  const billing = viewable.includes('invoices');
  const views = activityViews({ billing });
  const [view, setView] = useState<ActivityView>('all');
  const active = views.includes(view) ? view : 'all';
  const stream = useContactActivities(
    file?.patient.contactId,
    activityViewFilter(active, { billing }),
    { limit: PAGE_SIZE, enabled: reads },
  );
  if (!reads) return null;
  const rows = activityRows(stream.entries, clock.dayOf);

  return (
    <section
      data-slot="card"
      data-testid={TIMELINE_TEST_IDS.activity}
      aria-labelledby={titleId}
      aria-busy={stream.isRefreshing || undefined}
      className="bg-card mt-3 flex min-w-0 flex-col gap-3 rounded-xl border p-3.5"
    >
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-lg',
            TONE_CLASSES.stone.surface,
          )}
        >
          <ClipboardList className="size-3.75" />
        </span>
        <h3 id={titleId} className="text-field font-semibold">
          {t(K.title)}
        </h3>
        <span className="flex-1" />
        <ActivityFilters
          views={views}
          active={active}
          onSelect={setView}
          controls={rows.length > 0 ? listId : undefined}
        />
      </div>
      {stream.isPending && file ? <SkeletonRows rows={3} label={t(K.title)} /> : null}
      {stream.isError && rows.length === 0 ? (
        <RetryError
          message={t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS })}
          onRetry={stream.refetch}
        />
      ) : null}
      {rows.length > 0 ? (
        <div
          id={listId}
          className={cn('flex flex-col', stream.isRefreshing && 'opacity-60')}
        >
          {rows.map((row) => {
            const day = row.newDay ? heading(row.day) : null;
            return (
              <Fragment key={row.entry.id}>
                {day ? (
                  <div className="flex items-baseline gap-2 pt-2 pb-1 first:pt-0">
                    <span className="text-xs font-semibold">{day.main}</span>
                    {day.sub ? (
                      <span className="text-muted-foreground text-xs">{day.sub}</span>
                    ) : null}
                  </div>
                ) : null}
                <ActivityRowView
                  entry={row.entry}
                  body={masked ? maskedBody(row.entry.body, t(K.masked)) : row.entry.body}
                  time={clock.time(row.entry.occurredAt)}
                  by={staff(row.entry.authorId)}
                  onOpen={open(row.entry)}
                />
              </Fragment>
            );
          })}
        </div>
      ) : null}
      {stream.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          onClick={stream.fetchNextPage}
          isLoading={stream.isFetchingNextPage}
          data-testid={TIMELINE_TEST_IDS.activityMore}
          className="text-body h-9 self-center rounded-lg px-3.5"
        >
          {t(K.loadMore)}
        </Button>
      ) : null}
      {stream.isSuccess && rows.length === 0 ? (
        <EmptyState variant="inline" title={t(K.empty)} />
      ) : null}
    </section>
  );
}
