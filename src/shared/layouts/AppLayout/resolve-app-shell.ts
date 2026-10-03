import type { DeploymentMode } from '@/shared/tenancy/deployment-mode.ts';

/** Layout shell indices — `focus` is the default for personal-only deployments. */
export const APP_SHELL_VARIANT = {
  sidebar: 0,
  topNav: 1,
  rail: 2,
  focus: 3,
  /** The clinic launch's one-header shell (KICKOFF §3.2). */
  sectionBar: 4,
} as const;

export type AppShellVariant = (typeof APP_SHELL_VARIANT)[keyof typeof APP_SHELL_VARIANT];

/**
 * The shells a team deployment can show, in `appVariant` order. `sectionBar`
 * comes first, so the default — `appVariant` 0, never persisted and never
 * rolled by shuffle (`SHUFFLE_TEMP.appLayout` is off) — is the clinic launch's
 * shell (KICKOFF §3.2, make-it-live contract); the others stay as previews.
 */
const PREVIEW_VARIANTS: AppShellVariant[] = [
  APP_SHELL_VARIANT.sectionBar,
  APP_SHELL_VARIANT.sidebar,
  APP_SHELL_VARIANT.topNav,
  APP_SHELL_VARIANT.rail,
];

/**
 * Personal-only runs the Focus shell (full-width canvas, no sidebar).
 * Other modes map the preview variant (0–3) onto {@link PREVIEW_VARIANTS};
 * the default 0 is `sectionBar`.
 */
export function resolveAppShellVariant(
  deploymentMode: DeploymentMode,
  themeVariant: number,
): AppShellVariant {
  if (deploymentMode === 'personal-only') {
    return APP_SHELL_VARIANT.focus;
  }
  const index = Math.max(0, Math.min(PREVIEW_VARIANTS.length - 1, themeVariant));
  return PREVIEW_VARIANTS[index] ?? APP_SHELL_VARIANT.sectionBar;
}
