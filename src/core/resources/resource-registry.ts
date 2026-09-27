import type { Resource } from './types.ts';

const registry = new Map<string, Resource>();

/**
 * Register a resource manifest. Called once per resource at app startup
 * (typically from the resource's `<resource>.resource.ts` file).
 *
 * Re-registering an existing resource overwrites the previous entry —
 * useful for HMR but should not happen in production.
 */
export function registerResource(resource: Resource): void {
  registry.set(resource.name, resource);
}

/** Lookup a registered resource by name. Returns `undefined` if missing. */
export function getResource(name: string): Resource | undefined {
  return registry.get(name);
}

/** Get every registered resource — used by the nav menu and dev tools. */
export function listResources(): Resource[] {
  return [...registry.values()];
}

/** Clear the registry — test-only helper. */
export function __clearRegistry(): void {
  registry.clear();
}
