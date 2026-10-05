import { createContext } from 'react';

import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';

import type { SettingsScope, SettingsSectionRef } from './settings-sections.ts';

/**
 * The tile tone of each settings scope. The organization's settings are the
 * clinic's own — the Users room's slate (team, roles, branches); the account's
 * are personal and take stone, the design's fallback tone.
 */
export const SETTINGS_SCOPE_TONES: Readonly<Record<SettingsScope, Tone>> = {
  account: 'stone',
  organization: 'slate',
};

/**
 * The section the content pane shows, handed to its header by the modal so
 * every panel's head row draws the section's tile without passing it.
 */
export const SettingsSectionContext = createContext<SettingsSectionRef | null>(null);
