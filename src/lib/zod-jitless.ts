/**
 * Switches Zod's JIT off before the first schema is built.
 *
 * Zod 4 decides while it builds each `z.object()` whether it may compile a fast
 * parser with `new Function` — and finds out by calling `new Function('')`. The
 * CSP (`lib/csp-api-origin.ts`) gives `script-src` no `'unsafe-eval'`, so that
 * probe throws and Zod falls back to the parser it runs without eval. The throw
 * is caught, but the browser still reports the blocked eval on every page load:
 * a DevTools issue that fails Lighthouse best-practices (`inspector-issues`) on
 * every route, and a violation report to `VITE_CSP_REPORT_URI` when one is set.
 * `jitless` skips the probe; the parser is the one the CSP already forced, so
 * nothing about parsing changes.
 *
 * It has to run before ANY object schema exists, and schemas are built at module
 * scope in many chunks that evaluate before `main.tsx`'s own body. So this module
 * is bundled INTO the `zod` chunk (its `codeSplitting` group in `vite.config.ts`): a chunk
 * that builds a schema imports that chunk, and every module in a chunk runs before
 * the chunks that import it. `main.tsx` imports it only to keep it in the graph.
 */
import { config } from 'zod';

config({ jitless: true });
