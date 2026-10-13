import { describe, expect, it, vi } from 'vitest';

import { loadAppearanceDialog } from './appearance-dialog-loader.ts';

vi.mock('./AppearanceDialog.tsx', () => ({
  AppearanceDialog: () => null,
}));

describe('loadAppearanceDialog', () => {
  it('defers the drawer and shares its settled module for flicker-free reopening', async () => {
    expect(loadAppearanceDialog.peek()).toBeUndefined();
    const pending = loadAppearanceDialog();
    expect(loadAppearanceDialog()).toBe(pending);
    const module = await pending;
    expect(module.default).toBeTypeOf('function');
    expect(loadAppearanceDialog.peek()).toBe(module);
  });
});
