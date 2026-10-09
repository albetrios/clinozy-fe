import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  SUGGESTION_STATUS_VALUES,
  type SuggestionStatus,
} from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { PersonAvatar } from '@/shared/components/Cells/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { RECORD_DRAWER_KEYS } from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { ItemsNumberInput } from '@/shared/forms/ItemsField/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Info,
  LinkIcon,
  Minus,
  Plus,
  Sparkles,
  Trash,
  X,
} from '@/shared/icons/index.ts';

import {
  OFFERING_SUGGESTIONS_KEYS,
  OFFERING_SUGGESTIONS_NS,
  OFFERING_SUGGESTIONS_TEST_IDS,
  ROW_FLOOR,
  SUGGESTION_GRID,
  SUGGESTION_STATUS_TONES,
} from './offering-suggestions.constants.ts';
import type {
  SuggestionIdea,
  SuggestionLine,
  SuggestionPatch,
} from './offering-suggestions.types.ts';
import {
  belowFloor,
  fullyInvoiced,
  lineFinalPrice,
  lineFloorPrice,
  SUGGESTION_QTY,
  withQty,
} from './offering-suggestions-model.ts';

const KEYS = OFFERING_SUGGESTIONS_KEYS;

/** Each status's icon (`patient-file.md:444`). */
const STATUS_ICONS = {
  planned: Clock,
  accepted: CheckCircle,
  next_time: Calendar,
  declined: X,
} as const;

/** The 22px info button and its tooltip (H:2807). */
function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="text-disabled hover:bg-muted hover:text-foreground flex size-5.5 flex-none cursor-help items-center justify-center rounded-md transition-colors"
        >
          <Info aria-hidden="true" className="size-3.25" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** The 92×30 quantity stepper: "Less" · the count · "More" (H:2808). */
function QtyStepper({
  qty,
  readOnly,
  onChange,
}: {
  qty: number;
  readOnly: boolean;
  onChange: (qty: number) => void;
}) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const step =
    'bg-canvas text-foreground-soft hover:bg-muted flex h-full w-7 items-center justify-center transition-colors disabled:opacity-45';
  return (
    <fieldset
      aria-label={t(KEYS.quantity)}
      className="border-border m-0 inline-flex h-7.5 w-23 min-w-0 items-center overflow-hidden rounded-lg border p-0 [grid-area:q]"
    >
      <button
        type="button"
        aria-label={t(KEYS.less)}
        disabled={readOnly || qty <= SUGGESTION_QTY.min}
        onClick={() => onChange(qty - 1)}
        className={step}
      >
        <Minus aria-hidden="true" className="size-3.5" />
      </button>
      <span className="text-detail flex-1 text-center font-semibold tabular-nums">
        {qty}
      </span>
      <button
        type="button"
        aria-label={t(KEYS.more)}
        disabled={readOnly || qty >= SUGGESTION_QTY.max}
        onClick={() => onChange(qty + 1)}
        className={step}
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </button>
    </fieldset>
  );
}

/** The dashed "₹ ••••" while prices hide (H:2809); a screen reader hears the hint. */
function MaskedPrice() {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="border-border-strong bg-canvas text-disabled text-body flex h-7.5 w-28 items-center justify-end rounded-lg border border-dashed px-2 font-semibold tracking-[2px]">
          <span aria-hidden="true">{t(KEYS.masked)}</span>
          <span className="sr-only">{t(KEYS.pricesHiddenHint)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{t(KEYS.pricesHiddenHint)}</TooltipContent>
    </Tooltip>
  );
}

/** The 30px status pill's frame (H:2810). */
const STATUS_PILL =
  'inline-flex h-7.5 max-w-full items-center gap-1.5 border border-transparent ps-2.5 text-xs font-semibold whitespace-nowrap';

/**
 * The 30px status pill and its picker: Planned · Accepted · Next time ·
 * Declined, each with its hint (H:2810, H:4339). Without edit, the pill alone.
 */
