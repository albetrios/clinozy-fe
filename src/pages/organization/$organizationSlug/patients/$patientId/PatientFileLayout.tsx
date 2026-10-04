import {
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPatients } from '@/lib/routes/index.ts';
import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import { cn } from '@/lib/utils.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import {
  type PatientFileSectionSlug,
  viewablePatientFileSections,
} from '@/shared/clinic/patient-file-sections.ts';
import { SkeletonBar, SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import {
  isPatientFileMissing,
  usePatientFile,
} from '@/shared/hooks/usePatientFile/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { PatientActivity } from './components/PatientActivity/index.ts';
import { PatientFileBar } from './components/PatientFileBar/index.ts';
import { PatientRail } from './components/PatientRail/index.ts';
import { useEscapeBack } from './hooks/useEscapeBack/index.ts';
import { usePatientFileActivity } from './hooks/usePatientFileActivity/index.ts';
import { usePatientFileNavigation } from './hooks/usePatientFileNavigation/index.ts';
import {
  PATIENT_FILE_LAYOUT_KEYS,
  PATIENT_FILE_LAYOUT_NS,
} from './patient-id.constants.ts';
import type { PatientFileActivity } from './patient-id.search.ts';
import { usePatientFileActions } from './shared/hooks/usePatientFileActions/index.ts';
import { usePatientPhotoUpload } from './shared/hooks/usePatientPhotoUpload/index.ts';
import {
  PatientFileContext,
  type PatientFileContextValue,
  usePatientFileContext,
} from './shared/patient-file-context.ts';
import { patientFileSectionOf, togglePatientFilePin } from './shared/patient-file-nav.ts';

/** The rail and the breadcrumb: from `lg` with Activity closed, from `xl` open (D23; H:4923). */
const RAIL_TIER = 'hidden lg:group-data-[activity=closed]/file:flex xl:flex';

/**
 * The Activity column (H:4963): the Leads chat's width — `max(360, min(the
 * dragged width, min(980, 94vw) − 400))`, 371px at 820 and 420px from 1024.
 */
const ACTIVITY_WIDTH =
  'md:w-[max(22.5rem,min(var(--lead-chat-w),calc(min(61.25rem,94vw)_-_25rem)))]';

/** What the layout reads off the URL. */
interface FileSearch {
  activity?: PatientFileActivity;
  from?: string;
}

/**
 * The file's read failing: an unknown or deleted patient goes back to the list
 * with "Patient not found · it may have been deleted" (S:115); anything else
 * keeps what is on screen and raises the list-error toast with Retry.
 */
function useFileLoadFailure(
  query: ReturnType<typeof usePatientFile>,
  patientId: string,
  onMissing: () => void,
) {
  const { t } = useTranslation([PATIENT_FILE_LAYOUT_NS, ERRORS_NS]);
  const missing = isPatientFileMissing(query.error);
  useListLoadError(
    { isError: query.isError && !missing, refetch: () => void query.refetch() },
    `patient-file:${patientId}`,
  );
  const reportedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!missing || reportedFor.current === patientId) return;
    reportedFor.current = patientId;
    notify.info(
      t(ERRORS_KEYS.route.recordNotFound, {
        ns: ERRORS_NS,
        record: t(PATIENT_FILE_LAYOUT_KEYS.notFoundRecord),
      }),
    );
    onMissing();
  }, [missing, patientId, onMissing, t]);
}

/** The sections the member may open (Q-F1), and whether access has answered. */
function useViewableSections() {
  const access = useClinicAccess();
  return useMemo(
    () => ({
      resolved: access.isResolved,
      viewable: access.isResolved
        ? viewablePatientFileSections({
            patients: access.can('patients', 'view'),
            billing: access.can('payments', 'view'),
          })
        : [],
      access,
    }),
    [access],
  );
}

/**
 * A section the member may not open — a billing section without billing view,
 * a clinical one for an Accountant — goes to the first they may (an Accountant
 * lands on Invoices, A-F14); with none, back to the list with the permission
 * toast.
 */
function useSectionGuard(
  section: PatientFileSectionSlug | null,
  {
    resolved,
    viewable,
  }: { resolved: boolean; viewable: readonly PatientFileSectionSlug[] },
  go: {
    section: (target: PatientFileSectionSlug) => void;
    list: () => void;
  },
) {
  const { t } = useTranslation(ERRORS_NS);
  const blocked = resolved && section !== null && !viewable.includes(section);
  const target = viewable[0] ?? null;
  useEffect(() => {
    if (!blocked) return;
    if (target) {
      go.section(target);
      return;
    }
    notify.info(t(ERRORS_KEYS.api.http403));
    go.list();
  }, [blocked, target, go, t]);
}

/** The bar and the main card as flat bars while the file opens (KICKOFF §6.6 States). */
function FileSkeleton() {
  const { t } = useTranslation(PATIENT_FILE_LAYOUT_NS);
  return (
    <>
      <div className="flex flex-none items-center gap-2.5 p-(--room-toolbar-pad)">
        <SkeletonBar shape="field" className="size-9 flex-none" />
        <SkeletonBar shape="avatar" />
        <SkeletonBar index={1} className="max-w-60" />
      </div>
      <div
        data-slot="card"
        className="bg-card m-(--room-card-margin) flex min-h-0 flex-1 flex-col rounded-xl border p-5 max-md:rounded-none max-md:border-x-0"
      >
        <SkeletonRows
          rows={6}
          avatar
          label={t(PATIENT_FILE_LAYOUT_KEYS.loading)}
          rowClassName="h-12"
        />
      </div>
    </>
  );
}

