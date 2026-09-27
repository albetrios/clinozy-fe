import { configureAxe } from 'vitest-axe';

/**
 * Radix Dialog/AlertDialog focus guards mark inert siblings `aria-hidden`, which
 * triggers axe's aria-hidden-focus rule when the dialog is open in jsdom. Disable
 * that rule for overlay components — focus trapping is verified by Radix itself.
 */
export const axeForDialog = configureAxe({
  rules: { 'aria-hidden-focus': { enabled: false } },
});