function StatusPicker({
  status,
  readOnly,
  onChange,
}: {
  status: SuggestionStatus;
  readOnly: boolean;
  onChange: (status: SuggestionStatus) => void;
}) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const tone = TONE_CLASSES[SUGGESTION_STATUS_TONES[status]];
  const Icon = STATUS_ICONS[status];
  const label = t(KEYS.statuses[status]);
  if (readOnly) {
    return (
      <span
        data-slot="pill"
        className={cn(STATUS_PILL, 'rounded-full pe-2.5', tone.surface)}
      >
        <Icon aria-hidden="true" className="size-3.25 flex-none" />
        <span className="min-w-0 truncate">{label}</span>
      </span>
    );
  }
  const options: PickerOption<SuggestionStatus>[] = SUGGESTION_STATUS_VALUES.map(
    (value) => ({
      key: value,
      label: t(KEYS.statuses[value]),
      sub: t(KEYS.statusHints[value]),
      tone: SUGGESTION_STATUS_TONES[value],
      data: value,
    }),
  );
  return (
    <Picker
      label={t(KEYS.columns.status)}
      options={options}
      value={status}
      onChange={(_key, option) => {
        if (option?.data) onChange(option.data);
      }}
      minWidth={280}
      renderTrigger={({ open }) => (
        <button
          type="button"
          data-slot="pill"
          aria-label={t(KEYS.statusLabel, { status: label })}
          className={cn(
            STATUS_PILL,
            'rounded-full pe-2 transition-colors hover:border-current',
            tone.surface,
          )}
        >
          <Icon aria-hidden="true" className="size-3.25 flex-none" />
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 flex-none opacity-70 transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
      )}
    />
  );
}

/** Props for {@link SuggestionRow}. */
export interface SuggestionRowProps {
  line: SuggestionLine;
  pricesShown: boolean;
  canEdit: boolean;
  canDiscount: boolean;
  onChange: (patch: SuggestionPatch) => void;
  onLinkInvoice?: () => void;
  onRemove: () => void;
}

/**
 * One suggested offering (H:2806–2812): tone dot · name · details · the
 * quantity stepper · the final price (dashed "₹ ••••" while prices hide; a
 * price below the floor turns the edge red with "Below the lowest price <₹>",
 * or "Too much discount · ask an admin" without the discount ability) · the
 * status pill — "✓ Invoiced" once every unit is — · the 26px "by" avatar ·
 * link an invoice and remove.
 */
