import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import { BrandLogo } from '@/shared/components/ProductMark/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Card } from '@/shared/components/ui/card.tsx';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useConsentStore } from '@/shared/store/useConsentStore/index.ts';

/** Props for {@link PublicFrame}. */
export interface PublicFrameProps {
  children: ReactNode;
  /** Controls at the header's inline end — the language picker, the theme toggle. */
  controls?: ReactNode;
  /** The `<main>` id its skip link targets. */
  mainId?: string;
  /** Test id of the frame root (`auth-layout`, `public-layout`, or a page's own). */
  testId?: string;
  /** Classes for `<main>`, which centres its content by default. */
  className?: string;
}

/**
 * The signed-out frame (L-65). The design has no sign-in screen of its own; its
 * nearest is the "Signed out" screen (H:515) — the canvas (`--z50`) with one
 * 12px card on it — so every page before the clinic shell is that: the canvas, a
 * header at the app header's metrics (52px on a phone, 60px from `md`, sides
 * `--room-header-pad-x`) with the logo exactly where the section bar draws it
 * (`shell.md:18`) — so it does not move when the user signs in — and the
 * controls at the end, then a `<main>` that centres its content on the
 * viewport, then a footer of the header's height (so the centring holds) with
 * claude.com's "Privacy choices": it reopens the cookie card, so a signed-out
 * visitor can change their answer (D12; signed in, Settings › Privacy does).
 */
export function PublicFrame({
  children,
  controls,
  mainId = 'main-content',
  testId,
  className,
}: PublicFrameProps) {
  return (
    <div
      data-testid={testId}
      className="bg-canvas text-foreground flex min-h-dvh flex-col"
    >
      <PublicSkipLink mainId={mainId} />
      <header className="flex min-h-13 flex-none items-center justify-between gap-3 px-(--room-header-pad-x) md:min-h-15">
        <BrandLogo wordmark="always" />
        {controls ? (
          <div
            className="flex min-w-0 items-center gap-2"
            data-testid="public-frame-controls"
          >
            {controls}
          </div>
        ) : null}
      </header>
      <main
        id={mainId}
        className={cn(
          'flex flex-1 flex-col items-center justify-center px-4 py-2',
          className,
        )}
      >
        {children}
      </main>
      <footer className="flex min-h-13 flex-none items-center justify-center px-(--room-header-pad-x) md:min-h-15">
        <PublicPrivacyChoices />
      </footer>
    </div>
  );
}

/**
 * The signed-out frame's skip link — hidden until focused, then the first
 * thing on the page — to the `<main>` whose id it is given.
 */
export function PublicSkipLink({ mainId = 'main-content' }: { mainId?: string }) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <a
      href={`#${mainId}`}
      className="focus:bg-background focus:text-foreground sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:underline"
    >
      {t(LAYOUT_KEYS.a11y.skipToMain)}
    </a>
  );
}

/**
 * claude.com's "Privacy choices" link in the signed-out frame's footer: it
 * reopens the cookie card, so a signed-out visitor can change their answer (D12).
 */
export function PublicPrivacyChoices() {
  const { t } = useTranslation(LOCALE_NS);
  const openPreferences = useConsentStore((s) => s.openPreferences);
  return (
    <Button
      variant="link"
      size="xs"
      onClick={openPreferences}
      className="text-muted-foreground hover:text-foreground text-xs font-normal"
      data-testid="privacy-choices"
    >
      {t(LOCALE_KEYS.consentPrivacyChoices)}
    </Button>
  );
}

/**
 * The card widths: `auth` is the "Signed out" card's 360px (sign-in, MFA, an
 * invitation, the organization list); `wizard` is 480px, the delete confirm's
 * width — the widest single-column form the design draws outside a drawer.
 */
const CARD_WIDTHS = {
  auth: 'max-w-90',
  wizard: 'max-w-120',
} as const;

/** Props for {@link PublicCard}: a `div`'s, plus its width. */
export type PublicCardProps = ComponentProps<'div'> & {
  width?: keyof typeof CARD_WIDTHS;
};

/**
 * The card on the signed-out canvas — the "Signed out" card (H:515): full width
 * up to 360px (or 480px), 28px top and bottom, the drawer's side inset
 * (`--drawer-pad-x`: 24 · 20 · 16px), 12px corners, a 1px border and the card's
 * lift (the `card` slot, so the elevation axis restyles it).
 */
export function PublicCard({ width = 'auth', className, ...props }: PublicCardProps) {
  return (
    <Card
      className={cn(
        'w-full gap-5 px-(--drawer-pad-x) py-7',
        CARD_WIDTHS[width],
        className,
      )}
      {...props}
    />
  );
}

/**
 * The heading sizes: `card` is the drawer title's 18px/600; `display` is the
 * sign-in screen's — 24px, 30px from `xl`, where the form owns a whole panel.
 */
const CARD_HEADER_SIZES = {
  card: 'text-lg leading-[1.2] tracking-[-0.01em]',
  display: 'text-2xl leading-[1.15] tracking-[-0.025em] xl:text-3xl',
} as const;

/** Props for {@link PublicCardHeader}. */
export interface PublicCardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Test id on the heading itself. */
  titleTestId?: string;
  /** `card` (default) or `display` — the sign-in screen's larger heading. */
  size?: keyof typeof CARD_HEADER_SIZES;
  className?: string;
}

/**
 * A public card's heading — the page's `h1` — in the drawer title's anatomy
 * (18px/600, −0.01em, line height 1.2) with the 13px muted sub line under it
 * (`preset.md` Typography). The sign-in screens draw it at `display` size.
 */
export function PublicCardHeader({
  title,
  description,
  titleTestId,
  size = 'card',
  className,
}: PublicCardHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-1.5', size === 'display' && 'gap-2', className)}
    >
      <h1
        data-testid={titleTestId}
        className={cn('font-semibold text-balance', CARD_HEADER_SIZES[size])}
      >
        {title}
      </h1>
      {description ? (
        <p className="text-body text-muted-foreground text-pretty">{description}</p>
      ) : null}
    </header>
  );
}
