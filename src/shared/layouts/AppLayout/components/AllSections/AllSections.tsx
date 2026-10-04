import { Link } from '@tanstack/react-router';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/shared/components/ui/drawer.tsx';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { Compass, MapPin } from '@/shared/icons/index.ts';
import type {
  SectionBarEntry,
  SectionBarNav,
} from '@/shared/layouts/AppLayout/section-bar-nav.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';

const keys = LAYOUT_KEYS.app.sectionBar;

function SectionRow({
  entry,
  nav,
  organizationSlug,
  onNavigate,
}: {
  entry: SectionBarEntry;
  nav: SectionBarNav;
  organizationSlug: string;
  onNavigate: () => void;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const label = t(entry.labelKey, { ns: entry.labelNs });
  const description = entry.descriptionKey
    ? t(entry.descriptionKey, { ns: entry.labelNs })
    : null;
  const current = entry === nav.current;
  const pinned = nav.isPinned(entry);
  const tone = TONE_CLASSES[entry.tone];
  return (
    <div className="relative flex">
      <Link
        to={entry.to}
        params={{ organizationSlug }}
        activeOptions={{ exact: true }}
        onClick={onNavigate}
        aria-current={current ? 'page' : undefined}
        title={description ? `${label} · ${description}` : label}
        data-testid={`all-sections-${entry.id}`}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border py-1.5 ps-1.5 text-start transition-colors',
          nav.canPin ? 'pe-10' : 'pe-1.5',
          current
            ? 'bg-canvas border-border-strong'
            : 'hover:bg-muted border-transparent',
        )}
      >
        <span
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-md',
            tone.surface,
          )}
        >
          <entry.icon className="size-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body truncate leading-[1.3] font-semibold">{label}</span>
          {description ? (
            <span className="text-muted-foreground text-caption truncate leading-[1.3]">
              {description}
            </span>
          ) : null}
        </span>
      </Link>
      {entry.section !== null ? (
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={t(pinned ? keys.unpinAria : keys.pinAria, { section: label })}
          title={t(pinned ? keys.unpin : keys.pin)}
          onClick={() => nav.togglePin(entry)}
          data-testid={`all-sections-pin-${entry.id}`}
          className={cn(
            'absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md border transition-colors',
            pinned
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 border-transparent'
              : 'text-muted-foreground hover:border-border border-transparent',
          )}
        >
          <MapPin className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The All sections list (`shell.md:42–43`; H:532–533): one flat list of the
 * rooms the member can view, in nav order — tone tile, label, description and a
 * pin toggle — then the footer. No headings, dividers or counts.
 */
export function AllSectionsList({
  nav,
  organizationSlug,
  onNavigate,
}: {
  nav: SectionBarNav;
  organizationSlug: string;
  onNavigate: () => void;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-0.5">
        {nav.entries.map((entry) => (
          <SectionRow
            key={entry.id}
            entry={entry}
            nav={nav}
            organizationSlug={organizationSlug}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      {nav.canPin ? (
        <div className="text-muted-foreground text-caption flex items-center gap-2 border-t px-2 pt-1.5 pb-0.5">
          <span>{t(keys.pinFooter)}</span>
          <span className="ms-auto whitespace-nowrap">{t(keys.keysHint)}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Header slot 3 (`shell.md:20`; H:529–531): the compass button in its
 * hairline wrapper — tinted when the current room is not pinned — and the All
 * sections popover, which hangs from the wrapper's start edge as designed.
 */
export function AllSectionsPopover({
  nav,
  organizationSlug,
  open,
  onOpenChange,
  wrapperRef,
}: {
  nav: SectionBarNav;
  organizationSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The wrapper, which the header measures for the tab fold. */
  wrapperRef?: Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div ref={wrapperRef} className="relative me-1.5 flex-none border-x px-2.5">
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={t(keys.allSections)}
              title={t(keys.allSectionsTitle)}
              data-testid="all-sections-trigger"
              data-current-unpinned={nav.currentUnpinned || undefined}
              className={cn(
                'text-foreground-soft hover:bg-muted flex size-8 flex-none items-center justify-center rounded-lg border transition-colors',
                nav.currentUnpinned ? 'border-border-strong' : 'border-border',
                open || nav.currentUnpinned ? 'bg-muted' : 'bg-card',
              )}
            >
              <Compass className="size-4" aria-hidden />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={8}
        role="dialog"
        aria-label={t(keys.allSections)}
        data-testid="all-sections"
        // The bar's own surface: G closes it from inside (section-bar-shortcuts.ts).
        data-sections-surface
        className="data-[state=open]:animate-dropdown-in max-h-[calc(100vh-5.625rem)] w-[min(17.5rem,calc(100vw-2rem))] origin-top-left overflow-auto rounded-xl p-2"
      >
        <AllSectionsList
          nav={nav}
          organizationSlug={organizationSlug}
          onNavigate={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * All sections on a phone (`shell.md:43`; H:43–44, H:139–140): the same list
 * as a bottom sheet opened by the tab bar's "More" — full width, 16px top
 * corners, up to 85vh, no dim, covering the tab bar.
 */
export function AllSectionsSheet({
  nav,
  organizationSlug,
  open,
  onOpenChange,
}: {
  nav: SectionBarNav;
  organizationSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        showHandle={false}
        overlayClassName="bg-transparent"
        data-testid="all-sections-sheet"
        data-slot="drawer-content"
        data-sections-surface
        className="bg-card animate-sheet-up max-h-[85vh] rounded-t-2xl border-t p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] data-[vaul-drawer-direction=bottom]:max-h-[85vh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl"
      >
        <DrawerTitle className="sr-only">{t(keys.allSections)}</DrawerTitle>
        <DrawerDescription className="sr-only">{t(keys.pinFooter)}</DrawerDescription>
        <div className="overflow-y-auto">
          <AllSectionsList
            nav={nav}
            organizationSlug={organizationSlug}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
