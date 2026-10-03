import type { TFunction } from 'i18next';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Progress } from '@/shared/components/ui/progress.tsx';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  Camera,
  Check,
  ChevronDown,
  FileIcon,
  RotateCw,
  X,
} from '@/shared/icons/index.ts';
import {
  uploadQueueSummary,
  type UploadRow,
  useUploadQueueStore,
} from '@/shared/store/useUploadQueueStore/index.ts';

import { formatFileSize } from './format-file-size.ts';
import { UPLOAD_TRAY_KEYS, UPLOAD_TRAY_NS } from './upload-tray.constants.ts';

const KEYS = UPLOAD_TRAY_KEYS;

/** 44px touch targets on a phone (KICKOFF §7); the design's 28px from `md`. */
const CONTROL_CLASS = 'text-muted-foreground size-11 md:size-7';

/** "Uploading 2 of 5…" while files move, then the count that failed, or "All uploads complete". */
function summaryText(t: TFunction, rows: readonly UploadRow[], departed: number): string {
  if (rows.length === 0) return '';
  const { left, total, failed } = uploadQueueSummary({ rows, departed });
  if (left > 0) return t(KEYS.uploading, { left, total });
  if (failed > 0) return t(KEYS.failed, { count: failed });
  return t(KEYS.complete);
}

function UploadTrayRow({ row }: { row: UploadRow }) {
  const { t } = useTranslation(UPLOAD_TRAY_NS);
  const { formatNumber } = useLocaleFormat();
  const retry = useUploadQueueStore((state) => state.retry);
  const dismiss = useUploadQueueStore((state) => state.dismiss);
  const nameId = useId();
  const Icon = row.isImage ? Camera : FileIcon;
  const failed = row.status === 'failed';
  const done = row.status === 'done';

  return (
    <li
      data-testid="upload-tray-row"
      data-status={row.status}
      className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 p-1.5"
    >
      <span
        aria-hidden
        className={cn(
          'flex size-7 items-center justify-center rounded-md',
          TONE_CLASSES[row.isImage ? 'blush' : 'stone'].surface,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span id={nameId} className="text-detail truncate font-medium">
          {row.name}
        </span>
        {failed ? (
          <span className="text-caption text-destructive truncate">
            {t(row.failedStep === 'attach' ? KEYS.attachFailed : KEYS.uploadFailed)}
          </span>
        ) : (
          <Progress
            value={row.progress}
            aria-labelledby={nameId}
            className={cn(
              'bg-muted h-1 rounded-xs',
              done && '[&>[data-slot=progress-indicator]]:bg-success',
            )}
          />
        )}
      </span>
      {failed ? (
        <span className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-testid="upload-tray-retry"
            aria-label={t(KEYS.retry, { name: row.name })}
            className={CONTROL_CLASS}
            onClick={() => retry(row.id)}
          >
            <RotateCw className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-testid="upload-tray-remove"
            aria-label={t(KEYS.remove, { name: row.name })}
            className={CONTROL_CLASS}
            onClick={() => dismiss(row.id)}
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        </span>
      ) : (
        <span className="text-caption text-muted-foreground flex items-center gap-1 whitespace-nowrap tabular-nums">
          {done ? (
            <>
              <Check className="size-3" aria-hidden />
              {formatFileSize(row.size, { t, formatNumber })}
            </>
          ) : (
            formatNumber(row.progress / 100, { style: 'percent' })
          )}
        </span>
      )}
    </li>
  );
}

function UploadTrayPanel() {
  const { t } = useTranslation(UPLOAD_TRAY_NS);
  const rows = useUploadQueueStore((state) => state.rows);
  const departed = useUploadQueueStore((state) => state.departed);
  const collapsed = useUploadQueueStore((state) => state.collapsed);
  const setCollapsed = useUploadQueueStore((state) => state.setCollapsed);
  const listId = useId();
  const summary = summaryText(t, rows, departed);

  return (
    <>
      {/* Mounted for the whole session: a live region inserted together with its text is
          often announced to nobody, so the first "Uploading…" would go unread. The panel's
          own header is plain text — per-file percentages must never re-announce. */}
      <p role="status" className="sr-only" data-testid="upload-tray-status">
        {summary}
      </p>
      {rows.length > 0 ? (
        <section
          aria-label={t(KEYS.label)}
          data-testid="upload-tray"
          data-slot="upload-tray"
          className={cn(
            'bg-card text-card-foreground animate-dropdown-in fixed end-5 z-[95] flex max-h-80 w-[min(20rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border shadow-(--elevation-tray)',
            // The phone bottom stack (index.css): above the tab bar, a notice pill and a
            // floating "New" — each publishes its height only while it shows, and only below
            // `md`, so from `md` this is the design's 20px.
            'bottom-[calc(var(--floating-bottom-offset,0rem)+env(safe-area-inset-bottom,0px)+var(--floating-notice-height,0px)+var(--floating-fab-height,0px)+1.25rem)]',
          )}
        >
          <div
            className={cn(
              'flex h-11 flex-none items-center gap-2 ps-3.5 pe-1.5 md:h-10',
              !collapsed && 'border-b',
            )}
          >
            <p className="text-detail min-w-0 flex-1 truncate font-semibold">{summary}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-testid="upload-tray-toggle"
              aria-expanded={!collapsed}
              aria-controls={listId}
              aria-label={t(collapsed ? KEYS.show : KEYS.hide)}
              className={CONTROL_CLASS}
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronDown
                className={cn('size-4 transition-transform', collapsed && 'rotate-180')}
                aria-hidden
              />
            </Button>
          </div>
          <ul
            id={listId}
            hidden={collapsed}
            className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5"
          >
            {rows.map((row) => (
              <UploadTrayRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/**
 * The shared upload tray (KICKOFF §3.5; `_patterns.md:248–255`), mounted once by the app
 * shell; screens hand it files through `useUploadQueue`.
 *
 * @remarks
 * Fixed at the bottom inline-end corner, 320 × max 320px: "Uploading <left> of <total>…",
 * then a row per file — a camera or file tile, the name over a 4px bar, "<n>%" turning into
 * "✓ <size>"; a finished row leaves after 1,400ms and the tray closes when empty. A failed
 * row names the step that failed and offers Retry and Remove; the header collapses the list.
 * Above drawers (z 95, as designed) and under toasts, the top layer. Contained by a silent
 * boundary (house rule 2): if the panel throws, the uploads carry on without it.
 */
export function UploadTray() {
  const { t } = useTranslation(UPLOAD_TRAY_NS);
  return (
    <SectionErrorBoundary title={t(KEYS.label)} variant="silent">
      <UploadTrayPanel />
    </SectionErrorBoundary>
  );
}
