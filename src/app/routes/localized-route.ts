import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import type { I18nNamespace } from '@/lib/i18n/namespaces.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

/**
 * A route island's importer that also loads the copy it renders: the
 * namespaces, in the active locale, alongside the island's chunk — so the
 * island never paints before its words have arrived. Wrap the importer handed
 * to `lazyRouteComponent` (the router preloads both together on intent).
 */
export function localizedRoute<T>(
  namespaces: readonly I18nNamespace[],
  load: () => Promise<T>,
): () => Promise<T> {
  return async () => {
    const locale = useLocaleStore.getState().locale;
    const [, module] = await Promise.all([
      Promise.all(namespaces.map((ns) => ensureNamespace(locale, ns))),
      load(),
    ]);
    return module;
  };
}
