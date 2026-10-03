import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { measureTextWidth } from '@/lib/fit-tabs.ts';
import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
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
  const title = entry.descriptionKey
    ? t(LAYOUT_KEYS.app.sectionBar.tabTitle, {
        section: label,
        description: t(entry.descriptionKey, { ns: entry.labelNs }),
      })
    : label;
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
      {label}
    </Link>
  );
}

function FoldedTab({
  entry,
  organizationSlug,
}: {
  entry: SectionBarEntry;
  organizationSlug: string;
}) {
  const { label, title } = useEntryText(entry);
  return (
    <DropdownMenuItem asChild className="text-body h-9 gap-2.5 rounded-md">
      <Link
        to={entry.to}
        params={{ organizationSlug }}
        title={title}
        data-testid={`nav-more-${entry.id}`}
      >
        <entry.icon className="size-4" aria-hidden />
        {label}
      </Link>
    </DropdownMenuItem>
  );
}

/**
 * Header slots 4 and 5 (`shell.md:21–22`; H:537–538): the pinned rooms as tabs,
 * and — once the measured space runs out — "More", a list of the folded pins.
 * `available` is the measured tab space (null until measured: nothing folds).
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
  const [moreOpen, setMoreOpen] = useState(false);
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

  return (
    <>
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
      {fit.folded.length > 0 ? (
        <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t(LAYOUT_KEYS.app.sectionBar.morePinned)}
              title={t(LAYOUT_KEYS.app.sectionBar.morePinned)}
              data-testid="nav-more"
              className={cn(
                'text-foreground-soft hover:bg-muted text-body flex h-8 flex-none items-center gap-1 rounded-lg ps-2.5 pe-2 font-medium whitespace-nowrap transition-colors duration-160',
                moreOpen && 'bg-muted',
              )}
            >
              {t(LAYOUT_KEYS.app.sectionBar.more)}
              <ChevronDown
                aria-hidden
                className={cn(
                  'text-muted-foreground size-3.5 transition-transform duration-150',
                  moreOpen && 'rotate-180',
                )}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="data-[state=open]:animate-dropdown-in min-w-50 rounded-xl p-1.5"
          >
            {fit.folded.map((index) => {
              const entry = nav.pinned[index];
              return entry ? (
                <FoldedTab
                  key={entry.id}
                  entry={entry}
                  organizationSlug={organizationSlug}
                />
              ) : null;
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}
