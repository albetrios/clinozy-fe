import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { Zap } from '@/shared/icons/index.ts';

/** A preset that prefills the drawer's form; it never saves on its own. */
export interface QuickFillItem {
  /** Stable id — the test-id suffix. */
  id: string;
  label: string;
  /** The preset's tone: the chip takes its fill, and its ink for the text and dashed edge. */
  tone?: Tone;
  /** What the preset fills in, as the chip's tooltip. */
  description?: string;
  /**
   * The chip opens another record rather than prefilling this form (the
   * Treatment drawer's "Log check-in"): it stays on a read-only drawer, offered
   * by the screen only to a member who may write that record.
   */
  keepWhenReadOnly?: boolean;
  onSelect: () => void;
}

/** Props of {@link QuickFillRow}. */
export interface QuickFillRowProps {
  items: readonly QuickFillItem[];
  /** Prefix for the row's test ids (`<testId>-quick-fill`). */
  testId: string;
}

/**
 * The drawer header's "Quick fill" row (H:887; `_patterns.md:32`): an 11px
 * uppercase label, then one dashed 24px chip per preset, "⚡ <label>" — the
 * bolt is the registry `Zap`, not a character in the copy (§7.2).
 */
export function QuickFillRow({ items, testId }: QuickFillRowProps) {
  const { t } = useTranslation(RECORD_DRAWER_NS);
  const labelId = useId();
  if (items.length === 0) return null;

  return (
    <fieldset
      aria-labelledby={labelId}
      data-testid={`${testId}-quick-fill`}
      className="m-0 flex min-w-0 shrink-0 flex-wrap items-center gap-1.5 border-0 px-(--drawer-pad-x) pt-3 pb-0"
    >
      <span
        id={labelId}
        className="text-micro text-muted-foreground me-0.5 font-semibold tracking-[0.05em] uppercase"
      >
        {t(RECORD_DRAWER_KEYS.quickFill)}
      </span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.description}
          data-testid={`${testId}-quick-fill-${item.id}`}
          data-slot="pill"
          onClick={item.onSelect}
          // The dashed edge is drawn in the chip's own ink (`border-current`).
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-full border border-dashed border-current px-2.5 text-xs font-medium whitespace-nowrap transition-shadow hover:ring-1 hover:ring-current',
            item.tone ? TONE_CLASSES[item.tone].surface : 'bg-muted text-foreground',
          )}
        >
          <Zap aria-hidden="true" className="size-3" />
          {item.label}
        </button>
      ))}
    </fieldset>
  );
}
