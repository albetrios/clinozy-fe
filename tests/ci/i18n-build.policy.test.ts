import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { build, createServer, type HotUpdateOptions, type Plugin } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { i18nBuild, localeNamespaceOf } from '../../plugins/i18n-build.ts';
import { I18N_NAMESPACES } from '../../src/lib/i18n/namespaces.ts';

const RESOURCE_ID = '\0virtual:clinozy-fe-i18n-resources';
const NAMESPACE_ID = (namespace: string) =>
  `\0virtual:clinozy-fe-i18n-namespace/${namespace}`;

describe('production i18n resource boundaries', () => {
  it.each([
    ['en-US', 'en'],
    ['es-ES', 'es'],
    ['xx-XX', 'en'],
  ])('keeps %s shells ready and awaits deferred %s copy', async (localeFlag, locale) => {
    const server = await createServer({
      configFile: false,
      envFile: false,
      plugins: [i18nBuild({ modeFlag: 'single', localeFlag })],
      server: { middlewareMode: true, watch: null },
    });
    try {
      const resources = await server.ssrLoadModule(RESOURCE_ID);
      const bootstrap = resources.getBootstrapResources();
      expect(Object.keys(bootstrap)).toEqual([locale]);
      expect(resources.getBuildLocaleProfile().locale).toBe(locale);
      expect(bootstrap[locale]).toEqual({
        common: expect.any(Object),
        errors: expect.any(Object),
        layout: expect.any(Object),
        auth: { manifest: expect.any(Object) },
        onboarding: { manifest: expect.any(Object) },
        settings: {
          dialog: expect.any(Object),
          discard: expect.any(Object),
          nav: expect.any(Object),
          panels: { appearance: expect.any(Object) },
        },
      });
      for (const namespace of Object.values(I18N_NAMESPACES)) {
        const expected = JSON.parse(
          readFileSync(resolve(`src/locales/${locale}/${namespace}.json`), 'utf8'),
        );
        await expect(resources.loadLocaleNamespace(locale, namespace)).resolves.toEqual(
          expected,
        );
      }
    } finally {
      await server.close();
    }
  });

  it('emits selected-language namespaces as lazy chunks, not entry imports', async () => {
    const result = await build({
      configFile: false,
      envFile: false,
      logLevel: 'silent',
      plugins: [i18nBuild({ modeFlag: 'single', localeFlag: 'es-ES' })],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: RESOURCE_ID,
          preserveEntrySignatures: 'strict',
        },
      },
    });
    if (!('output' in result)) throw new Error('Expected one Rollup output');
    const chunks = result.output.filter((item) => item.type === 'chunk');
    const entry = chunks.find((chunk) => chunk.isEntry);
    expect(entry?.imports).toEqual([]);
    expect(entry?.dynamicImports).toHaveLength(Object.values(I18N_NAMESPACES).length);
    expect(
      chunks
        .flatMap((chunk) => Object.keys(chunk.modules))
        .filter((id) => id.includes('/locales/')),
    ).toEqual([]);
    expect(chunks.filter((chunk) => !chunk.isEntry)).toHaveLength(
      Object.values(I18N_NAMESPACES).length,
    );
  });

  it('selects the runtime resource loader in multi mode', async () => {
    const server = await createServer({
      configFile: false,
      envFile: false,
      plugins: [i18nBuild({ modeFlag: 'multi' })],
      server: { middlewareMode: true, watch: null },
    });
    try {
      const resolved = await server.pluginContainer.resolveId(
        '@/lib/i18n/i18n-resources.ts',
      );
      expect(resolved?.id).toBe(resolve('src/lib/i18n/i18n-resources.multi.ts'));
    } finally {
      await server.close();
    }
  });
});

/**
 * The plugin's `hotUpdate` hook against a stand-in dev environment: a module
 * graph holding `loaded` and a hot channel that records what it sends.
 */
async function hotUpdate(plugin: Plugin, file: string, loaded: readonly string[]) {
  const modules = new Map(loaded.map((id) => [id, { id }]));
  const environment = {
    moduleGraph: {
      getModuleById: (id: string) => modules.get(id),
      invalidateModule: vi.fn(),
    },
    hot: { send: vi.fn() },
  };
  const hook = plugin.hotUpdate;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (!handler) throw new Error('the plugin has no hotUpdate hook');
  const result = await handler.call(
    { environment } as never,
    {
      type: 'update',
      file,
      timestamp: 0,
      modules: [],
      read: () => '',
      server: {},
    } as unknown as HotUpdateOptions,
  );
  return { result, environment };
}

describe('dev server: a locale edit reaches the page without a restart', () => {
  it('names the namespace a file feeds — the build’s locale or its English fallback', () => {
    expect(localeNamespaceOf('/repo/src/locales/en/clinic.json', 'en')).toBe('clinic');
    expect(localeNamespaceOf('/repo/src/locales/es/patients.json', 'es')).toBe(
      'patients',
    );
    expect(localeNamespaceOf('/repo/src/locales/en/patients.json', 'es')).toBe(
      'patients',
    );
    expect(localeNamespaceOf('C:\\repo\\src\\locales\\en\\clinic.json', 'en')).toBe(
      'clinic',
    );
    expect(localeNamespaceOf('/repo/src/locales/de/clinic.json', 'en')).toBeUndefined();
    expect(localeNamespaceOf('/repo/src/locales/en/unknown.json', 'en')).toBeUndefined();
    expect(localeNamespaceOf('/repo/src/pages/patients.json', 'en')).toBeUndefined();
  });

  it('drops the modules built from an edited locale file and reloads the page', async () => {
    const plugin = i18nBuild({ modeFlag: 'single', localeFlag: 'en-US' });
    const { result, environment } = await hotUpdate(
      plugin,
      resolve('src/locales/en/clinic.json'),
      [NAMESPACE_ID('clinic'), NAMESPACE_ID('patients'), RESOURCE_ID],
    );
    expect(result).toEqual([]);
    expect(
      environment.moduleGraph.invalidateModule.mock.calls.map(([module]) => module),
    ).toEqual([{ id: NAMESPACE_ID('clinic') }, { id: RESOURCE_ID }]);
    expect(environment.hot.send).toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it('leaves every other edit to Vite', async () => {
    const single = i18nBuild({ modeFlag: 'single', localeFlag: 'en-US' });
    const loaded = [NAMESPACE_ID('clinic'), RESOURCE_ID];
    for (const file of [
      resolve('src/pages/organization/$organizationSlug/patients/PatientsPage.tsx'),
      resolve('src/locales/de/clinic.json'),
    ]) {
      const { result, environment } = await hotUpdate(single, file, loaded);
      expect(result).toBeUndefined();
      expect(environment.hot.send).not.toHaveBeenCalled();
    }
    // Nothing built from the file yet: nothing to drop, no reload.
    const unloaded = await hotUpdate(single, resolve('src/locales/en/clinic.json'), []);
    expect(unloaded.result).toBeUndefined();
    expect(unloaded.environment.hot.send).not.toHaveBeenCalled();
    // Multi mode imports the JSON itself, which Vite already tracks.
    const multi = await hotUpdate(
      i18nBuild({ modeFlag: 'multi' }),
      resolve('src/locales/en/clinic.json'),
      loaded,
    );
    expect(multi.result).toBeUndefined();
  });
});
