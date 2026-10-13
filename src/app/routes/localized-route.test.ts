import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as LoadNamespaceModule from '@/lib/i18n/load-namespace.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { localizedRoute } from './localized-route.ts';

const ensureNamespace = vi.hoisted(() =>
  vi.fn((_locale: string, _ns: string) => Promise.resolve()),
);
vi.mock('@/lib/i18n/load-namespace.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof LoadNamespaceModule>()),
  ensureNamespace,
}));

describe('localizedRoute', () => {
  beforeEach(() => ensureNamespace.mockClear());

  it('loads the island and its copy in the active locale, and resolves with the island', async () => {
    useLocaleStore.setState({ locale: 'de' });
    const island = { Component: () => null };
    const load = vi.fn(() => Promise.resolve(island));

    const importer = localizedRoute([I18N_NAMESPACES.leads, I18N_NAMESPACES.tasks], load);
    expect(load).not.toHaveBeenCalled();

    await expect(importer()).resolves.toBe(island);
    expect(load).toHaveBeenCalledOnce();
    expect(ensureNamespace.mock.calls).toEqual([
      ['de', I18N_NAMESPACES.leads],
      ['de', I18N_NAMESPACES.tasks],
    ]);
    useLocaleStore.setState({ locale: 'en' });
  });

  it('starts the chunk without waiting for the copy', async () => {
    let releaseCopy = () => {};
    ensureNamespace.mockImplementationOnce(
      () => new Promise<void>((resolve) => (releaseCopy = resolve)),
    );
    const load = vi.fn(() => Promise.resolve({}));

    const pending = localizedRoute([I18N_NAMESPACES.today], load)();
    expect(load).toHaveBeenCalledOnce();

    releaseCopy();
    await pending;
  });

  it('fails when the island’s chunk does, so the router can retry it', async () => {
    const importer = localizedRoute([I18N_NAMESPACES.today], () =>
      Promise.reject(new Error('chunk 404')),
    );
    await expect(importer()).rejects.toThrow('chunk 404');
  });
});
