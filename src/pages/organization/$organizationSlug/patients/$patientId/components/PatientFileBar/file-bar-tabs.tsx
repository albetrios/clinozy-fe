import { type KeyboardEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import type { PatientFileSectionSlug } from '@/shared/clinic/patient-file-sections.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import {
  PATIENT_FILE_KEYS,
  PATIENT_FILE_NS,
} from '../../shared/patient-file.constants.ts';
import {
  PATIENT_FILE_SECTION_ICONS,
  PATIENT_FILE_SECTION_TONES,
  type PatientFileTab,
} from '../../shared/patient-file-nav.ts';
import {
  PATIENT_FILE_BAR_KEYS,
  PATIENT_FILE_BAR_NS,
  PATIENT_FILE_BAR_TEST_IDS,
} from './patient-file-bar.constants.ts';

/**
 * The pinned section tabs (H:710; `patient-file.md:17`): a tablist that
 * scrolls sideways without a scrollbar; 32px tabs, a 14px icon and the 13px
 * label; the open one in its tone at 600, the others tinted 45% on hover;
 * an unpinned open section with its 5px dot. ← / → open the previous / next
 * tab (mirrored right-to-left) and keep focus on it (H:4942 `tabKey`).
 */
export function FileBarTabs({
  tabs,
  current,
  onOpen,
}: {
  tabs: readonly PatientFileTab[];
  current: PatientFileSectionSlug | null;
  onOpen: (section: PatientFileSectionSlug) => void;
}) {
  const { t } = useTranslation([PATIENT_FILE_BAR_NS, PATIENT_FILE_NS]);
  const { direction } = useLocaleFormat();
  const refs = useRef(new Map<PatientFileSectionSlug, HTMLButtonElement>());
  // The tab a keyboard move opened: focus lands on it once it renders as selected.
  const focusNext = useRef<PatientFileSectionSlug | null>(null);
  const selectedIndex = tabs.findIndex((tab) => tab.section === current);

  useEffect(() => {
    if (!current || focusNext.current !== current) return;
    focusNext.current = null;
    refs.current.get(current)?.focus();
  }, [current]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    if (tabs.length === 0) return;
    const forward = (event.key === 'ArrowRight') === (direction !== 'rtl');
    const from = selectedIndex < 0 ? 0 : selectedIndex;
    const next = tabs[(from + (forward ? 1 : -1) + tabs.length) % tabs.length];
    if (!next) return;
    event.preventDefault();
    focusNext.current = next.section;
    onOpen(next.section);
  };

  return (
    <div
      role="tablist"
      aria-label={t(PATIENT_FILE_BAR_KEYS.tabs)}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab, index) => {
        const selected = tab.section === current;
        const tone = TONE_CLASSES[PATIENT_FILE_SECTION_TONES[tab.section]];
        const Icon = PATIENT_FILE_SECTION_ICONS[tab.section];
        const focusable = selected || (selectedIndex < 0 && index === 0);
        return (
          <button
            key={tab.section}
            ref={(node) => {
              if (node) refs.current.set(tab.section, node);
              else refs.current.delete(tab.section);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={focusable ? 0 : -1}
            onClick={() => onOpen(tab.section)}
            data-testid={`${PATIENT_FILE_BAR_TEST_IDS.tab}-${tab.section}`}
            className={cn(
              'text-body relative flex h-8 flex-none items-center gap-1.5 rounded-lg px-2.5 whitespace-nowrap transition-[background-color,color,box-shadow] duration-160',
              selected
                ? cn(tone.surface, 'font-semibold')
                : cn('text-foreground-soft font-medium', tone.hover),
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                'size-3.5',
                selected ? 'text-current' : 'text-muted-foreground',
              )}
            />
            {t(PATIENT_FILE_KEYS.sections[tab.section], { ns: PATIENT_FILE_NS })}
            {tab.temporary ? (
              <span
                title={t(PATIENT_FILE_BAR_KEYS.notPinned)}
                data-slot="pill"
                className="size-1.25 rounded-full bg-current opacity-50"
              >
                <span className="sr-only">{t(PATIENT_FILE_BAR_KEYS.notPinned)}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
