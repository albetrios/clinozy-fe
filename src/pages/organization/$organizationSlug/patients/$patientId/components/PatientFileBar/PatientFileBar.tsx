import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import type { PatientFilePin } from '@/shared/api/clinic/preferences-api.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import type { PatientFileSectionSlug } from '@/shared/clinic/patient-file-sections.ts';
import { CountBadge } from '@/shared/components/Cells/CountBadge/index.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import {
  type RoomViewTab,
  RoomViewTabs,
} from '@/shared/components/RoomToolbar/RoomTabs/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import {
  ChevronLeft,
  FolderOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
} from '@/shared/icons/index.ts';

import { PatientAddMenu } from '../../shared/components/PatientAddMenu/index.ts';
import type { PatientAddItem } from '../../shared/hooks/usePatientFileActions/index.ts';
import {
  PATIENT_FILE_KEYS,
  PATIENT_FILE_NS,
} from '../../shared/patient-file.constants.ts';
import {
  PATIENT_FILE_SECTION_ICONS,
  PATIENT_FILE_SECTION_TONES,
  type PatientFileTab,
  patientFileTabs,
} from '../../shared/patient-file-nav.ts';
import { lastFourDigits } from '../PatientRail/patient-rail.ts';
import {
  PATIENT_SECTIONS_POPOVER_KEYS,
  PATIENT_SECTIONS_POPOVER_NS,
  PATIENT_SECTIONS_TEST_ID,
  PatientSectionsPopover,
} from '../PatientSectionsPopover/index.ts';
import {
  PATIENT_FILE_BAR_KEYS,
  PATIENT_FILE_BAR_NS,
  PATIENT_FILE_BAR_TEST_IDS,
} from './patient-file-bar.constants.ts';

const K = PATIENT_FILE_BAR_KEYS;
const ids = PATIENT_FILE_BAR_TEST_IDS;

/**
 * The pinned section tabs (H:710; `patient-file.md:17`) — the room view tabs'
 * `plain` look: no track, scrolling sideways without a scrollbar; 32px tabs, a
 * 14px icon (muted until open) and the 13px label; the open one in its tone at
 * 600, the others tinted 45% on hover; an unpinned open section with its 5px
 * dot. ← / → open the previous / next tab (mirrored right-to-left) and keep
 * focus on it (H:4942 `tabKey`); Home / End jump.
 */
function FileBarTabs({
  tabs,
  current,
  onOpen,
}: {
  tabs: readonly PatientFileTab[];
  current: PatientFileSectionSlug | null;
  onOpen: (section: PatientFileSectionSlug) => void;
}) {
  const { t } = useTranslation([PATIENT_FILE_BAR_NS, PATIENT_FILE_NS]);
  const viewTabs: RoomViewTab[] = tabs.map((tab) => {
    const tone = TONE_CLASSES[PATIENT_FILE_SECTION_TONES[tab.section]];
    return {
      id: tab.section,
      label: t(PATIENT_FILE_KEYS.sections[tab.section], { ns: PATIENT_FILE_NS }),
      icon: PATIENT_FILE_SECTION_ICONS[tab.section],
      selectedClassName: cn(tone.surface, 'font-semibold'),
      idleClassName: cn('text-foreground-soft font-medium', tone.hover),
      badge: tab.temporary ? (
        <span
          title={t(K.notPinned)}
          data-slot="pill"
          className="size-1.25 flex-none rounded-full bg-current opacity-50"
        >
          <span className="sr-only">{t(K.notPinned)}</span>
        </span>
      ) : undefined,
    };
  });
  return (
    <RoomViewTabs
      look="plain"
      activation="automatic"
      label={t(K.tabs)}
      tabs={viewTabs}
      value={current ?? ''}
      onValueChange={(section) => {
        const tab = tabs.find((entry) => entry.section === section);
        if (tab) onOpen(tab.section);
      }}
      testIds={{ list: ids.tabs, tab: (section) => `${ids.tab}-${section}` }}
      className="min-w-0 flex-1"
    />
  );
}

