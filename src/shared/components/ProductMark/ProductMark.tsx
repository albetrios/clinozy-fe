import { wordmarkParts } from '@/lib/brand-wordmark.ts';
import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { cn } from '@/lib/utils.ts';

/**
 * The product mark (`shell.md:18`; H:525, H:62): on a 28-unit grid, a tile in
 * `primary` with corner 8, the "C" stroke (2.6, round caps) in
 * `primary-foreground` and the `brand-mark` dot. A brand asset: its corner is
 * fixed rather than following the radius and shape axes, so the header, the
 * boot loader, the HTML splash and `public/app-icon.svg` draw the same thing.
 * Decorative — the caller names it (`role="img"` / text beside it).
 */
export function ProductMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      aria-hidden
      data-testid="product-mark"
      className={cn('block flex-none', className)}
    >
      <rect width="28" height="28" rx="8" className="fill-primary" />
      <path
        d="M18.6 9.1a6.4 6.4 0 1 0 0 9.8"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
      <circle cx="20.2" cy="14" r="2.3" className="fill-brand-mark" />
    </svg>
  );
}

/**
 * The wordmark: the product name in lower case, its first "o" drawn as a ring
 * with a `brand-mark-strong` centre ({@link wordmarkParts} — the same split the
 * HTML splash is drawn with). A brand drawing, not translated copy; decorative
 * (`aria-hidden`) — size it with the caller's font size.
 */
export function ProductWordmark({ className }: { className?: string }) {
  const { head, ring, tail } = wordmarkParts(PRODUCT_NAME);
  return (
    <span
      aria-hidden
      data-testid="product-wordmark"
      className={cn(
        'text-foreground inline-flex items-baseline leading-none font-semibold tracking-[-0.03em] whitespace-nowrap',
        className,
      )}
    >
      {ring ? (
        <>
          {head}
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="inline-block size-[0.56em] overflow-visible align-[-0.02em]"
          >
            <circle
              cx="10"
              cy="10"
              r="7.6"
              fill="none"
              strokeWidth="4.2"
              className="stroke-foreground"
            />
            <circle cx="10" cy="10" r="3" className="fill-brand-mark-strong" />
          </svg>
          {tail}
        </>
      ) : (
        head
      )}
    </span>
  );
}
