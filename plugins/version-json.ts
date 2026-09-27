import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

/**
 * Generates version.json at build time for cache busting and deployment detection.
 * - In dev: serves /version.json on the fly
 * - In prod: emits dist/version.json and injects VITE_APP_BUILD_ID for runtime comparison
 *
 * `buildId` may be supplied by the caller so the same value can also name the
 * Sentry release (`<version>+<buildId>`), keeping the deployed build, its
 * version.json, and its Sentry release in lock step. Omitted → minted here.
 */
export function versionJson(buildId?: string): Plugin {
  const resolvedBuildId =
    buildId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const versionDetails = {
    buildId: resolvedBuildId,
    builtAt: new Date().toISOString(),
  };

  return {
    name: 'version-json',
    config() {
      return {
        define: {
          'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(resolvedBuildId),
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? '';
        if (pathname.endsWith('version.json')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.end(
            JSON.stringify(
              { ...versionDetails, builtAt: new Date().toISOString() },
              null,
              2,
            ),
          );
          return;
        }
        next();
      });
    },
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist');
      writeFileSync(
        resolve(outDir, 'version.json'),
        JSON.stringify({ ...versionDetails, builtAt: new Date().toISOString() }, null, 2),
      );
    },
  };
}
