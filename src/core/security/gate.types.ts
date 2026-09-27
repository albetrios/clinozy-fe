/**
 * The route context a gate inspects — a minimal subset of TanStack Router's
 * `beforeLoad` argument (gates only need the location + params). Kept narrow so
 * gates stay unit-testable without a router.
 */
export interface GateContext {
  location: {
    pathname: string;
    search: string;
    hash: string;
    href: string;
  };
  params: Record<string, string>;
}

/**
 * A single access gate in the security pipeline. Resolves/returns to **pass**;
 * **throws** (a redirect / notFound / unauthorized) to halt the pipeline. Gates
 * are layered (L1 session → L2 context → … → L5 permission); see
 * `research/11` §3.7 and `core/security/gates/`.
 */
export type Gate<TCtx = GateContext> = (ctx: TCtx) => void | Promise<void>;
