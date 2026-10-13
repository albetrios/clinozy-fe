import { isModuleEnabled } from '@/core/security/gates/require-module.ts';

import type { SettingsSectionRef } from './settings-sections.ts';

/**
 * L6b module keys for settings sections — must stay aligned with
 * `docs/reference/frontend-platform.md` (Module key catalog).
 * Sections without an entry are always enabled when permitted.
 */
export function settingsSectionModuleKey(ref: SettingsSectionRef): string | undefined {
  if (ref.scope === 'account') {
    if (ref.section === 'billing') return 'billing';
    // An account section since it moved out of Organization (a bookmarked
    // `organization/integrations` hash resolves here too), so its gate lives here.
    if (ref.section === 'integrations') return 'integrations';
    return undefined;
  }

  return ref.section === 'members' ? 'members' : undefined;
}

/** Whether L6b allows this settings section for the current deployment. */
export function isSettingsModuleEnabled(ref: SettingsSectionRef): boolean {
  const moduleKey = settingsSectionModuleKey(ref);
  if (!moduleKey) return true;
  return isModuleEnabled(moduleKey);
}
