/**
 * Doc-sync assertions for the theme — what the theming docs must say about the
 * app's one look, and what they must no longer describe as live now that the
 * Appearance studio is retired. `pnpm validate:theme-catalog` reads this.
 */
import { THEME_ID } from './presets.ts';

interface DocAssertion {
  label: string;
  mustInclude: readonly string[];
  mustExclude?: readonly string[];
}

/**
 * The retired studio's machinery, by the names a doc would have to use to
 * describe it as live: the shared-look link, the store's shuffle and seed, the
 * generated preset.
 */
const RETIRED_STUDIO = ['?theme=', 'shuffleTheme', 'applyThemeSeed', 'GENERATED_PRESET'];

/** @public Loaded by tooling/validate/theme-catalog.mjs through a computed import. */
export const THEME_DOC_ASSERTIONS: Record<string, DocAssertion[]> = {
  'docs/reference/theming.md': [
    {
      label: 'the one look',
      mustInclude: [THEME_ID, 'data-theme', 'theme-init.js'],
      mustExclude: RETIRED_STUDIO,
    },
  ],
  'docs/reference/design.md': [
    {
      label: 'the one look',
      mustInclude: [THEME_ID],
      mustExclude: RETIRED_STUDIO,
    },
    {
      label: 'catalog source of truth',
      mustInclude: ['presets.ts', 'theme-axis-audit-playbook.md'],
    },
  ],
  'docs/reference/theme-axis-audit-playbook.md': [
    {
      label: 'the one look',
      mustInclude: [THEME_ID],
      mustExclude: RETIRED_STUDIO,
    },
  ],
};
