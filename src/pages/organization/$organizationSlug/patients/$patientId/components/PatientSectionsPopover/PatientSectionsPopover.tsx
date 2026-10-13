import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { PatientFilePin } from '@/shared/api/app/preferences-api.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { PatientFileSectionSlug } from '@/shared/app/patient-file-sections.ts';
import { PickerSheet } from '@/shared/components/Picker/index.ts';
import { FolderOpen, MapPin } from '@/shared/icons/index.ts';

import {
  PATIENT_FILE_KEYS,
  PATIENT_FILE_NS,
} from '../../shared/patient-file.constants.ts';
import {
  PATIENT_FILE_GROUPS,
  PATIENT_FILE_SECTION_ICONS,
  PATIENT_FILE_SECTION_TONES,
} from '../../shared/patient-file-nav.ts';
import {
  PATIENT_SECTIONS_POPOVER_KEYS,
  PATIENT_SECTIONS_POPOVER_NS,
  PATIENT_SECTIONS_TEST_ID,
} from './patient-sections-popover.constants.ts';

const K = PATIENT_SECTIONS_POPOVER_KEYS;

/** A tile's hover border in its tone's edge colour (H:4940 `style-hover` drew the ink), as full literals. */
const HOVER_EDGE: Readonly<Partial<Record<Tone, string>>> = {
  sage: 'hover:border-tone-sage-edge',
  blush: 'hover:border-tone-blush-edge',
  sky: 'hover:border-tone-sky-edge',
  lav: 'hover:border-tone-lav-edge',
  mint: 'hover:border-tone-mint-edge',
  peach: 'hover:border-tone-peach-edge',
};

/** Props of {@link PatientSectionsPopover}. */
export interface PatientSectionsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The folder button; it receives the popover's wiring. */
  trigger: ReactElement;
  patientName: string;
  current: PatientFileSectionSlug | null;
  /** The sections the member may open; the others' tiles are left out. */
  viewable: readonly PatientFileSectionSlug[];
  pins: readonly PatientFilePin[];
  onPick: (section: PatientFileSectionSlug) => void;
  onTogglePin: (section: PatientFileSectionSlug) => void;
}

/**
 * One section tile: its tone tile, its label — "Open now" under the open one — and its pin at
 * the top end. No tile says "Empty" or "Has records": the API counts no section's records (G4).
 */
function SectionTile({
  section,
  current,
  pinned,
  onPick,
  onTogglePin,
}: {
  section: PatientFileSectionSlug;
  current: boolean;
  pinned: boolean;
  onPick: () => void;
  onTogglePin: () => void;
}) {
  const { t } = useTranslation([PATIENT_SECTIONS_POPOVER_NS, PATIENT_FILE_NS]);
  const tone = PATIENT_FILE_SECTION_TONES[section];
  const Icon = PATIENT_FILE_SECTION_ICONS[section];
  const label = t(PATIENT_FILE_KEYS.sections[section], { ns: PATIENT_FILE_NS });
  return (
    <div className="relative flex min-w-0">
      <button
        type="button"
        onClick={onPick}
        aria-current={current ? 'page' : undefined}
        data-testid={`${PATIENT_SECTIONS_TEST_ID}-tile-${section}`}
        className={cn(
          'flex min-w-0 flex-1 flex-col items-start gap-2 rounded-lg border p-2.5 text-start transition-colors',
          HOVER_EDGE[tone],
          current &&
            cn(TONE_CLASSES[tone].bg, TONE_CLASSES[tone].ring, 'border-transparent'),
          !current && 'bg-card',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 items-center justify-center rounded-md',
            TONE_CLASSES[tone].surface,
          )}
        >
          <Icon className="size-3.5 text-current" />
        </span>
        <span className="flex max-w-full min-w-0 flex-col leading-[1.3]">
          <span className="text-detail truncate leading-[1.3] font-semibold">
            {label}
          </span>
          {current ? (
            <span className="text-micro text-muted-foreground whitespace-nowrap">
              {t(K.openNow)}
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        aria-pressed={pinned}
        aria-label={t(pinned ? K.unpinAria : K.pinAria, { section: label })}
        title={t(pinned ? K.unpin : K.pin)}
        data-testid={`${PATIENT_SECTIONS_TEST_ID}-pin-${section}`}
        data-slot="pill"
        className={cn(
          'absolute end-1.5 top-1.5 flex size-6 items-center justify-center rounded-full transition-colors',
          pinned
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'text-muted-foreground hover:bg-border hover:text-foreground',
        )}
      >
        <MapPin aria-hidden="true" className="size-3" />
      </button>
    </div>
  );
}

/**
 * The patient file's sections (KICKOFF §6.6 Section popover; H:705–709): under
 * the folder button, inline-start aligned 8px below, `min(360px, 100vw − 32px)`
 * — a header with the patient, the four groups of tiles (three a row) with a
 * pin each, the footer. Picking a tile opens the section and closes it; Esc and
 * a click outside close it. Below `md` it is a bottom sheet, 85vh, undimmed.
 */
export function PatientSectionsPopover({
  open,
  onOpenChange,
  trigger,
  patientName,
  current,
  viewable,
  pins,
  onPick,
  onTogglePin,
}: PatientSectionsPopoverProps) {
  const { t } = useTranslation(PATIENT_SECTIONS_POPOVER_NS);
  const groups = PATIENT_FILE_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter((section) => viewable.includes(section)),
  })).filter((group) => group.sections.length > 0);

  return (
    <PickerSheet
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={t(K.label)}
      sheet="sections"
      sideOffset={8}
      testId={`${PATIENT_SECTIONS_TEST_ID}-panel`}
      panelClassName="bg-canvas max-h-[calc(100vh-10rem)] w-[min(22.5rem,calc(100vw-2rem))] rounded-xl"
      sheetClassName="bg-canvas"
    >
      <div
        data-slot="sections-popover-header"
        className="bg-card flex flex-none items-center gap-2.5 rounded-t-xl border-b px-3.5 py-3"
      >
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground flex size-7 flex-none items-center justify-center rounded-md"
        >
          <FolderOpen className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <span className="text-body leading-[1.3] font-semibold">{t(K.title)}</span>
          <span className="text-caption text-muted-foreground truncate">
            {patientName}
          </span>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-3 pb-3.5">
        {groups.map((group) => (
          <fieldset
            key={group.id}
            aria-label={t(K.groups[group.id])}
            className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0"
          >
            <span
              aria-hidden="true"
              className="text-micro text-muted-foreground px-0.5 font-semibold tracking-wider uppercase"
            >
              {t(K.groups[group.id])}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {group.sections.map((section) => (
                <SectionTile
                  key={section}
                  section={section}
                  current={section === current}
                  pinned={pins.includes(section)}
                  onPick={() => onPick(section)}
                  onTogglePin={() => onTogglePin(section)}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div
        data-slot="sections-popover-footer"
        className="bg-card text-caption text-muted-foreground flex-none rounded-b-xl border-t px-3.5 pt-2 pb-2.5"
      >
        {t(K.footer)}
      </div>
    </PickerSheet>
  );
}
