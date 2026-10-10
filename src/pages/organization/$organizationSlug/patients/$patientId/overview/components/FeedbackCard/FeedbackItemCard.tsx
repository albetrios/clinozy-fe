import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { cn } from '@/lib/utils.ts';
import type { FeedbackActionKind } from '@/shared/api/clinic/clinic-schema.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { FeedbackItem } from '@/shared/api/clinic/feedback-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { ChevronDown, PenLine, Trash } from '@/shared/icons/index.ts';

import { useStaffLookup } from '../../../shared/hooks/useStaffLookup/index.ts';
import { CLINICAL_NS, FEEDBACK_KEYS } from '../../overview.constants.ts';
import {
  FEEDBACK_TYPE_LOOK,
  feedbackActionsFor,
  feedbackCardView,
  type FeedbackVisit,
} from './feedback-view.ts';

const K = FEEDBACK_KEYS;

/** Props of {@link FeedbackItemCard}. */
export interface FeedbackItemCardProps {
  item: FeedbackItem;
  /** Names the visit a review follows, from the patient's bookings. */
  visitOf: (appointmentId: string | null) => FeedbackVisit | null;
  /** Patients edit: Edit, Remove and Log action. */
  canEdit: boolean;
  onEdit: (item: FeedbackItem) => void;
  onRemove: (item: FeedbackItem) => void;
  onLogAction: (item: FeedbackItem, action: FeedbackActionKind) => void;
  testId: string;
}

/**
 * "Action needed" + "Log action ⌄", the latest follow-up logged — "✓ Doctor called · Riya",
 * who logged it from the team — or nothing.
 */
