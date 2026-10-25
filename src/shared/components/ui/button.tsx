import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils.ts';

import { Spinner } from './spinner.tsx';

/**
 * Local changes to the shadcn button (re-apply after a shadcn refresh): the
 * design's sizes (`_patterns.md:35, 103, 128, 130`) — 13px/500 at 36 · 32 ·
 * 28px (`default` · `sm` · `xs`, and their square `icon` sizes), an 8px radius
 * (`rounded-lg`), the z900 fill as the primary (the preset's `primary`) — the
 * light-red `danger` (a tinted fill, red ink and edge: the row actions'
 * destructive button, H:128) beside the red-filled `destructive`, and the
 * phone's floating `pill` (52px, 14px, the FAB shadow; H:103). A `pill`
 * carries `data-slot="pill"`, so the Sharp shape squares it. And the press
 * (change-motion-polish): every variant but `link` (its `data-variant`) sinks
 * to 97% while held — `scale` rides the button's own transition — and not
 * under reduced motion. One base class, so the entry chunk carries it once.
 * `isLoading` draws the app's one loader ({@link Spinner}) before the label,
 * which stays as it is, and the button keeps its colour (`aria-busy` lifts the
 * disabled dim): it is working, not unavailable.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-body font-medium transition-[color,background-color,border-color,box-shadow,scale] motion-safe:active:not-data-[variant=link]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-busy:disabled:opacity-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        danger:
          'border border-destructive-border bg-destructive-tint text-destructive hover:border-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      // No `has-[>svg]:` re-padding: it outranked a caller's own padding whenever
      // an icon was a direct child. A screen pads an icon + label button itself.
      size: {
        default: 'h-9 px-3.5',
        xs: "h-7 gap-1 px-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: 'h-8 gap-1.5 px-3',
        lg: 'h-10 px-5',
        pill: 'h-13 gap-2 rounded-full ps-4 pe-5 text-sm shadow-(--elevation-fab)',
        icon: 'size-9',
        'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  isLoading,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    isLoading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isLoading || disabled}
      aria-busy={isLoading}
      {...props}
      // A pill stays a pill under a Radix trigger's slot props: the Sharp shape reads it.
      {...(size === 'pill' ? { 'data-slot': 'pill' } : {})}
    >
      {asChild ? (
        children
      ) : (
        <>
          {isLoading && <Spinner />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
