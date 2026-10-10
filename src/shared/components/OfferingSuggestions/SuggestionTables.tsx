import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';

import {
  OFFERING_SUGGESTIONS_KEYS,
  OFFERING_SUGGESTIONS_NS,
  OFFERING_SUGGESTIONS_TEST_IDS,
  ROW_FLOOR,
} from './offering-suggestions.constants.ts';
import type {
  SuggestionActivityLine,
  SuggestionActivityStatusTone,
  SuggestionPurchase,
} from './offering-suggestions.types.ts';

const KEYS = OFFERING_SUGGESTIONS_KEYS;

/**
 * Purchases on three tracks (H:2820) — date · bought · sessions; the design's
 * Qty, Paid and Invoice columns are not served by `…/offerings` (G4). Under
 * 720px of card width the sessions take a second line under the name and the
 * header hides (H:418).
 */
const PURCHASE_GRID =
  'grid grid-cols-[64px_minmax(0,1fr)_minmax(0,160px)] items-center gap-2 px-3.5 [&>*]:min-w-0 @max-[720px]:grid-cols-[64px_minmax(0,1fr)] @max-[720px]:gap-y-1 @max-[720px]:py-2';

/** The sessions cell's place under 720px — a literal class for Tailwind. */
const PURCHASE_SESSIONS_AT = '@max-[720px]:col-start-2 @max-[720px]:row-start-2';

/**
 * Activity on four tracks (H:2824); under 720px three columns: when ·
 * channel, the message on its own line, then the status under it in the first
 * column — where the prototype's grid places it (H:419).
 */
const ACTIVITY_GRID =
  'grid grid-cols-[72px_92px_minmax(0,1fr)_96px] items-center gap-2 px-3.5 [&>*]:min-w-0 @max-[720px]:grid-cols-[64px_minmax(0,1fr)_auto] @max-[720px]:gap-y-0.5';

/** A message status's ink (H:4372): Read green, Not delivered red, Queued amber. */
const STATUS_INK: Readonly<Record<SuggestionActivityStatusTone, string>> = {
  success: 'text-success',
  danger: 'text-destructive',
  pending: TONE_CLASSES.butter.ink,
};

/** A table's 11px uppercase header row, hidden under 720px. */
const TABLE_HEAD =
  'border-border text-micro text-muted-foreground border-b py-1.25 font-semibold tracking-[0.05em] uppercase @max-[720px]:hidden';

/** A section's title line: "<title> · <summary>" (H:2819, H:2823); the title alone without one. */
function SectionTitle({
  title,
  summary,
  action,
  className,
}: {
  title: string;
  summary?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 px-3.5 pt-2.5 pb-1', className)}>
      <span className="text-micro text-muted-foreground leading-[1.2] font-semibold tracking-[0.05em] uppercase">
        {title}
      </span>
      {summary ? (
        <>
          <span aria-hidden="true" className="text-micro text-disabled leading-[1.2]">
            ·
          </span>
          <span className="text-caption text-muted-foreground min-w-0 truncate leading-[1.2]">
            {summary}
          </span>
        </>
      ) : null}
      {action ? (
        <>
          <span className="flex-1" />
          {action}
        </>
      ) : null}
    </div>
  );
}

/**
 * "<first>’s last purchases · <n> lines" (H:2819–2821; `…/offerings`): Date ·
 * Bought (category pill + name) · Sessions (a 64px bar, "<n> of <n> used",
 * for a package).
 */
