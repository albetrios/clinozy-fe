import { cn } from '@/lib/utils.ts';

/**
 * A settings row's icon action, in the table row action's look
 * (`_patterns.md:128`, as the rooms' `DataTableRowActions` draw it): a 32px
 * outline square (`size="icon-sm"`), 8px corners, no shadow; `danger` sits on
 * the destructive tint with the red icon. The caller keeps its own test id,
 * name and busy state.
 */
export function settingsRowActionClass(danger = false): string {
  return cn(
    'rounded-lg shadow-none transition-colors duration-120',
    danger
      ? // The `dark:` pair outranks the outline variant's `dark:bg-input/30 dark:border-input`.
        'bg-destructive-tint border-destructive-border text-destructive hover:border-destructive hover:bg-destructive-tint hover:text-destructive dark:bg-destructive-tint dark:border-destructive-border dark:hover:bg-destructive-tint'
      : 'bg-card text-foreground-soft hover:border-primary hover:bg-muted hover:text-foreground',
  );
}
