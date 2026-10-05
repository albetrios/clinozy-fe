import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import type { SectionBarEntry } from '@/shared/layouts/AppLayout/section-bar-nav.ts';
import { LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';

/**
 * Header slot 2 on a phone (`shell.md:19`; H:527): the current room's name in
 * its tone — the phone header's only title (each room's h1 is visually hidden
 * below `md`). No live region: the root `RouteAnnouncer` already announces it.
 * The header's one item that gives way: on a narrow phone (320px) a long name
 * ("Appointments") shrinks with an ellipsis rather than slide under the
 * search and branch controls beside it.
 */
export function SectionChip({ entry }: { entry: SectionBarEntry | null }) {
  const { t } = useTranslation(LAYOUT_NS);
  if (!entry) return null;
  const label = t(entry.labelKey, { ns: entry.labelNs });
  return (
    <span
      data-testid="section-chip"
      title={label}
      className={cn(
        'inline-flex h-7 min-w-0 flex-initial items-center rounded-lg px-2.5 text-sm font-semibold tracking-[-0.01em] whitespace-nowrap md:hidden',
        TONE_CLASSES[entry.tone].surface,
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
