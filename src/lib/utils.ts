import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The type scale's named steps beyond Tailwind's own (`src/index.css`
 * `@theme inline`). tailwind-merge only knows Tailwind's sizes; unregistered,
 * `text-body` reads as a COLOUR and a later `text-muted-foreground` silently
 * deletes it, so the text falls back to 16px.
 */
export const TEXT_STEPS = [
  'tiny',
  'micro',
  'caption',
  'detail',
  'body',
  'field',
  'title',
  'greeting',
  'stat',
  'display',
] as const;

/**
 * The theme's animations (`--animate-*` in `src/index.css`) plus tw-animate's
 * `in` / `out`, so an explicit `data-[state=open]:animate-dropdown-in` REPLACES a
 * primitive's default `data-[state=open]:animate-in` instead of racing it on
 * stylesheet order.
 */
export const ANIMATIONS = [
  'in',
  'out',
  'accordion-down',
  'accordion-up',
  'backdrop-in',
  'bulk-in',
  'caret-blink',
  'drawer-in',
  'dropdown-in',
  'dropdown-up',
  'fade',
  'fade-in',
  'fade-in-up',
  'otp-shake',
  'pop-in',
  'reveal',
  'sheet-up',
  'shimmer',
  'spinner',
] as const;

const twMerge = extendTailwindMerge({
  extend: { theme: { text: [...TEXT_STEPS], animate: [...ANIMATIONS] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
