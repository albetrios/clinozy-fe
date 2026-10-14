import { describe, expect, it, vi } from 'vitest';

import {
  createPinLookup,
  lookupPin,
  type PinDirectoryLoaders,
  type PinDirectoryPart,
} from './pin-directory.ts';

const SURAT_PART: PinDirectoryPart = {
  '395009': ['Surat', 'Gujarat', ['Adajan', 'Navyug College']],
  '395010': ['Surat', 'Gujarat', []],
};

const DELHI_PART: PinDirectoryPart = {
  '110001': ['New Delhi', 'Delhi', ['Connaught Place']],
};

/** Fake loaders for the Surat (`39`) and New Delhi (`11`) parts, each a spy. */
function fakeLoaders() {
  const surat = vi.fn(() => Promise.resolve(SURAT_PART));
  const delhi = vi.fn(() => Promise.resolve(DELHI_PART));
  const loaders: PinDirectoryLoaders = {
    './data/pin-39.json': surat,
    './data/pin-11.json': delhi,
  };
  return { loaders, surat, delhi };
}

describe('lookupPin — the bundled directory', () => {
  it('fills a known PIN with its district, state and areas', async () => {
    const place = await lookupPin('395009');
    expect(place).toMatchObject({ pin: '395009', district: 'Surat', state: 'Gujarat' });
    expect(place?.areas).toContain('Adajan');
  });

  it('reads the areas as places — no India Post suffixes, sorted', async () => {
    const place = await lookupPin('560001');
    expect(place?.district).toBe('Bengaluru Urban');
    expect(place?.state).toBe('Karnataka');
    expect(place?.areas.length).toBeGreaterThan(1);
    for (const area of place?.areas ?? []) {
      expect(area).not.toMatch(/\b(?:[BSH]\.?O|G\.?P\.?O)\.?$/);
    }
    expect(place?.areas).toEqual(
      [...(place?.areas ?? [])].sort((left, right) =>
        left.toLowerCase() < right.toLowerCase() ? -1 : 1,
      ),
    );
  });

  it('returns null for a PIN the directory does not know', async () => {
    await expect(lookupPin('395999')).resolves.toBeNull();
    // No part at all for the prefix.
    await expect(lookupPin('290001')).resolves.toBeNull();
  });
});

describe('createPinLookup', () => {
  it('loads only the part for the PIN prefix', async () => {
    const { loaders, surat, delhi } = fakeLoaders();
    const lookup = createPinLookup(loaders);

    await expect(lookup('395009')).resolves.toEqual({
      pin: '395009',
      district: 'Surat',
      state: 'Gujarat',
      areas: ['Adajan', 'Navyug College'],
    });
    expect(surat).toHaveBeenCalledTimes(1);
    expect(delhi).not.toHaveBeenCalled();
  });

  it('ignores a module that is not a data part', async () => {
    const stray = vi.fn(() => Promise.resolve(SURAT_PART));
    const lookup = createPinLookup({ './data/notes.json': stray });
    await expect(lookup('395009')).resolves.toBeNull();
    expect(stray).not.toHaveBeenCalled();
  });

  it('ignores spaces around the PIN', async () => {
    const lookup = createPinLookup(fakeLoaders().loaders);
    await expect(lookup(' 110001 ')).resolves.toMatchObject({ pin: '110001' });
  });

  it('returns an empty area list for a PIN with no areas of its own', async () => {
    const lookup = createPinLookup(fakeLoaders().loaders);
    await expect(lookup('395010')).resolves.toMatchObject({ areas: [] });
  });

  it.each(['', '39500', '3950091', '095009', '39500a', '395 009', 'abcdef'])(
    'returns null for the malformed PIN %j without loading anything',
    async (pin) => {
      const { loaders, surat, delhi } = fakeLoaders();
      const lookup = createPinLookup(loaders);
      await expect(lookup(pin)).resolves.toBeNull();
      expect(surat).not.toHaveBeenCalled();
      expect(delhi).not.toHaveBeenCalled();
    },
  );

  it('returns null for an unknown PIN in a known part, and for a prefix with no part', async () => {
    const { loaders, surat } = fakeLoaders();
    const lookup = createPinLookup(loaders);
    await expect(lookup('395999')).resolves.toBeNull();
    await expect(lookup('560001')).resolves.toBeNull();
    expect(surat).toHaveBeenCalledTimes(1);
  });

  it('never matches an inherited key', async () => {
    const lookup = createPinLookup(fakeLoaders().loaders);
    await expect(lookup('__proto__')).resolves.toBeNull();
  });

  it('keeps a loaded part in memory and shares one load between concurrent lookups', async () => {
    const { loaders, surat } = fakeLoaders();
    const lookup = createPinLookup(loaders);

    const [first, second] = await Promise.all([lookup('395009'), lookup('395010')]);
    expect(first?.district).toBe('Surat');
    expect(second?.district).toBe('Surat');
    await lookup('395009');
    expect(surat).toHaveBeenCalledTimes(1);
  });

  it('hands out a copy of the areas, so a caller cannot change the cached part', async () => {
    const lookup = createPinLookup(fakeLoaders().loaders);
    const place = await lookup('395009');
    place?.areas.push('Edited');
    await expect(lookup('395009')).resolves.toMatchObject({
      areas: ['Adajan', 'Navyug College'],
    });
  });

  it('resolves null when the part fails to load, then tries again on the next lookup', async () => {
    const surat = vi
      .fn<() => Promise<PinDirectoryPart>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValue(SURAT_PART);
    const lookup = createPinLookup({ './data/pin-39.json': surat });

    await expect(lookup('395009')).resolves.toBeNull();
    await expect(lookup('395009')).resolves.toMatchObject({ district: 'Surat' });
    expect(surat).toHaveBeenCalledTimes(2);
  });
});
