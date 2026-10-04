import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils.ts';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/shared/components/ui/hover-card.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useCanHover } from '@/shared/hooks/useCanHover/index.ts';

/**
 * The card frame both kinds share: 320px (never wider than the screen less 8px
 * a side), `rounded-xl`, a column of header · scrolling body · footer, opening
 * with `czddin` — `czddup` when it flips above (H:2728, H:2871).
 */
const CARD_FRAME =
  'flex w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl p-0 data-[state=closed]:animate-none data-[state=open]:animate-dropdown-in data-[side=top]:data-[state=open]:animate-dropdown-up';

/** Max height min(520px, free space), never under 200px — per primitive's own variable. */
const HOVER_CARD_HEIGHT =
  'max-h-[max(200px,min(520px,var(--radix-hover-card-content-available-height)))]';
const POPOVER_HEIGHT =
  'max-h-[max(200px,min(520px,var(--radix-popover-content-available-height)))]';

/**
 * How the trigger draws: `chip` is the design's person-chip hover (a `muted`
 * wash and a hairline that bleed 4px past the chip, H:683); `bare` adds
 * nothing (avatars, names inside running text).
 */
/*
 * `chip` pads the hover plate past the chip (4px before, 10px after) and pulls
 * it back with negative margins, so its border box may be 14px wider than the
 * cell — a plain `max-w-full` would take those 14px from the chip and cut a
 * name or a mobile short of the cell's edge (the prototype sizes its trigger's
 * content box, so the chip reaches the edge).
 */
const TRIGGER_VARIANTS = {
  chip: '-my-1 -ms-1 -me-2.5 py-1 ps-1 pe-2.5 max-w-[calc(100%+0.875rem)] hover:bg-muted hover:inset-ring hover:inset-ring-border transition-[background-color,box-shadow] duration-150',
  bare: '',
} as const;

/** Props for {@link PersonCard}: the trigger, the data or its loader, delays and the card body. */
export interface PersonCardProps<T> {
  /** What the pointer hovers or the finger taps — the person's chip, avatar or name; not interactive itself. */
  children: ReactNode;
  /** Ready data: the card opens with it after the hover delay. */
  data?: T;
  /**
   * Or fetch first, then show (`_patterns.md:275`): called when the card is
   * wanted, aborted when it no longer is. The card stays hidden until it
   * resolves — never a skeleton popover — and a rejection never opens it.
   */
  load?: (signal: AbortSignal) => Promise<T>;
  /** Hover delays, ms (the contact card 280 / 220, the team card 160 / 200). */
  openDelay: number;
  closeDelay: number;
  /** The dialog's accessible name for this data. */
  label: (data: T) => string;
  /** Draws the card; `close` dismisses it (after an action). */
  render: (data: T, close: () => void) => ReactNode;
  testId: string;
  triggerVariant?: keyof typeof TRIGGER_VARIANTS;
  triggerClassName?: string;
}

/**
 * The person-card shell (KICKOFF §3.5): shadcn `hover-card` for a pointer that
 * can hover, `popover` opened by a tap on a touch screen — `(hover: none)` —
 * with the same 320px card, kept 8px inside the screen. Placement below, else
 * above, 6px from the trigger, aligned to its start. A tap never also reaches
 * the row underneath.
 */
export function PersonCard<T>({
  children,
  data,
  load,
  openDelay,
  closeDelay,
  label,
  render,
  testId,
  triggerVariant = 'chip',
  triggerClassName,
}: PersonCardProps<T>) {
  const canHover = useCanHover();
  const [wanted, setWanted] = useState(false);
  const [loaded, setLoaded] = useState<{ value: T } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ready = data === undefined ? loaded : { value: data };
  const hasCard = ready !== null;
  const canLoad = load !== undefined;

  const fetchCard = useEffectEvent((signal: AbortSignal) => load?.(signal));

  useEffect(() => {
    if (!wanted || data !== undefined || !canLoad) return;
    const controller = new AbortController();
    void fetchCard(controller.signal)?.then(
      (value) => {
        if (!controller.signal.aborted) setLoaded({ value });
      },
      () => {
        // A failed load simply does not open (KICKOFF §6.0 Hover cards).
        if (!controller.signal.aborted) setWanted(false);
      },
    );
    return () => controller.abort();
  }, [wanted, data, canLoad]);

  // While a tap waits on the load there is no card to dismiss yet: a tap
  // anywhere else cancels it, so the card cannot appear after the user moved on.
  useEffect(() => {
    if (canHover || !wanted || hasCard) return;
    const cancel = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) setWanted(false);
    };
    document.addEventListener('pointerdown', cancel, true);
    return () => document.removeEventListener('pointerdown', cancel, true);
  }, [canHover, wanted, hasCard]);

  const changeOpen = (open: boolean) => {
    setWanted(open);
    if (!open) setLoaded(null);
  };
  const close = () => changeOpen(false);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      data-slot="person-card-trigger"
      className={cn(
        'inline-flex max-w-full min-w-0 cursor-pointer items-center rounded-lg text-start',
        TRIGGER_VARIANTS[triggerVariant],
        triggerClassName,
      )}
      onClick={canHover ? undefined : (event: MouseEvent) => event.stopPropagation()}
    >
      {children}
    </button>
  );

  const card = ready ? (
    <TooltipProvider>{render(ready.value, close)}</TooltipProvider>
  ) : null;
  const contentProps = {
    role: 'dialog',
    'aria-label': ready ? label(ready.value) : undefined,
    'data-testid': testId,
    side: 'bottom',
    align: 'start',
    sideOffset: 6,
    collisionPadding: 8,
  } as const;

  if (canHover) {
    return (
      <HoverCard
        open={wanted}
        onOpenChange={changeOpen}
        openDelay={openDelay}
        closeDelay={closeDelay}
      >
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
        {card ? (
          <HoverCardContent
            {...contentProps}
            className={cn(CARD_FRAME, HOVER_CARD_HEIGHT)}
          >
            {card}
          </HoverCardContent>
        ) : null}
      </HoverCard>
    );
  }

  return (
    <Popover open={wanted && card !== null} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {card ? (
        <PopoverContent {...contentProps} className={cn(CARD_FRAME, POPOVER_HEIGHT)}>
          {card}
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
