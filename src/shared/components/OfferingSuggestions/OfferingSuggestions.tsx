import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { revealInScroller } from '@/lib/reveal-in-scroller.ts';
import { cn } from '@/lib/utils.ts';
import {
  ConfirmDialog,
  type ConfirmReasonChoice,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { ChevronDown, Eye, EyeOff, Plus } from '@/shared/icons/index.ts';

import {
  OFFERING_SUGGESTIONS_KEYS,
  OFFERING_SUGGESTIONS_NS,
  OFFERING_SUGGESTIONS_TEST_IDS,
  SUGGESTION_GRID,
} from './offering-suggestions.constants.ts';
import type {
  SuggestionActivityLine,
  SuggestionIdea,
  SuggestionLine,
  SuggestionPatch,
  SuggestionPurchase,
} from './offering-suggestions.types.ts';
import { suggestionCounts, suggestionTotals } from './offering-suggestions-model.ts';
import { IdeaRow, SuggestionRow } from './SuggestionRows.tsx';
import { ActivityTable, PurchasesTable } from './SuggestionTables.tsx';

const KEYS = OFFERING_SUGGESTIONS_KEYS;

/**
 * Remove's reasons (H:4353): Added by mistake · Duplicate · Plan changed ·
 * Other — "Plan changed" is stored as `other` with its label in the note.
 */
const REMOVE_REASONS: readonly ConfirmReasonOption[] = [
  { value: 'mistake', labelKey: KEYS.removeConfirm.reasons.addedByMistake },
  { value: 'duplicate', labelKey: KEYS.removeConfirm.reasons.duplicate },
  { value: 'plan_changed', labelKey: KEYS.removeConfirm.reasons.planChanged },
  { value: 'other', labelKey: KEYS.removeConfirm.reasons.other },
];

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * The header's sub line (H:4376). Open: "<n> suggested · <n> accepted", or
 * "Nothing suggested yet", then "<n> past purchases". Closed: "<n> planned ·
 * <n> accepted", or "No suggestions yet", then "<n> ideas".
 */
function headerSub({
  t,
  open,
  counts,
  purchases,
  ideas,
}: {
  t: Translate;
  open: boolean;
  counts: { live: number; accepted: number };
  purchases: number;
  ideas: number;
}): string {
  const parts: string[] = [];
  if (counts.live > 0) {
    parts.push(
      t(open ? KEYS.suggested : KEYS.planned, { count: counts.live }),
      t(KEYS.accepted, { count: counts.accepted }),
    );
  } else {
    parts.push(t(open ? KEYS.nothingSuggested : KEYS.noSuggestions));
  }
  if (open && purchases > 0) parts.push(t(KEYS.pastPurchases, { count: purchases }));
  if (!open && ideas > 0) parts.push(t(KEYS.ideas, { count: ideas }));
  return parts.join(' · ');
}

/**
 * The line under the total (H:4376): "Saves <₹> on list · <₹> invoiced",
 * either alone, else "At list price" — nothing while the plan is empty.
 */
function totalsLine({
  t,
  money,
  totals,
  hasLines,
}: {
  t: Translate;
  money: (paise: number) => string;
  totals: { saved: number; invoiced: number };
  hasLines: boolean;
}): string {
  const parts: string[] = [];
  if (totals.saved > 0) parts.push(t(KEYS.savesOnList, { amount: money(totals.saved) }));
  if (totals.invoiced > 0) {
    parts.push(t(KEYS.invoicedAmount, { amount: money(totals.invoiced) }));
  }
  if (parts.length > 0) return parts.join(' · ');
  return hasLines ? t(KEYS.atListPrice) : '';
}

/** Props for {@link OfferingSuggestions}. */
export interface OfferingSuggestionsProps {
  /** The patient's first name: "Nothing suggested for <first> yet.", "<first>’s last purchases". */
  firstName: string;
  lines: readonly SuggestionLine[];
  /** Ideas from history, at most four (H:4366). */
  ideas?: readonly SuggestionIdea[];
  /** The last six purchase lines and what the patient has paid so far (`getPlan`, `S:1635`). */
  purchases?: { lines: readonly SuggestionPurchase[]; paidSoFar: number };
  /** "Contact activity · <summary>" — the lead's thread — with "Open chat". */
  activity?: {
    summary: string;
    lines: readonly SuggestionActivityLine[];
    onOpenChat?: () => void;
  };
  /** Where it sits: the patient file starts it collapsed, the appointment form open (H:4375). */
  variant: 'file' | 'form';
  /** Edit on the plan — quantities, prices, statuses, links, remove, add. Without it the card reads. */
  canEdit: boolean;
  /** The discount ability: a price below the floor names the lowest price. */
  canDiscount: boolean;
  /**
   * Prices shown — controlled: the form starts them shown, the patient file
   * hidden (H:4375).
   */
  pricesShown: boolean;
  onPricesShownChange: (shown: boolean) => void;
  onChange?: (line: SuggestionLine, patch: SuggestionPatch) => void;
  /** "Link an invoice by hand" — the host opens its invoice picker. */
  onLinkInvoice?: (line: SuggestionLine) => void;
  /**
   * After the reason confirm: the stored `delete_reason` and note ("Plan
   * changed" is stored as `other` with its label in the note). Throwing keeps
   * the confirm open.
   */
  onRemove?: (line: SuggestionLine, choice: ConfirmReasonChoice) => void | Promise<void>;
  onAddIdea?: (idea: SuggestionIdea) => void;
  /**
   * The dashed "Add offering" — the trigger of a "Search offerings" list
   * (`addDD`, H:4373): the host's offerings, grouped by category, an offering
   * already suggested disabled; picking one hands its key to `onPick`.
   */
  addOffering?: { options: readonly PickerOption[]; onPick: (key: string) => void };
  /**
   * Open or collapsed — controlled when the host passes it (the appointment
   * form's plan flag opens it); the card's own otherwise, starting by `variant`.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** The open header's end (H:2803): the plan total, the line under it and the 32px price eye. */
function PlanTotal({
  total,
  summary,
  pricesShown,
  onPricesShownChange,
}: {
  total: string;
  summary: string;
  pricesShown: boolean;
  onPricesShownChange: (shown: boolean) => void;
}) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const priceLabel = t(pricesShown ? KEYS.hidePrices : KEYS.showPrices);
  return (
    <div className="flex flex-none items-center gap-2 ps-1 pe-3.5">
      <span className="flex flex-col items-end leading-[1.3]">
        <span className="text-title font-semibold tabular-nums">{total}</span>
        <span className="text-caption text-muted-foreground tabular-nums">{summary}</span>
      </span>
      <button
        type="button"
        aria-pressed={pricesShown}
        aria-label={priceLabel}
        title={priceLabel}
        data-testid={OFFERING_SUGGESTIONS_TEST_IDS.prices}
        onClick={() => onPricesShownChange(!pricesShown)}
        data-slot="button"
        className="border-border bg-card text-muted-foreground-strong hover:bg-muted hover:text-foreground flex size-8 flex-none items-center justify-center rounded-lg border transition-colors"
      >
        {pricesShown ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  );
}

/** What the open card lists — the props it shares with the card, and Remove's ask. */
type PlanBodyProps = Pick<
  OfferingSuggestionsProps,
  | 'firstName'
  | 'lines'
  | 'purchases'
  | 'activity'
  | 'canEdit'
  | 'canDiscount'
  | 'pricesShown'
  | 'onChange'
  | 'onLinkInvoice'
  | 'onAddIdea'
  | 'addOffering'
> & {
  ideas: readonly SuggestionIdea[];
  /** Remove opens the reason confirm the card owns. */
  onAskRemove: (line: SuggestionLine) => void;
};

/**
 * The open card (H:2805–2825): the column header (hidden under 600px), the
 * suggested rows or "Nothing suggested for <first> yet.", the ideas, the
 * dashed "Add offering", the last purchases and the contact activity.
 */
function PlanBody({
  firstName,
  lines,
  ideas,
  purchases,
  activity,
  canEdit,
  canDiscount,
  pricesShown,
  onChange,
  onLinkInvoice,
  onAddIdea,
  addOffering,
  onAskRemove,
}: PlanBodyProps) {
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          SUGGESTION_GRID,
          'border-border bg-canvas text-micro text-muted-foreground border-b py-1.5 font-semibold tracking-[0.05em] uppercase @max-[600px]:hidden',
        )}
      >
        <span className="[grid-area:n]">{t(KEYS.columns.suggested)}</span>
        <span className="[grid-area:q]">{t(KEYS.columns.qty)}</span>
        <span className="text-end [grid-area:p]">{t(KEYS.columns.price)}</span>
        <span className="[grid-area:st]">{t(KEYS.columns.status)}</span>
      </div>
      {lines.map((line) => (
        <SuggestionRow
          key={line.id}
          line={line}
          pricesShown={pricesShown}
          canEdit={canEdit}
          canDiscount={canDiscount}
          onChange={(patch) => onChange?.(line, patch)}
          onLinkInvoice={onLinkInvoice ? () => onLinkInvoice(line) : undefined}
          onRemove={() => onAskRemove(line)}
        />
      ))}
      {lines.length === 0 ? (
        <p className="border-muted text-detail text-muted-foreground border-b px-3.5 py-3">
          {t(KEYS.empty, { first: firstName })}
        </p>
      ) : null}
      {ideas.map((idea) => (
        <IdeaRow
          key={idea.id}
          idea={idea}
          onAdd={canEdit && onAddIdea ? () => onAddIdea(idea) : undefined}
        />
      ))}
      {canEdit && addOffering ? (
        <div className="border-border border-b px-3.5 py-2">
          <Picker
            label={t(KEYS.addOffering)}
            options={addOffering.options}
            value={null}
            onChange={(key) => {
              if (key) addOffering.onPick(key);
            }}
            searchable
            searchPlaceholder={t(KEYS.searchOfferings)}
            minWidth={340}
            testId={OFFERING_SUGGESTIONS_TEST_IDS.addOffering}
            className="w-auto"
            renderTrigger={() => (
              <button
                type="button"
                data-testid={OFFERING_SUGGESTIONS_TEST_IDS.addOffering}
                data-slot="button"
                className="border-border-strong bg-card hover:bg-muted text-detail inline-flex h-7.5 items-center gap-1.5 rounded-lg border border-dashed ps-2.5 pe-3 font-medium transition-colors"
              >
                <Plus
                  aria-hidden="true"
                  className="text-muted-foreground-strong size-3.5"
                />
                {t(KEYS.addOffering)}
              </button>
            )}
          />
        </div>
      ) : null}
      {purchases && purchases.lines.length > 0 ? (
        <PurchasesTable
          firstName={firstName}
          purchases={purchases.lines}
          paidSoFar={purchases.paidSoFar}
        />
      ) : null}
      {activity && activity.lines.length > 0 ? (
        <ActivityTable
          summary={activity.summary}
          lines={activity.lines}
          onOpenChat={activity.onOpenChat}
        />
      ) : null}
    </>
  );
}