/** The file once it has loaded: bar, main card (rail + section) and Activity. */
function PatientFileBody({
  file,
  activity,
}: {
  file: PatientFile;
  activity: { open: boolean; toggle: () => void };
}) {
  const phone = useViewportTier() === 'phone';
  const { preferences, update } = usePreferences();
  const { items } = usePatientFileActions();
  const { section, viewable, masked, toggleMasked } = usePatientFileContext();
  const go = usePatientFileNavigation();

  return (
    <>
      <PatientFileBar
        file={file}
        section={section}
        viewable={viewable}
        pins={preferences.patientFilePins}
        onTogglePin={(target) =>
          update({
            patientFilePins: togglePatientFilePin(preferences.patientFilePins, target),
          })
        }
        onOpenSection={go.openSection}
        onBack={go.backToList}
        addItems={items}
        activityOpen={activity.open}
        onToggleActivity={activity.toggle}
        onStartVisit={go.startVisit}
      />
      <div className="m-(--room-card-margin) flex min-h-0 flex-1 gap-3 max-md:gap-0">
        <div
          data-slot={phone ? 'patient-file-card' : 'card'}
          className={cn(
            'bg-card flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border max-md:rounded-none max-md:border-x-0',
            activity.open && 'max-md:hidden',
          )}
        >
          <PatientRail
            file={file}
            limited={!viewable.includes('overview')}
            masked={masked}
            onToggleMasked={toggleMasked}
            onEditContact={go.editContact}
            actions={go.railActions}
            className={RAIL_TIER}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Outlet />
          </div>
        </div>
        {activity.open ? (
          <PatientActivity
            file={file}
            masked={masked}
            onOpenHistory={go.openHistory}
            onBookAppointment={go.bookAppointment}
            className={cn('w-full flex-none', ACTIVITY_WIDTH)}
          />
        ) : null}
      </div>
    </>
  );
}

/**
 * The patient file (KICKOFF §6.6, L-42; `patient-file.md`): the file bar, then
 * the body — the main card (the rail at the inline start, the open section)
 * and, while open, the Activity column. A column on `canvas` inside the room
 * gutter; below `md` one column, edge to edge, where Activity replaces the
 * main card. The tiers switch on `data-activity` — no width reads. It holds
 * the file's money mask (masked, never persisted, reset per patient), sends
 * Esc back to the list when nothing else takes it, and leaves a section the
 * member may not open.
 */
export function PatientFileLayout() {
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  const search: FileSearch = useSearch({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const leadChatWidth = useDevicePrefsStore((state) => state.leadChatWidth);
  const query = usePatientFile(patientId);
  const activity = usePatientFileActivity(search.activity);
  const sections = useViewableSections();
  const section = patientFileSectionOf(pathname, patientId, search.from);

  const go = useMemo(
    () => ({
      list: () =>
        void navigate({ ...organizationPatients(organizationSlug), replace: true }),
      section: (target: PatientFileSectionSlug) =>
        void navigate({
          ...organizationPatientSection(organizationSlug, patientId, target),
          replace: true,
        }),
    }),
    [navigate, organizationSlug, patientId],
  );
  useFileLoadFailure(query, patientId, go.list);
  useSectionGuard(section, sections, go);
  useEscapeBack(() => void navigate(organizationPatients(organizationSlug)));

  const photoUpload = usePatientPhotoUpload(patientId);
  const [mask, setMask] = useState({ patientId, masked: true });
  // Another patient's file starts masked again (Q-F4: one flag per file).
  if (mask.patientId !== patientId) setMask({ patientId, masked: true });
  const context = useMemo<PatientFileContextValue>(
    () => ({
      patientId,
      file: query.data,
      section,
      viewable: sections.viewable,
      masked: mask.masked,
      toggleMasked: () => setMask((current) => ({ ...current, masked: !current.masked })),
      photos: { pick: photoUpload.pick, upload: photoUpload.upload },
    }),
    [
      patientId,
      query.data,
      section,
      sections.viewable,
      mask.masked,
      photoUpload.pick,
      photoUpload.upload,
    ],
  );

  return (
    <PatientFileContext.Provider value={context}>
      <TooltipProvider>
        <div
          data-testid="patient-file-layout"
          data-activity={activity.open ? 'open' : 'closed'}
          className="group/file bg-canvas flex min-h-0 flex-1 flex-col"
          style={{ '--lead-chat-w': `${leadChatWidth}px` } as CSSProperties}
        >
          {query.data ? (
            <PatientFileBody file={query.data} activity={activity} />
          ) : (
            <FileSkeleton />
          )}
          <input {...photoUpload.inputProps} />
        </div>
      </TooltipProvider>
    </PatientFileContext.Provider>
  );
}
