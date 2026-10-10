import { type KeyboardEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { CountBadge } from '@/shared/components/Cells/CountBadge/index.ts';
import { DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';

import type { ClinicalChip } from '../../../shared/patient-clinical.ts';
import { CLINICAL_KEYS, CLINICAL_NS } from '../../overview.constants.ts';

/** How long a chip may be (`patient-file.md:541`). */
const CHIP_MAX = 60;

/** Props of {@link ClinicalChipCard}. */
export interface ClinicalChipCardProps {
  title: string;
  tone: Tone;
  /** The chips — each a clinical note; the fresh ones ringed and counted in the "1 new" pill. */
  items: readonly ClinicalChip[];
  /** The notes are still being read: the chips' place shows bars, and there is no input. */
  loading: boolean;
  onAdd: (text: string) => void;
  onRemove: (chip: ClinicalChip) => void;
  /** Without Patients edit the chips are read-only: no × and no input. */
  canEdit: boolean;
  testId: string;
  className?: string;
}

/**
 * One chip card of Clinical notes (H:780; `patient-file.md:53`): an 8px dot,
 * the title and a dark "1 new" pill (chips added since the last visit carry a
 * 1.5px ring); the chips — tinted, wrapping anywhere, each with a 20px ×
 * that removes it at once — or "Nothing added yet"; and a dashed input that
 * adds one on Enter (≤60, the first letter capitalised, a repeat ignored).
 * A chip still saving has its × off until it is a note.
 */
export function ClinicalChipCard({
  title,
  tone,
  items,
  loading,
  onAdd,
  onRemove,
  canEdit,
  testId,
  className,
}: ClinicalChipCardProps) {
  const { t } = useTranslation(CLINICAL_NS);
  const [draft, setDraft] = useState('');
  const titleId = useId();
  const classes = TONE_CLASSES[tone];
  const freshCount = items.filter((item) => item.fresh).length;
  const writes = canEdit && !loading;

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    if (!items.some((item) => item.text.toLowerCase() === text.toLowerCase()))
      onAdd(text);
    setDraft('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    add();
  };

  return (
    <section
      aria-labelledby={titleId}
      data-slot="card"
      data-testid={testId}
      className={cn(
        'bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-3',
        className,
      )}
    >
      <h3 id={titleId} className="text-field flex items-center gap-2 font-semibold">
        {/* The dot in the tone's ink (H:4797 `dot: tn(t).ink`). */}
        <span
          aria-hidden="true"
          className={cn('size-2 flex-none rounded-full', classes.fill)}
        />
        <span className="min-w-0 truncate">{title}</span>
        {freshCount > 0 ? (
          <CountBadge
            count={freshCount}
            tone="inverse"
            title={t(CLINICAL_KEYS.newHint)}
            data-testid={`${testId}-new`}
            className="ms-1.5"
          >
            {t(CLINICAL_KEYS.newCount, { count: freshCount })}
          </CountBadge>
        ) : null}
      </h3>
      {loading ? <SkeletonRows rows={2} label={title} /> : null}
      {!loading && items.length === 0 ? (
        <EmptyState variant="inline" title={t(CLINICAL_KEYS.empty)} />
      ) : null}
      <ul className="flex flex-wrap gap-1.5 empty:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            title={item.text}
            data-slot="pill"
            data-testid={`${testId}-chip`}
            data-fresh={item.fresh || undefined}
            aria-busy={item.pending || undefined}
            className={cn(
              'text-detail inline-flex min-h-7 max-w-full min-w-0 items-start gap-0.5 rounded-full py-1 ps-2.75 pe-1 leading-5 font-medium',
              classes.surface,
              item.fresh && cn(classes.ring, 'ring-[1.5px]'),
              !canEdit && 'pe-2.75',
            )}
          >
            <span className="min-w-0 [text-wrap:pretty] [overflow-wrap:anywhere]">
              {item.text}
            </span>
            {canEdit ? (
              <button
                type="button"
                onClick={() => onRemove(item)}
                disabled={item.pending}
                aria-label={t(CLINICAL_KEYS.remove, { name: item.text })}
                data-slot="pill"
                className="hover:bg-foreground/8 flex size-5 flex-none items-center justify-center rounded-full text-[0.8125rem] leading-none opacity-70 transition-[background-color,opacity] hover:opacity-100 disabled:pointer-events-none disabled:opacity-40"
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {writes ? (
        // The drawer input (its focus ring and first-letter capital), 32px on
        // `canvas` with a dashed edge (H:780).
        <DrawerInput
          type="text"
          value={draft}
          maxLength={CHIP_MAX}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={t(CLINICAL_KEYS.placeholder)}
          aria-label={t(CLINICAL_KEYS.add, { title })}
          data-testid={`${testId}-input`}
          className="bg-canvas dark:bg-canvas text-body md:text-body border-border-strong mt-0.5 h-8 border-dashed shadow-none"
        />
      ) : null}
    </section>
  );
}