/**
 * Offering suggestions (KICKOFF §6.4 form, §6.6 patient file; H:781–806,
 * H:2802–2826): the header "Offering suggestions" with its sub line and
 * chevron; open, the plan's total with what it saves on list and what is
 * invoiced, and the price eye. Then the suggested rows, the ideas, "Add
 * offering", "<first>’s last purchases" and "Contact activity". It wraps by
 * its own width — a container: rows take two lines under 600px, purchases and
 * activity three columns under 720px (H:415–422) — so the patient file's
 * full-width card and the form's column each lay it out right.
 */
export function OfferingSuggestions({
  ideas = [],
  variant,
  onPricesShownChange,
  onRemove,
  open: openProp,
  onOpenChange,
  ...props
}: OfferingSuggestionsProps) {
  const { firstName, lines, pricesShown } = props;
  const { t } = useTranslation(OFFERING_SUGGESTIONS_NS);
  const money = usePaiseFormat();
  const [ownOpen, setOwnOpen] = useState(variant === 'form');
  const sectionRef = useRef<HTMLElement>(null);
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOwnOpen(next);
    onOpenChange?.(next);
    // Opened past the scroller's edge: bring it into view (H:4016 `accReveal`).
    if (next) revealInScroller(sectionRef.current);
  };
  const [removing, setRemoving] = useState<SuggestionLine | null>(null);
  const totals = suggestionTotals(lines);
  const sub = headerSub({
    t,
    open,
    counts: suggestionCounts(lines),
    purchases: props.purchases?.lines.length ?? 0,
    ideas: ideas.length,
  });

  return (
    <TooltipProvider>
      <section
        ref={sectionRef}
        aria-label={t(KEYS.title)}
        data-slot="card"
        data-testid={OFFERING_SUGGESTIONS_TEST_IDS.card}
        className="bg-card @container flex min-w-0 flex-none flex-col overflow-hidden rounded-xl border"
      >
        <div
          className={cn(
            'flex items-center border-b',
            open ? 'border-border' : 'border-transparent',
          )}
        >
          <button
            type="button"
            aria-expanded={open}
            data-testid={OFFERING_SUGGESTIONS_TEST_IDS.toggle}
            onClick={() => setOpen(!open)}
            className="hover:bg-canvas flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-3 text-start transition-colors"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-field leading-[1.3] font-semibold">
                {t(KEYS.title)}
              </span>
              <span className="text-muted-foreground truncate text-xs leading-[1.3]">
                {sub}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'text-muted-foreground size-4 flex-none transition-transform duration-150',
                open && 'rotate-180',
              )}
            />
          </button>
          {open ? (
            <PlanTotal
              total={pricesShown ? money(totals.total) : t(KEYS.masked)}
              summary={
                pricesShown
                  ? totalsLine({ t, money, totals, hasLines: lines.length > 0 })
                  : t(KEYS.pricesHidden)
              }
              pricesShown={pricesShown}
              onPricesShownChange={onPricesShownChange}
            />
          ) : null}
        </div>
        {open ? <PlanBody {...props} ideas={ideas} onAskRemove={setRemoving} /> : null}
        <ConfirmDialog
          open={removing !== null}
          onOpenChange={(next) => {
            if (!next) setRemoving(null);
          }}
          title={t(KEYS.removeConfirm.title)}
          description={t(KEYS.removeConfirm.effect, { first: firstName })}
          confirmLabel={t(KEYS.remove)}
          reason={{
            record: removing
              ? t(KEYS.removeConfirm.record, { name: removing.name })
              : undefined,
            options: REMOVE_REASONS,
          }}
          onConfirm={async (choice) => {
            if (removing) await onRemove?.(removing, choice);
          }}
        />
      </section>
    </TooltipProvider>
  );
}