function ActionLine({
  item,
  canEdit,
  onLogAction,
  testId,
}: Pick<FeedbackItemCardProps, 'item' | 'canEdit' | 'onLogAction' | 'testId'>) {
  const { t } = useTranslation(CLINICAL_NS);
  const staff = useStaffLookup();
  const record = item.kind === 'checkIn' ? item.checkIn : item.review;
  const [logged] = record.actions;
  if (logged) {
    const action = t(K.actionKinds[logged.action]);
    const by = staff(logged.authorId)?.name.split(' ')[0];
    // The name isolated: a Latin first name keeps its place in a right-to-left pill.
    const text = by
      ? t(K.actionBy, { action, name: isolateText(by) })
      : t(K.actionLogged, { action });
    return (
      <>
        <span
          title={text}
          data-slot="pill"
          data-testid={`${testId}-action`}
          className={cn(
            'text-caption inline-flex h-6 min-w-0 items-center truncate rounded-full px-2.25 font-semibold',
            TONE_CLASSES.sage.surface,
          )}
        >
          {text}
        </span>
        <span className="flex-1" />
      </>
    );
  }
  if (!record.needsAction) return <span className="flex-1" />;
  return (
    <>
      <span
        data-slot="pill"
        className={cn(
          'text-caption inline-flex h-6 flex-none items-center gap-1.25 rounded-full px-2.25 font-semibold whitespace-nowrap',
          TONE_CLASSES.blush.surface,
        )}
      >
        <span
          aria-hidden="true"
          data-slot="pill"
          className="size-1.5 rounded-full bg-current"
        />
        {t(K.actionNeeded)}
      </span>
      <span className="flex-1" />
      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="xs"
              data-testid={`${testId}-log-action`}
              className="bg-foreground text-background hover:bg-foreground/85 ps-2.5 pe-1.5 text-xs"
            >
              {t(K.logAction)}
              <ChevronDown aria-hidden="true" className="size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-57.5">
            <DropdownMenuLabel>{t(K.nextAction)}</DropdownMenuLabel>
            {feedbackActionsFor(item).map((action) => (
              <DropdownMenuItem
                key={action}
                onSelect={() => onLogAction(item, action)}
                data-testid={`${testId}-action-${action}`}
              >
                {t(K.actionKinds[action])}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}

/**
 * One card of the Feedback carousel (H:4389; `patient-file.md:52–56`): 236px
 * tall — the type's tile, name and sub line with Edit / Remove; the feel or
 * the stars, the score and its trend, the followed or files tag; the quote
 * (two lines); "Next · …" or "Link · …"; and the footer: the date and the
 * action state. A card the server says needs action is outlined. Who logged
 * the record is not shown — the API does not say (G4).
 */
export function FeedbackItemCard({
  item,
  visitOf,
  canEdit,
  onEdit,
  onRemove,
  onLogAction,
  testId,
}: FeedbackItemCardProps) {
  const { t } = useTranslation(CLINICAL_NS);
  const { formatDate } = useLocaleFormat();
  const view = feedbackCardView(item, t, visitOf);
  const look = FEEDBACK_TYPE_LOOK[view.type];
  const Icon = look.icon;
  const record = item.kind === 'checkIn' ? item.checkIn : item.review;
  const date = formatDate(
    localDateOf(record.date),
    { day: 'numeric', month: 'short' },
    { civilDay: true },
  );

  return (
    <article
      data-slot="card"
      data-testid={testId}
      data-kind={item.kind}
      className={cn(
        'bg-card flex h-59 min-w-0 snap-start flex-col gap-2 rounded-xl border p-3',
        record.needsAction && 'ring-destructive/40 ring-1',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-lg',
            TONE_CLASSES[look.tone].surface,
          )}
        >
          <Icon className="size-3.75" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <span className="text-body font-semibold">{view.typeLabel}</span>
          <span className="text-caption text-muted-foreground truncate">{view.sub}</span>
        </span>
        {canEdit ? (
          <fieldset
            aria-label={t(K.actions)}
            className="m-0 flex min-w-0 flex-none items-center overflow-hidden rounded-lg border p-0"
          >
            <button
              type="button"
              onClick={() => onEdit(item)}
              aria-label={t(K.edit)}
              title={t(K.edit)}
              data-testid={`${testId}-edit`}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6.5 items-center justify-center"
            >
              <PenLine aria-hidden="true" className="size-3.25" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={t(K.remove)}
              title={t(K.remove)}
              data-testid={`${testId}-remove`}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-6.5 items-center justify-center border-s"
            >
              <Trash aria-hidden="true" className="size-3.25" />
            </button>
          </fieldset>
        ) : null}
      </div>
      <div className="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden">
        <span
          data-slot="pill"
          className={cn(
            'inline-flex h-6 flex-none items-center rounded-full px-2.25 text-xs font-semibold whitespace-nowrap',
            TONE_CLASSES[view.head.tone].surface,
            view.head.stars && 'tracking-[0.08em]',
          )}
        >
          {view.head.text}
        </span>
        {view.score ? (
          <span className="flex-none text-xs font-semibold whitespace-nowrap tabular-nums">
            {view.score}{' '}
            {view.trend ? (
              <span
                className={cn(
                  'font-medium',
                  view.trend.direction === 'up' && 'text-success',
                  view.trend.direction === 'down' && 'text-destructive',
                  view.trend.direction === 'same' && 'text-muted-foreground',
                )}
              >
                {view.trend.text}
              </span>
            ) : null}
          </span>
        ) : null}
        {view.tag ? (
          <span
            data-slot="pill"
            className={cn(
              'text-caption inline-flex h-5.5 min-w-0 items-center truncate rounded-full px-2 font-medium',
              TONE_CLASSES[view.tag.tone].surface,
            )}
          >
            {view.tag.text}
          </span>
        ) : null}
      </div>
      <span
        title={view.quote}
        className={cn(
          'text-detail line-clamp-2 min-h-9 leading-[1.45]',
          view.quoteEmpty && 'text-muted-foreground',
        )}
      >
        {view.quote}
      </span>
      <span title={view.detail} className="text-muted-foreground-strong truncate text-xs">
        <span className="text-muted-foreground">{view.detailLabel} · </span>
        {view.detail}
      </span>
      <div className="border-border/60 mt-auto flex min-w-0 items-center gap-1.5 border-t pt-2">
        <span className="text-caption text-muted-foreground flex-none whitespace-nowrap tabular-nums">
          {date}
        </span>
        <ActionLine
          item={item}
          canEdit={canEdit}
          onLogAction={onLogAction}
          testId={testId}
        />
      </div>
    </article>
  );
}
