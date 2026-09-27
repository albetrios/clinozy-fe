import type { DeploymentMode } from '@/shared/tenancy/deployment-mode.ts';

/** Layout shell indices — `focus` is the default for personal-only deployments. */
export const APP_SHELL_VARIANT = {
  sidebar: 0,
  topNav: 1,
  rail: 2,
  focus: 3,
} as const;

export type AppShellVariant = (typeof APP_SHELL_VARIANT)[keyof typeof APP_SHELL_VARIANT];

const PREVIEW_VARIANTS: AppShellVariant[] = [
  APP_SHELL_VARIANT.sidebar,
  APP_SHELL_VARIANT.topNav,
  APP_SHELL_VARIANT.rail,
];

/**
 * Personal-only runs the Focus shell (full-width canvas, no sidebar).
 * Other modes respect the theme shuffle preview variant (0–2).
 */
export function resolveAppShellVariant(
  deploymentMode: DeploymentMode,
  themeVariant: number,
): AppShellVariant {
  if (deploymentMode === 'personal-only') {
    return APP_SHELL_VARIANT.focus;
  }
  const index = Math.max(0, Math.min(PREVIEW_VARIANTS.length - 1, themeVariant));
  return PREVIEW_VARIANTS[index] ?? APP_SHELL_VARIANT.sidebar;
}
