import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';

import {
  APPEARANCE_DIALOG_KEYS,
  APPEARANCE_DIALOG_NS,
} from './appearance-dialog.constants.ts';

const here = dirname(fileURLToPath(import.meta.url));

/** Every module the root route reaches through this folder's lazy shell. */
const ENTRY_FILES = [
  'index.ts',
  'AppearanceDialogLazy.tsx',
  'appearance-dialog-pending.tsx',
  'appearance-dialog-loader.ts',
  'appearance-dialog.constants.ts',
  'appearance.constants.ts',
];

describe('appearance drawer header keys', () => {
  // The placeholder is mounted on the ROOT route, so it ships in the entry
  // chunk. Reading these strings off `SETTINGS_KEYS` dragged that module's whole
  // key table (~17 kB of source) onto the first paint of every load — so they
  // are declared locally. This is the other half of that trade: they must stay
  // identical to the originals.
  it('match the Settings panel keys they duplicate', () => {
    expect(APPEARANCE_DIALOG_KEYS).toEqual(SETTINGS_KEYS.panels.appearance);
    expect(APPEARANCE_DIALOG_NS).toBe(SETTINGS_NS);
  });
});

describe('appearance drawer — the entry chunk', () => {
  it('does not import the settings key table', () => {
    for (const file of ENTRY_FILES) {
      const source = readFileSync(join(here, file), 'utf8');
      expect(source, file).not.toContain('SettingsModal/settings.constants');
    }
  });

  it('reaches the drawer, the record drawer and the panel only through the loader', () => {
    // Initial JS has well under a kilobyte of headroom: one static import of the
    // drawer would put the record drawer (and everything under it) on every
    // first paint. The loader's dynamic import() is the one way in.
    for (const file of ENTRY_FILES) {
      const source = readFileSync(join(here, file), 'utf8');
      const staticImports = [...source.matchAll(/^import[^;]*?from '([^']+)'/gms)].map(
        (match) => match[1],
      );
      for (const path of staticImports) {
        expect(path, `${file} imports ${path}`).not.toMatch(
          /AppearanceDialog\.tsx$|AppearancePanel\.tsx$|RecordDrawer\/(index|RecordDrawer)\.tsx?$/,
        );
      }
    }
    expect(readFileSync(join(here, 'appearance-dialog-loader.ts'), 'utf8')).toContain(
      "import('./AppearanceDialog.tsx')",
    );
  });
});