/** Props of {@link PatientFileBar}. */
export interface PatientFileBarProps {
  file: PatientFile;
  section: PatientFileSectionSlug | null;
  viewable: readonly PatientFileSectionSlug[];
  pins: readonly PatientFilePin[];
  onTogglePin: (section: PatientFileSectionSlug) => void;
  onOpenSection: (section: PatientFileSectionSlug) => void;
  onBack: () => void;
  /** The Add-to-record items the member may use; none hides "+". */
  addItems: readonly PatientAddItem[];
  activityOpen: boolean;
  onToggleActivity: () => void;
  /** "Start visit" — hidden while a Visit is open (H:711 `notVisit`) or without it. */
  onStartVisit?: () => void;
  /** "Visit in progress · Resume" — while the patient has an open Visit away from its flow (A-F4). */
  onResumeVisit?: () => void;
}

/** A control with the app's tooltip (never on a phone). */
function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The Activity toggle (H:711, H:5001): sage while open, the unread badge while closed; icon-only on a phone. */
function ActivityToggle({
  open,
  unread,
  onToggle,
}: {
  open: boolean;
  unread: number;
  onToggle: () => void;
}) {
  const { t } = useTranslation(PATIENT_FILE_BAR_NS);
  const label = t(open ? K.hideActivity : K.showActivity);
  const Icon = open ? PanelRightClose : PanelRightOpen;
  return (
    <Tip label={label}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={open}
        aria-label={label}
        data-testid={ids.activity}
        data-slot="button"
        className={cn(
          'text-body relative flex h-9 flex-none items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors max-md:w-9 md:ps-2.5 md:pe-3',
          open
            ? 'bg-tone-sage text-tone-sage-foreground border-tone-sage-border hover:bg-tone-sage/80'
            : 'bg-card text-foreground hover:bg-muted',
        )}
      >
        <Icon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        <span className="max-md:sr-only">{t(K.activity)}</span>
        {!open && unread > 0 ? (
          <CountBadge
            count={unread}
            tone="success"
            srLabel={t(K.unread, { count: unread })}
            className="max-md:absolute max-md:-end-1 max-md:-top-1"
          />
        ) : null}
      </button>
    </Tip>
  );
}

/**
 * The patient file's bar (KICKOFF §6.6 File bar; H:703–711): from `md` one
 * row — Back, the breadcrumb while the rail shows or the identity block
 * otherwise, the visit pill, the folder button and the pinned tabs, then "+",
 * "Start visit" and "Activity". Below `md` a 3-column grid: Back · the name
 * over "#3508 · +91 ••••• •3212" · the end cluster, then the folder and the
 * tabs across, then the visit pill (H:102–116). The identity line is always
 * masked.
 */
