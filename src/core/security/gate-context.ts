import type { GateContext } from '@/core/security/gate.types.ts';

/** Normalize TanStack Router `beforeLoad` location into {@link GateContext}. */
export function toGateContext(
  location: {
    pathname: string;
    search: unknown;
    hash: string;
    href: string;
  },
  params: Record<string, string | undefined>,
): GateContext {
  const search = typeof location.search === 'string' ? location.search : '';
  return {
    location: {
      pathname: location.pathname,
      search,
      hash: location.hash,
      href: location.href,
    },
    params: Object.fromEntries(
      Object.entries(params).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
  };
}
