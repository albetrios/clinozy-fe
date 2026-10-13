import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import {
  type ComponentProps,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog.tsx';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/shared/components/ui/drawer.tsx';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { X } from '@/shared/icons/index.ts';

import { CONFIRM_TEST_IDS, type ConfirmLayout } from './confirm-dialog.constants.ts';

/** Props of {@link ConfirmPanel}. */
export interface ConfirmPanelProps {
  open: boolean;
  /**
   * "Keep it": the ×, the backdrop, Esc and — on the sheet — a drag down all
   * call it. Without it nothing dismisses the confirm and it draws no ×: the
   * session warning, which owes an explicit answer.
   */
  onDismiss?: () => void;
  /** The write (or the sign-out) is in flight: every exit is held and the confirm reads busy. */
  busy?: boolean;
  /** "<Action> this <record type>?" — the confirm's accessible name. */
  title: string;
  /**
   * ONE element under the title — the record pill and the effect line, or a
   * sentence — and the confirm's accessible description. It takes the
   * description slot's props (`asChild`: the id `aria-describedby` points at),
   * so it is a DOM element or a component that spreads them onto one.
   */
  description: ReactElement;
  /** Between the header and the footer: the reason chips and the note. */
  children?: ReactNode;
  /** The footer's controls, sized for the frame with {@link CONFIRM_BUTTON_CLASS}. */
  footer: (layout: ConfirmLayout) => ReactNode;
  /** What takes focus on open: the option that loses nothing ("Keep it", "Stay signed in"). */
  initialFocusRef: RefObject<HTMLElement | null>;
  /** The confirm's root test id. */
  testId: string;
}

type TextSlot = ComponentType<ComponentProps<typeof AlertDialogTitle>>;

/** What both frames render — the initial focus is already in the focus handlers. */
interface FrameProps extends Omit<ConfirmPanelProps, 'initialFocusRef'> {
  onOpenAutoFocus: (event: Event) => void;
  onCloseAutoFocus: (event: Event) => void;
}

/**
 * Focus starts on `initialFocusRef` and goes back to whatever was focused when
 * the confirm opened: it is opened from state, not a Radix trigger, so Radix
 * has nothing to hand focus back to and it fell to `<body>`. A confirm that
 * removed its opener (a deleted row) leaves focus to Radix.
 */
function useConfirmFocus(initialFocusRef: RefObject<HTMLElement | null>) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const previous = document.activeElement;
      returnFocusRef.current = previous instanceof HTMLElement ? previous : null;
      event.preventDefault();
      initialFocusRef.current?.focus({ preventScroll: true });
    },
    onCloseAutoFocus: (event: Event) => {
      const target = returnFocusRef.current;
      if (!target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  };
}

/** Title and description — the same in the panel and the sheet. */
function ConfirmHeader({
  layout,
  title,
  description,
  closable,
  Title,
  Description,
}: {
  layout: ConfirmLayout;
  title: string;
  description: ReactElement;
  closable: boolean;
  Title: TextSlot;
  Description: TextSlot;
}) {
  // The sheet keeps the × clear of the title — when it draws one.
  const sheetPadding = closable
    ? 'ps-(--drawer-pad-x) pe-14'
    : 'ps-(--drawer-pad-x) pe-(--drawer-pad-x)';
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 border-b pt-5 pb-3',
        layout === 'panel'
          ? 'min-h-(--drawer-header-height) justify-center px-(--drawer-pad-x)'
          : sheetPadding,
      )}
    >
      <Title className="text-base leading-snug font-semibold text-pretty">{title}</Title>
      <Description asChild>{description}</Description>
    </div>
  );
}

/** The footer bar: the controls at the inline end; on a phone they share the row. */
function ConfirmFooter({
  layout,
  children,
}: {
  layout: ConfirmLayout;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-canvas mt-auto flex shrink-0 items-center justify-end gap-2 border-t',
        layout === 'panel'
          ? 'px-(--table-pad-x) py-3'
          : 'flex-wrap p-(--drawer-footer-pad)',
      )}
    >
      {children}
    </div>
  );
}