export function PatientFileBar({
  file,
  section,
  viewable,
  pins,
  onTogglePin,
  onOpenSection,
  onBack,
  addItems,
  activityOpen,
  onToggleActivity,
  onStartVisit,
  onResumeVisit,
}: PatientFileBarProps) {
  const { t } = useTranslation([PATIENT_FILE_BAR_NS, PATIENT_SECTIONS_POPOVER_NS]);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { patient } = file;
  const name = patientName(patient);
  const identity = t(K.identity, {
    id: displayId.patient(patient.seq),
    phone: t(K.maskedPhone, { last4: lastFourDigits(patient.phone) }),
  });
  const tabs = patientFileTabs(pins, section, viewable);

  return (
    <div
      data-slot="file-bar"
      className="grid flex-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-(--room-toolbar-pad) md:flex md:flex-nowrap md:gap-2.5"
    >
      <Tip label={t(K.backHint)}>
        <button
          type="button"
          onClick={onBack}
          aria-label={t(K.back)}
          data-testid={ids.back}
          data-slot="button"
          className="bg-card text-foreground-soft hover:bg-muted col-start-1 row-start-1 flex size-9 flex-none items-center justify-center rounded-lg border transition-colors"
        >
          <ChevronLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        </button>
      </Tip>

      {/* While the rail shows: "Patients / <name>" (H:703 `crumbDisp`). */}
      <span className="hidden min-w-0 items-baseline gap-2 border-e pe-2.5 lg:group-data-[activity=closed]/file:flex xl:flex">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground text-xl leading-[1.2] font-semibold tracking-[-0.015em] transition-colors"
        >
          {t(K.patients)}
        </button>
        <span aria-hidden="true" className="text-border-strong text-xl leading-[1.2]">
          /
        </span>
        <h1
          dir="auto"
          className="min-w-0 truncate text-xl leading-[1.2] font-semibold tracking-[-0.015em]"
        >
          {name}
        </h1>
      </span>

      {/* Otherwise the identity block; the avatar from `md` (H:4942 `idDisp`, H:110). */}
      <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-2.5 lg:group-data-[activity=closed]/file:hidden xl:hidden">
        <PersonAvatar
          size="cell"
          tone="sage"
          initials={personInitials(name)}
          className="max-md:hidden"
        />
        <span className="flex min-w-0 flex-col leading-[1.3]">
          {/* The page's heading wherever the breadcrumb's is hidden — the name in
              its own direction, "#3508 · +91 ••••• •3212" always left to right. */}
          <h1
            dir="auto"
            className="truncate [text-align:match-parent] text-sm leading-[1.3] font-semibold whitespace-nowrap"
          >
            {name}
          </h1>
          <span
            dir="ltr"
            className="text-caption text-muted-foreground truncate [text-align:match-parent] whitespace-nowrap tabular-nums"
          >
            {identity}
          </span>
        </span>
      </span>

      {onResumeVisit ? (
        <button
          type="button"
          onClick={onResumeVisit}
          data-slot="pill"
          className="bg-tone-sage text-tone-sage-foreground col-start-1 row-start-3 inline-flex h-6 max-w-full flex-none items-center gap-1.5 justify-self-start rounded-full px-2.5 text-xs font-medium whitespace-nowrap"
        >
          <span aria-hidden="true" className="bg-success size-1.75 rounded-full" />
          {t(K.visitPill)}
        </button>
      ) : null}

      <div className="col-span-3 row-start-2 flex min-w-0 items-center gap-2 md:flex-1 md:gap-0.5">
        {/* The folder button's trailing hairline, on a phone too (H:704). */}
        <div className="flex-none border-e pe-2 md:me-1.5">
          <PatientSectionsPopover
            open={sectionsOpen}
            onOpenChange={setSectionsOpen}
            patientName={name}
            current={section}
            viewable={viewable}
            counts={file.counts}
            pins={pins}
            onTogglePin={onTogglePin}
            onPick={(picked) => {
              setSectionsOpen(false);
              onOpenSection(picked);
            }}
            trigger={
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={t(PATIENT_SECTIONS_POPOVER_KEYS.trigger, {
                  ns: PATIENT_SECTIONS_POPOVER_NS,
                })}
                title={t(PATIENT_SECTIONS_POPOVER_KEYS.trigger, {
                  ns: PATIENT_SECTIONS_POPOVER_NS,
                })}
                data-testid={PATIENT_SECTIONS_TEST_ID}
                data-slot="button"
                className={cn(
                  'text-foreground-soft hover:bg-muted flex size-9 items-center justify-center rounded-lg border transition-colors md:size-8',
                  sectionsOpen ? 'bg-muted border-border-strong' : 'bg-card',
                )}
              >
                <FolderOpen aria-hidden="true" className="size-4" />
              </button>
            }
          />
        </div>
        <FileBarTabs tabs={tabs} current={section} onOpen={onOpenSection} />
      </div>

      <div className="col-start-3 row-start-1 flex flex-none items-center gap-2">
        {addItems.length > 0 ? (
          <PatientAddMenu
            variant="file"
            firstName={patient.firstName}
            items={addItems}
            open={addOpen}
            onOpenChange={setAddOpen}
            trigger={
              <button
                type="button"
                aria-label={t(K.addToRecord)}
                title={t(K.addToRecord)}
                data-testid={ids.add}
                data-slot="button"
                className="bg-card text-foreground hover:bg-muted flex size-9 flex-none items-center justify-center rounded-lg border transition-colors"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            }
          />
        ) : null}
        {onStartVisit ? (
          <button
            type="button"
            onClick={onStartVisit}
            data-testid={ids.startVisit}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-body flex h-9 flex-none items-center gap-1.5 rounded-lg ps-2 pe-2.5 font-medium whitespace-nowrap transition-colors md:ps-3 md:pe-3.5"
          >
            <Play aria-hidden="true" className="size-3.25 rtl:-scale-x-100" />
            {t(K.startVisit)}
          </button>
        ) : null}
        <ActivityToggle
          open={activityOpen}
          unread={file.unread}
          onToggle={onToggleActivity}
        />
      </div>
    </div>
  );
}