export function PurchasesTable({
  firstName,
  purchases,
}: {
  firstName: string;
  purchases: readonly SuggestionPurchase[];
}) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const columns = KEYS.purchaseColumns;
  return (
    <section aria-label={t(KEYS.purchasesTitle, { first: firstName })}>
      <SectionTitle
        title={t(KEYS.purchasesTitle, { first: firstName })}
        summary={t(KEYS.purchasesCount, { count: purchases.length })}
      />
      <div aria-hidden="true" className={cn(PURCHASE_GRID, TABLE_HEAD)}>
        <span>{t(columns.date)}</span>
        <span>{t(columns.bought)}</span>
        <span>{t(columns.sessions)}</span>
      </div>
      {purchases.map((purchase) => (
        <div
          key={purchase.id}
          data-testid={OFFERING_SUGGESTIONS_TEST_IDS.purchase}
          className={cn(
            PURCHASE_GRID,
            ROW_FLOOR,
            'border-muted text-detail min-h-9 border-b py-1 leading-[1.2]',
          )}
        >
          <span className="text-muted-foreground-strong whitespace-nowrap tabular-nums">
            {purchase.date}
          </span>
          <span className="flex items-center gap-1.5">
            {purchase.category ? (
              <TonePill
                tone={purchase.category.tone}
                size="xs"
                className="text-micro h-5"
              >
                {purchase.category.label}
              </TonePill>
            ) : null}
            <span className="min-w-0 truncate font-medium">{purchase.name}</span>
          </span>
          <span className={cn('flex items-center gap-1.5', PURCHASE_SESSIONS_AT)}>
            {purchase.sessions ? (
              <>
                <span
                  aria-hidden="true"
                  data-slot="pill"
                  className="bg-muted-strong h-1 w-16 flex-none overflow-hidden rounded-full"
                >
                  <span
                    style={
                      {
                        '--used': `${Math.round((purchase.sessions.used / Math.max(1, purchase.sessions.total)) * 100)}%`,
                      } as CSSProperties
                    }
                    className="bg-success block h-full w-(--used)"
                  />
                </span>
                <span className="text-caption text-muted-foreground-strong leading-[1.2] whitespace-nowrap">
                  {t(KEYS.sessionsUsed, {
                    used: purchase.sessions.used,
                    total: purchase.sessions.total,
                  })}
                </span>
              </>
            ) : (
              <span className="text-caption text-disabled">—</span>
            )}
          </span>
        </div>
      ))}
    </section>
  );
}

/**
 * "Contact activity · <summary>" with "Open chat" (H:2823–2825): When ·
 * Channel (a 6px dot) · Message ("Sent" on lav / "Got" on sage) · Status.
 */
export function ActivityTable({
  summary,
  lines,
  onOpenChat,
}: {
  /** "Lead #2363 · Contacted" — none without a lead the member may read. */
  summary?: string;
  lines: readonly SuggestionActivityLine[];
  onOpenChat?: () => void;
}) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const columns = KEYS.activityColumns;
  return (
    <section aria-label={t(KEYS.activityTitle)} className="border-border border-t">
      <SectionTitle
        title={t(KEYS.activityTitle)}
        summary={summary}
        action={
          onOpenChat ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onOpenChat}
              className="border-border bg-card hover:bg-muted h-6.5 rounded-md text-xs shadow-none"
            >
              {t(KEYS.openChat)}
            </Button>
          ) : undefined
        }
      />
      <div aria-hidden="true" className={cn(ACTIVITY_GRID, TABLE_HEAD)}>
        <span>{t(columns.when)}</span>
        <span>{t(columns.channel)}</span>
        <span>{t(columns.message)}</span>
        <span>{t(columns.status)}</span>
      </div>
      {lines.map((line) => (
        <div
          key={line.id}
          data-testid={OFFERING_SUGGESTIONS_TEST_IDS.activity}
          className={cn(
            ACTIVITY_GRID,
            ROW_FLOOR,
            'border-muted text-detail min-h-8.5 border-b py-1 leading-[1.2]',
          )}
        >
          <span className="text-muted-foreground-strong whitespace-nowrap tabular-nums">
            {line.at}
          </span>
          <span className="inline-flex items-center gap-1.25 @max-[720px]:col-start-2 @max-[720px]:row-start-1">
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 flex-none rounded-full',
                TONE_CLASSES[line.channel.tone].dot,
              )}
            />
            <span className="truncate">{line.channel.label}</span>
          </span>
          <span className="flex items-center gap-1.5 @max-[720px]:col-span-full">
            <span
              className={cn(
                'text-tiny inline-flex h-4.5 flex-none items-center rounded-sm px-1.5 font-semibold whitespace-nowrap',
                line.direction === 'sent'
                  ? TONE_CLASSES.lav.surface
                  : TONE_CLASSES.sage.surface,
              )}
            >
              {t(line.direction === 'sent' ? KEYS.sent : KEYS.got)}
            </span>
            <span className="text-foreground-soft min-w-0 truncate" title={line.text}>
              {line.text}
            </span>
          </span>
          <span
            className={cn(
              'text-caption leading-[1.2] whitespace-nowrap @max-[720px]:col-start-1 @max-[720px]:row-start-3',
              line.statusTone ? STATUS_INK[line.statusTone] : 'text-muted-foreground',
            )}
          >
            {line.status}
          </span>
        </div>
      ))}
    </section>
  );
}
