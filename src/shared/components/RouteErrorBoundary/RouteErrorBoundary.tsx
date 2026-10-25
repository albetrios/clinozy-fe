import type { ErrorComponentProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { AlertTriangle } from '@/shared/icons/index.ts';

/**
 * The fallbacks' buttons in `EmptyStateAction`'s look — 36px, 8px corners, 13px
 * (`_patterns.md:283`) — kept here as classes for the same entry-chunk reason.
 */
export const FALLBACK_BUTTON_CLASS = 'text-body h-9 gap-1.5 rounded-lg px-3.5';

/**
 * The illustration's tones: stone for a missing page or a closed door, blush —
 * the tone of trouble — for a failure. Literal classes, as `TONE_CLASSES` has
 * them (disc, ink, dot), so Tailwind sees every one.
 */
const FALLBACK_TONES = {
  stone: {
    disc: 'bg-tone-stone',
    ink: 'text-tone-stone-foreground',
    dot: 'bg-tone-stone-dot',
  },
  blush: {
    disc: 'bg-tone-blush',
    ink: 'text-tone-blush-foreground',
    dot: 'bg-tone-blush-dot',
  },
} as const;

/**
 * The public status pages' emblems: the wordmark's "o" telling what happened —
 * its dot gone astray (missing), a lock inside it (locked), the ring broken
 * round its dot (broken).
 */
type FallbackEmblemKind = 'missing' | 'locked' | 'broken';

/** A public page's emblem: a brand drawing, decorative (the heading names it). */
function FallbackEmblem({ kind }: { kind: FallbackEmblemKind }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 56 56"
      fill="none"
      data-testid="fallback-emblem"
      data-emblem={kind}
      className="mb-2 size-14 overflow-visible"
    >
      {kind === 'missing' ? (
        <>
          <circle
            cx="26"
            cy="30"
            r="17"
            strokeWidth="4.5"
            className="stroke-foreground"
          />
          <circle cx="45" cy="11" r="5" className="fill-brand-mark" />
        </>
      ) : null}
      {kind === 'locked' ? (
        <>
          <circle cx="28" cy="28" r="22" strokeWidth="4" className="stroke-foreground" />
          <path
            d="M23 26v-3a5 5 0 0 1 10 0v3"
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-foreground"
          />
          <rect x="20" y="26" width="16" height="12" rx="3" className="fill-foreground" />
        </>
      ) : null}
      {kind === 'broken' ? (
        <>
          <circle
            cx="28"
            cy="28"
            r="20"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray="19 6"
            pathLength={100}
            className="stroke-foreground"
          />
          <circle cx="28" cy="28" r="6" className="fill-brand-mark" />
        </>
      ) : null}
    </svg>
  );
}

/** Props for {@link FallbackState}. */
export interface FallbackStateProps {
  tone: keyof typeof FALLBACK_TONES;
  icon: ReactNode;
  /**
   * A public page's emblem in place of the illustration (the 404, the 403, the
   * full-page failure): the wordmark's "o", with a larger heading under it.
   */
  emblem?: FallbackEmblemKind;
  /**
   * The status — "Error 404" — as a quiet pill inside the heading, above its
   * title, so the heading says it too (L-65a).
   */
  label?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** The buttons under the line. */
  actions?: ReactNode;
  /** 1 when the state is the whole page; 2 inside a shell. */
  headingLevel?: 1 | 2;
  testId?: string;
  className?: string;
}

/**
 * The design's empty state (H:695; `_patterns.md:283`) for the status and error
 * pages: the illustration — a 96px dashed ring, the tinted 68px disc, a 40px
 * card tile holding the 18px icon, a 10px and a 6px dot — then the 15px/600
 * title, the 12.5px muted line (at most 320px) and the 36px buttons.
 *
 * The same anatomy as `EmptyState`'s tone look, drawn here in plain markup on
 * purpose: the route and global boundaries are entry-chunk modules (every route
 * mounts one), and importing `EmptyState` with its clinic tone map would put the
 * room palette on every first paint. Keep the two drawings in step.
 */
export function FallbackState({
  tone,
  icon,
  emblem,
  label,
  title,
  description,
  actions,
  headingLevel = 2,
  testId,
  className,
}: FallbackStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const toneClasses = FALLBACK_TONES[tone];
  return (
    <div
      data-testid={testId}
      data-tone={tone}
      className={cn('flex flex-col items-center gap-2.5 px-4 text-center', className)}
    >
      {emblem ? <FallbackEmblem kind={emblem} /> : null}
      {emblem ? null : (
        <span
          aria-hidden="true"
          data-testid="fallback-illustration"
          className="relative mb-1.5 flex size-24 items-center justify-center"
        >
          <span
            data-slot="pill"
            className="border-border absolute inset-0 rounded-full border-[1.5px] border-dashed"
          />
          <span
            data-slot="pill"
            className={cn('absolute inset-3.5 rounded-full', toneClasses.disc)}
          />
          <span
            data-slot="empty-state-tile"
            className={cn(
              'bg-card ring-border relative flex size-10 items-center justify-center rounded-xl shadow-xs ring-1 [&_svg]:size-4.5',
              toneClasses.ink,
            )}
          >
            {icon}
          </span>
          <span
            className={cn(
              'absolute end-2 top-2.5 size-2.5 rounded-full',
              toneClasses.dot,
            )}
          />
          <span className="bg-border absolute start-1.5 bottom-3.5 size-1.5 rounded-full" />
        </span>
      )}
      <Heading
        className={cn(
          'text-foreground flex flex-col items-center gap-2 leading-[1.2] font-semibold',
          emblem ? 'text-2xl tracking-[-0.02em] text-balance' : 'text-title',
        )}
      >
        {/* The status inside the page's one heading, before its title (L-65a). */}
        {label ? (
          <span
            data-slot="pill"
            className="text-muted-foreground-strong text-caption bg-background inline-flex h-5.5 items-center rounded-full border px-2.5 font-medium tracking-normal tabular-nums"
          >
            {label}
          </span>
        ) : null}
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            'text-muted-foreground leading-normal text-pretty wrap-anywhere',
            emblem ? 'text-body max-w-96' : 'text-detail max-w-80',
          )}
        >
          {description}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Route-level error component wired as `errorComponent` on every route in
 * routeTree.tsx. Scopes a render/loader crash to the island that threw it: the
 * blush trouble tile, "This page hit an error", the thrown message, then Try
 * again and Go home.
 */
export function RouteErrorBoundary({ error, reset }: Readonly<ErrorComponentProps>) {
  const { t } = useTranslation(ERRORS_NS);

  return (
    <FallbackState
      testId="route-error-boundary"
      className="min-h-[50vh] justify-center py-16"
      tone="blush"
      icon={<AlertTriangle />}
      title={t(ERRORS_KEYS.route.pageTitle)}
      description={
        error instanceof Error ? error.message : t(ERRORS_KEYS.route.pageMessage)
      }
      actions={
        <>
          <Button
            onClick={reset}
            data-testid="route-error-retry"
            className={FALLBACK_BUTTON_CLASS}
          >
            {t(ERRORS_KEYS.route.tryAgain)}
          </Button>
          <Button variant="outline" asChild className={FALLBACK_BUTTON_CLASS}>
            <a href="/">{t(ERRORS_KEYS.route.goHome)}</a>
          </Button>
        </>
      }
    />
  );
}
