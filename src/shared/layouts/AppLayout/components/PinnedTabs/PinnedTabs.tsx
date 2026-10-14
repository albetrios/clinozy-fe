import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { measureTextWidth } from '@/lib/fit-tabs.ts';
import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { SelectionGlide } from '@/shared/components/SelectionGlide/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { WeightStableLabel } from '@/shared/components/WeightStableLabel/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';
import type {
  SectionBarEntry,
  SectionBarNav,
} from '@/shared/layouts/AppLayout/section-bar-nav.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';

import { fitPinnedTabs, pinnedTabWidth } from './fit-pinned-tabs.ts';

/** A label's width at the tabs' 600 13px, as the prototype measures it (H:4074). */
function measureLabel(label: string, fontFamily: string): number {
  return measureTextWidth(label, `600 13px ${fontFamily}`);
}

/** One room's label and its "<Section> · <description>" title. */
function useEntryText(entry: SectionBarEntry) {
  const { t } = useTranslation(LAYOUT_NS);
  const label = t(entry.labelKey, { ns: entry.labelNs });
  const title = t(LAYOUT_KEYS.app.sectionBar.tabTitle, {
    section: label,
    description: t(entry.descriptionKey, { ns: entry.labelNs }),
  });
  return { label, title };
}

function PinnedTab({
  entry,
  current,
  organizationSlug,
}: {
  entry: SectionBarEntry;
  current: boolean;
  organizationSlug: string;
}) {
  const { label, title } = useEntryText(entry);
  const tone = TONE_CLASSES[entry.tone];
  return (
    <Link
      to={entry.to}
      params={{ organizationSlug }}
      activeOptions={{ exact: true }}
      aria-current={current ? 'page' : undefined}
      title={title}
      data-testid={`nav-${entry.id}`}
      data-slot="nav-item"
      data-current={current || undefined}
      className={cn(
        'text-body flex h-8 flex-none items-center gap-1.5 rounded-lg px-2.5 whitespace-nowrap transition-[background-color,color,box-shadow] duration-160 ease-out',
        current
          ? cn(tone.surface, 'font-semibold')
          : cn(
              'text-foreground-soft [&_svg]:text-muted-foreground font-medium',
              tone.hover,
            ),
      )}
    >
      <entry.icon className="size-4" aria-hidden />
      {/* Its 600 width whatever its weight: switching tabs moves no other tab. */}
      <WeightStableLabel label={label} />
    </Link>
  );
}

/**
 * Header slots 4 and 5 (`shell.md:21–22`; H:537–538): the pinned rooms as tabs,
 * and — once the measured space runs out — "More", the folded pins as a Picker
 * menu (each room's icon tile in its tone; picking one opens it).
 * `available` is the measured tab space (null until measured: nothing folds).
 * The current tab's tint is one lens (change-motion-polish D7): it glides to
 * the room opened and crossfades into its tone, as the phone tab bar's lens
 * does; a current room outside the tabs fades it out. The nav it sits in is
 * `relative isolate` (`AppLayoutSectionBar`).
 */
export function PinnedTabs({
  nav,
  organizationSlug,
  available,
  fontFamily,
}: {
  nav: SectionBarNav;
  organizationSlug: string;
  available: number | null;
  fontFamily: string;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const navigate = useNavigate();
  const labelsKey = nav.pinned
    .map((entry) => t(entry.labelKey, { ns: entry.labelNs }))
    .join('\n');
  const measured = available !== null;
  // Keyed on the joined label text, so a re-render with the same labels does
  // not measure them again.
  const widths = useMemo(() => {
    const labels = labelsKey === '' ? [] : labelsKey.split('\n');
    return measured
      ? labels.map((label) => pinnedTabWidth(measureLabel(label, fontFamily)))
      : labels.map(() => 0);
  }, [labelsKey, measured, fontFamily]);
  const currentIndex = nav.current ? nav.pinned.indexOf(nav.current) : -1;
  const fit = fitPinnedTabs(widths, available, currentIndex);
  const folded = fit.folded.flatMap((index) => nav.pinned[index] ?? []);

  return (
    <>
      <SelectionGlide
        selected='[data-slot="nav-item"][aria-current="page"]'
        className={cn(
          'rounded-lg',
          nav.current ? TONE_CLASSES[nav.current.tone].bg : null,
        )}
      />
      {fit.visible.map((index) => {
        const entry = nav.pinned[index];
        return entry ? (
          <PinnedTab
            key={entry.id}
            entry={entry}
            current={entry === nav.current}
            organizationSlug={organizationSlug}
          />
        ) : null;
      })}
      {folded.length > 0 ? (
        <Picker
          menu
          label={t(LAYOUT_KEYS.app.sectionBar.morePinned)}
          value={null}
          options={folded.map((entry) => ({
            key: entry.id,
            label: t(entry.labelKey, { ns: entry.labelNs }),
            tone: entry.tone,
            leading: { kind: 'icon', icon: entry.icon },
          }))}
          onChange={(id) => {
            const entry = folded.find((pin) => pin.id === id);
            if (entry) void navigate({ to: entry.to, params: { organizationSlug } });
          }}
          minWidth={200}
          testId="nav-more"
          className="flex-none"
          renderTrigger={({ open }) => (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t(LAYOUT_KEYS.app.sectionBar.morePinned)}
              title={t(LAYOUT_KEYS.app.sectionBar.morePinned)}
              data-testid="nav-more"
              className={cn(
                'text-foreground-soft hover:bg-muted gap-1 ps-2.5 pe-2 duration-160',
                open && 'bg-muted',
              )}
            >
              {t(LAYOUT_KEYS.app.sectionBar.more)}
              <ChevronDown
                aria-hidden
                className={cn(
                  'text-muted-foreground size-3.5 transition-transform duration-150',
                  open && 'rotate-180',
                )}
              />
            </Button>
          )}
        />
      ) : null}
    </>
  );
}