/** From `md`: a full-height panel at the inline end, its × floating outside the start edge. */
function ConfirmEndPanel({
  open,
  onDismiss,
  busy = false,
  title,
  description,
  children,
  footer,
  testId,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: FrameProps) {
  const { t } = useTranslation(LOCALE_NS);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss?.();
      }}
    >
      <AlertDialogPrimitive.Portal>
        {/* The backdrop is "Keep it" too: an alert dialog ignores outside
            presses, so the overlay answers its own click. */}
        <AlertDialogPrimitive.Overlay
          data-slot="alert-dialog-overlay"
          onClick={onDismiss}
          className="bg-overlay/32 animate-backdrop-in fixed inset-0 z-50"
        />
        <AlertDialogPrimitive.Content
          data-slot="alert-dialog-content"
          data-layout="panel"
          data-testid={testId}
          aria-busy={busy || undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className="bg-background text-foreground animate-drawer-in fixed inset-y-0 end-0 z-50 flex w-[min(30rem,calc(100vw-3.5rem))] flex-col border-s outline-none"
        >
          <ConfirmHeader
            layout="panel"
            title={title}
            description={description}
            closable={onDismiss !== undefined}
            Title={AlertDialogTitle}
            Description={AlertDialogDescription}
          />
          {children}
          <ConfirmFooter layout="panel">{footer('panel')}</ConfirmFooter>
          {/* Floats outside the panel's inline-start edge; last in the DOM so
              Tab reaches the body and the footer first. */}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              disabled={busy}
              aria-label={t(LOCALE_KEYS.closeAria)}
              data-slot="floating-edge"
              data-testid={CONFIRM_TEST_IDS.close}
              className="bg-background text-foreground-soft hover:bg-muted animate-pop-in absolute end-[calc(100%+0.625rem)] top-3.5 flex size-9 items-center justify-center rounded-lg border"
            >
              <X className="size-4.5" aria-hidden />
            </button>
          ) : null}
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialog>
  );
}

/** Below `md`: a bottom sheet — full width, × inside, 44px footer buttons over the safe area. */
function ConfirmSheet({
  open,
  onDismiss,
  busy = false,
  title,
  description,
  children,
  footer,
  testId,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: FrameProps) {
  const { t } = useTranslation(LOCALE_NS);
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss?.();
      }}
      dismissible={onDismiss !== undefined && !busy}
    >
      <DrawerContent
        role="alertdialog"
        showHandle={false}
        overlayClassName="bg-overlay/32"
        data-layout="sheet"
        data-testid={testId}
        aria-busy={busy || undefined}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        className="data-[vaul-drawer-direction=bottom]:max-h-[85vh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl"
      >
        <ConfirmHeader
          layout="sheet"
          title={title}
          description={description}
          closable={onDismiss !== undefined}
          Title={DrawerTitle}
          Description={DrawerDescription}
        />
        {children}
        <ConfirmFooter layout="sheet">{footer('sheet')}</ConfirmFooter>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            aria-label={t(LOCALE_KEYS.closeAria)}
            data-testid={CONFIRM_TEST_IDS.close}
            className="text-foreground-soft hover:bg-muted absolute end-2 top-2 flex size-11 items-center justify-center rounded-lg"
          >
            <X className="size-5.5" aria-hidden />
          </button>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Every confirm's frame (`_patterns.md` › Delete confirm, KICKOFF §3.5): a
 * full-height panel at the inline end from `md`, a bottom sheet below —
 * `role="alertdialog"` over a 32% backdrop, the title and its description
 * under a hairline, an optional body, and the footer on the canvas. The plain
 * confirm, the reason confirm and the session warning all render in it, so
 * every confirm reads the same. Focus starts on `initialFocusRef` and returns
 * to whatever was focused when it opened.
 */
export function ConfirmPanel({ initialFocusRef, ...frame }: ConfirmPanelProps) {
  const tier = useViewportTier();
  const focus = useConfirmFocus(initialFocusRef);
  return tier === 'phone' ? (
    <ConfirmSheet {...frame} {...focus} />
  ) : (
    <ConfirmEndPanel {...frame} {...focus} />
  );
}