export function SuggestionRow({
  line,
  pricesShown,
  canEdit,
  canDiscount,
  onChange,
  onLinkInvoice,
  onRemove,
}: SuggestionRowProps) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const money = usePaiseFormat();
  const readOnly = !canEdit;
  const done = fullyInvoiced(line);
  const floor = lineFloorPrice(line);
  let floorMessage: string | undefined;
  if (belowFloor(line) && floor !== null) {
    floorMessage = canDiscount
      ? t(KEYS.belowFloor, { price: money(floor) })
      : t(KEYS.tooMuchDiscount);
  }
  const doneLabel =
    line.qty > 1
      ? t(KEYS.invoicedOf, { done: line.invoicedQty, total: line.qty })
      : t(KEYS.invoiced);
  const action =
    'border-border bg-card text-muted-foreground-strong hover:text-foreground hover:border-foreground flex size-7 items-center justify-center rounded-md border transition-colors';
  return (
    <div
      data-testid={OFFERING_SUGGESTIONS_TEST_IDS.row}
      data-status={line.status}
      className={cn(
        SUGGESTION_GRID,
        ROW_FLOOR,
        'border-muted min-h-12 border-b py-1.5',
        line.status === 'declined' && 'opacity-60',
      )}
    >
      <span className="flex min-w-0 items-center gap-2 [grid-area:n]">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 flex-none rounded-full',
            TONE_CLASSES[line.tone].fill,
            TONE_CLASSES[line.tone].halo,
          )}
        />
        <span className="text-body min-w-0 truncate font-semibold">{line.name}</span>
        <InfoTip label={t(KEYS.details)} text={line.info} />
      </span>
      <QtyStepper
        qty={line.qty}
        readOnly={readOnly || done}
        onChange={(qty) => onChange(withQty(line, qty))}
      />
      <span className="flex justify-end [grid-area:p]">
        {pricesShown ? (
          <span className="relative w-28">
            <span
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-xs"
            >
              {/* The price box's "₹" before the figure (H:2809). */}
              {t(RECORD_DRAWER_KEYS.currency)}
            </span>
            <ItemsNumberInput
              money
              value={lineFinalPrice(line)}
              onValueChange={(next) => onChange({ price: next })}
              label={t(KEYS.finalPrice)}
              placeholder="0"
              maxLength={8}
              readOnly={readOnly || done}
              error={floorMessage}
              className="h-7.5 rounded-lg ps-5 font-semibold"
            />
          </span>
        ) : (
          <MaskedPrice />
        )}
      </span>
      <span className="flex min-w-0 [grid-area:st]">
        {done ? (
          <span
            data-slot="pill"
            className="bg-success text-success-foreground inline-flex h-7.5 max-w-full items-center gap-1.25 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap"
          >
            <CheckCircle aria-hidden="true" className="size-3.25 flex-none" />
            <span className="min-w-0 truncate">{doneLabel}</span>
          </span>
        ) : (
          <StatusPicker
            status={line.status}
            readOnly={readOnly}
            onChange={(status) => onChange({ status })}
          />
        )}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex justify-self-start [grid-area:by]">
            <PersonAvatar size="option" initials={line.by.initials} tone={line.by.tone} />
            <span className="sr-only">{line.by.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{line.by.label}</TooltipContent>
      </Tooltip>
      <span className="inline-flex justify-end gap-1 [grid-area:act]">
        {canEdit && onLinkInvoice && !done ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t(KEYS.linkInvoice)}
                onClick={onLinkInvoice}
                data-slot="button"
                className={action}
              >
                <LinkIcon aria-hidden="true" className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t(KEYS.linkInvoiceHint)}</TooltipContent>
          </Tooltip>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            aria-label={t(KEYS.remove)}
            title={t(KEYS.remove)}
            onClick={onRemove}
            data-slot="button"
            className={cn(
              action,
              'hover:border-destructive hover:text-destructive hover:bg-destructive-tint',
            )}
          >
            <Trash aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/**
 * An idea row (H:2814–2817, the `canvas` band): a Sparkles tile, the name,
 * "Why this idea", "—", the list price — shown whatever the price eye, as the
 * prototype draws it — a dashed "Idea" and "+ Add".
 */
export function IdeaRow({ idea, onAdd }: { idea: SuggestionIdea; onAdd?: () => void }) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const money = usePaiseFormat();
  return (
    <div
      data-testid={OFFERING_SUGGESTIONS_TEST_IDS.idea}
      className={cn(
        SUGGESTION_GRID,
        ROW_FLOOR,
        'bg-canvas border-muted min-h-11 border-b py-1',
      )}
    >
      <span className="flex min-w-0 items-center gap-2 [grid-area:n]">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-5.5 flex-none items-center justify-center rounded-md',
            TONE_CLASSES[idea.tone].surface,
          )}
        >
          <Sparkles className="size-3.25" />
        </span>
        <span className="text-body text-foreground-soft min-w-0 truncate font-semibold">
          {idea.name}
        </span>
        <InfoTip label={t(KEYS.whyIdea)} text={idea.info} />
      </span>
      <span className="text-disabled ps-2.5 text-xs [grid-area:q]">—</span>
      <span className="text-detail text-muted-foreground-strong text-end font-semibold tabular-nums [grid-area:p]">
        {money(idea.listPrice)}
      </span>
      <span className="[grid-area:st]">
        <span
          data-slot="pill"
          className="border-border-strong bg-card text-muted-foreground text-caption inline-flex h-7 items-center rounded-full border border-dashed px-2.5 font-medium"
        >
          {t(KEYS.idea)}
        </span>
      </span>
      <span className="[grid-area:by]" />
      <span className="inline-flex justify-end [grid-area:act]">
        {onAdd ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="xs"
                aria-label={t(KEYS.addNamed, { name: idea.name })}
                onClick={onAdd}
                className="border-border bg-card hover:bg-muted hover:border-foreground rounded-md text-xs shadow-none"
              >
                {t(KEYS.add)}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t(KEYS.addHint)}</TooltipContent>
          </Tooltip>
        ) : null}
      </span>
    </div>
  );
}
