import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

import { MINIMUM_SUPPORTED_VERSION } from '../src/core/version/minimum-version.constants.ts';
import { advertisedMinimumVersion } from '../src/lib/app-version.ts';

/**
 * Generates version.json at build time for cache busting and deployment detection.
 * - In dev: serves /version.json on the fly
 * - In prod: emits dist/version.json and injects VITE_APP_BUILD_ID for runtime comparison
 *
 * `buildId` may be supplied by the caller so the same value can also name the
 * Sentry release (`<version>+<buildId>`), keeping the deployed build, its
 * version.json, and its Sentry release in lock step. Omitted → minted here.
 *
 * `version` is the build's release version (`VITE_APP_VERSION`, CI-set, blank
 * locally). With it, version.json also carries `version` and — when this build
 * meets {@link MINIMUM_SUPPORTED_VERSION} — `minimumVersion`, which tells every
 * older open tab to take the critical-update path (`src/core/version/check.ts`).
 * An invalid floor throws here, so the build fails instead of shipping without it.
 */
export function versionJson(
  buildId?: string,
  { version }: { version?: string } = {},
): Plugin {
  const resolvedBuildId =
    buildId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const buildVersion = version || undefined;
  const minimumVersion = advertisedMinimumVersion(
    buildVersion,
    MINIMUM_SUPPORTED_VERSION,
  );
  const versionDetails = {
    buildId: resolvedBuildId,
    builtAt: new Date().toISOString(),
    ...(buildVersion ? { version: buildVersion } : {}),
    ...(minimumVersion ? { minimumVersion } : {}),
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
      if (MINIMUM_SUPPORTED_VERSION !== null && !minimumVersion) {
        console.info(
          `version-json: minimumVersion ${MINIMUM_SUPPORTED_VERSION} is held back — this build is ${buildVersion ?? 'unversioned'}; it ships with the release that meets it.`,
        );
      }
      const outDir = resolve(process.cwd(), 'dist');
      writeFileSync(
        resolve(outDir, 'version.json'),
        JSON.stringify({ ...versionDetails, builtAt: new Date().toISOString() }, null, 2),
      );
    },
  };
}
