import { randomUUID } from 'node:crypto';

import babel from '@rolldown/plugin-babel';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { applyBuildEnvironment } from './plugins/build-environment.ts';
import { cspApiOrigin } from './plugins/csp-api-origin.ts';
import { devServerMode } from './plugins/dev-server-mode.ts';
import { i18nBuild } from './plugins/i18n-build.ts';
import { productIdentityHtml } from './plugins/product-identity-html.ts';
import { versionJson } from './plugins/version-json.ts';

export default defineConfig(({ command, mode }) => {
  // A build is always a production build. With NODE_ENV=development exported in
  // the shell (cloud dev containers do this), `vite build` resolves React's
  // development export condition instead: ~67 kB gz more on first paint, and
  // `pnpm size` red on that machine for a reason unrelated to the change being
  // measured. Vite reads NODE_ENV after loading this config, so this is early
  // enough; a `NODE_ENV=… vite build` script prefix would break in Windows' cmd.
  if (command === 'build') process.env.NODE_ENV = 'production';

  // Env files at project root (gitignored; only .env.example is committed): .env.local
  // (local dev) · .env.development / .env.production (the two deploy envs). Vite's `mode` is a
  // mechanism detail (dev → `dev-server`, build → `production`); the app's environment identity
  // is carried by VITE_APP_ENV, not the mode — Vite 8 forbids a mode named `local`. Vite loads
  // `.env.local` in every mode and `.env.<mode>` ON TOP of it, so the dev server runs in a mode
  // no env file is named after and reads `.env.local` alone; under Vite's default
  // `development`, `.env.development` would override it — the `devServerMode()` plugin below
  // refuses that. A build is mode `production` and reads ONE env file (envDir false, its values
  // in process.env): the environment `pnpm build` asked for (BUILD_ENVIRONMENT), else
  // `.env.local` — clinozy-be's default for an unset NODE_ENV. With neither (CI, deploys) Vite's
  // own files load; deploys materialize `.env.production.local`.
  //
  // Source maps go to Sentry only when a build asks for it: the deploy workflow sets
  // SENTRY_UPLOAD_SOURCEMAPS=true on its build step, and `pnpm build --sentry` does the same by
  // hand. Read here, before any env file loads, so a value written in a file never turns
  // uploads on — a local build is a test build and never creates a Sentry release.
  const uploadSourceMaps = process.env.SENTRY_UPLOAD_SOURCEMAPS === 'true';
  const envDir = applyBuildEnvironment({ command, root: path.resolve(__dirname) });
  const env = loadEnv(mode, envDir, '');
  if (command === 'build' && uploadSourceMaps && !env.SENTRY_AUTH_TOKEN) {
    console.warn(
      'SENTRY_UPLOAD_SOURCEMAPS=true, but SENTRY_AUTH_TOKEN is not set — no source maps are uploaded.',
    );
  }

  // One build id per build, shared by version.json (new-deploy detection) and the
  // Sentry release name below — so a build, its version.json, and its Sentry
  // release all carry the same identity. Trunk builds share a version, so the
  // build id is what disambiguates their Sentry releases.
  const buildId = `${Date.now()}-${randomUUID().slice(0, 8)}`;

  return {
    envDir,
    plugins: [
      // First: refuses a dev server in any mode but `dev-server`, before Vite reads env files.
      devServerMode(),
      // React Compiler: automatic memoization at build time (React 19).
      // The eslint react-hooks rules already lint for compiler compatibility.
      // plugin-react 6 dropped the `babel` option — the compiler now runs via
      // @rolldown/plugin-babel with the exported reactCompilerPreset.
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      // Env-driven only — set BUILD_I18N_MODE=multi in `.env.local` (local defaults)
      // for Appearance → Language; production defaults to single for white-label.
      i18nBuild({
        modeFlag: env.BUILD_I18N_MODE,
        localeFlag: env.BUILD_I18N_LOCALE,
      }),
      // The release version rides along so version.json can carry the critical-update
      // floor (src/core/version/minimum-version.constants.ts).
      versionJson(buildId, { version: env.VITE_APP_VERSION }),
      // Substitutes {{PRODUCT_*}} in index.html; runs `pre` so the CSP pass below
      // sees final markup. Keeps branding out of the rebrand surface entirely.
      productIdentityHtml(),
      cspApiOrigin(env.VITE_API_BASE_URL, env.VITE_CSP_REPORT_URI),

      // PWA — injectManifest mode avoids workbox-build/terser race condition in Vite 7
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        // 'prompt': the new worker activates only on the page's SKIP_WAITING
        // message (src/sw.ts ↔ core/version/check.ts) — never an unconditional
        // skipWaiting that could swap builds mid-task. The emitted registerSW.js
        // is the same bare registration either way; this names the real flow.
        registerType: 'prompt',
        // Defer registerSW.js — as a plain <script> it is render-blocking on the
        // critical path (~183 ms LCP on Slow 4G); SW registration has no need to
        // block first paint.
        injectRegister: 'script-defer',
        includeAssets: ['app-icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: false, // Use public/manifest.webmanifest directly
        disable: mode !== 'production',
        injectManifest: {
          // The SW gets no map at all: it is the one bundle Sentry never
          // symbolicates, so there is nothing to trade for the 228 kB of
          // `sourcesContent` it would otherwise write to dist/sw.js.map.
          // The CLIENT maps are a different case — `build.sourcemap: 'hidden'`
          // keeps writing them so the Sentry plugin can upload them, and the
          // `strip-sourcemaps` step at the end of `pnpm build` deletes them
          // afterwards. `pnpm build:check` fails if any survives.
          sourcemap: false,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
          globIgnores: [
            '**/sentry-*.js',
            '**/posthog-*.js',
            '**/SettingsModal-*.js',
            '**/CommandPalette-*.js',
            '**/AppearanceDialog-*.js',
          ],
        },
      }),

      // Bundle analyzer — only when ANALYZE=true
      ...(process.env.ANALYZE
        ? [
            visualizer({
              filename: 'dist/stats.html',
              open: true,
              gzipSize: true,
            }) as PluginOption,
          ]
        : []),

      // Sentry source map upload — only in a production build that asked for it
      // (SENTRY_UPLOAD_SOURCEMAPS=true, see above) and has credentials.
      // Source maps are uploaded then deleted from the output so they're never served publicly.
      // The plugin must be listed AFTER all other plugins.
      ...(mode === 'production' && uploadSourceMaps && env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: env.SENTRY_ORG,
              project: env.SENTRY_PROJECT,
              authToken: env.SENTRY_AUTH_TOKEN,
              release: {
                // <version>+<buildId> — unique per build so trunk builds don't
                // collapse into one Sentry release (which would mix sourcemaps).
                // The `environment` tag separates dev/prod.
                name: `${env.VITE_APP_VERSION || '0.0.0'}+${buildId}`,
              },
              sourcemaps: {
                filesToDeleteAfterUpload: ['./dist/assets/*.map'],
              },
              telemetry: false,
            }) as PluginOption,
          ]
        : []),
    ],

    resolve: {
      alias: {
        '@/tests': path.resolve(__dirname, './tests'),
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      port: 5173,
      strictPort: false,
      proxy:
        mode !== 'production'
          ? {
              '/api': {
                target: env.VITE_DEV_API_URL || 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
              },
            }
          : undefined,
    },

    build: {
      outDir: 'dist',
      // 'hidden' in production: generates source maps for Sentry upload but doesn't
      // reference them in bundles (so they're never served to end users).
      // true in dev/preview for easy debugging.
      sourcemap: mode !== 'production' ? true : 'hidden',
      assetsInlineLimit: 0,
      // Content hashes in filenames for cache busting — new builds get new URLs
      rollupOptions: {
        output: {
          // Vite 8 (rolldown/oxc) ignores `esbuild.drop` — console/debugger
          // stripping moved to the oxc minifier. compress/mangle/codegen keep
          // their defaults; only the drop flags are added.
          minify:
            mode === 'production'
              ? {
                  compress: { dropConsole: true, dropDebugger: true },
                  mangle: true,
                  codegen: true,
                }
              : undefined,
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          manualChunks(id) {
            if (id.includes('node_modules/@sentry')) return 'sentry';
            if (id.includes('node_modules/posthog-js')) return 'posthog';
            // src/lib/zod-jitless.ts rides in the zod chunk so it runs before any
            // chunk builds a schema — see that module.
            if (
              id.includes('node_modules/zod') ||
              id.endsWith('/src/lib/zod-jitless.ts')
            ) {
              return 'zod';
            }
            if (id.includes('node_modules/react-hook-form')) return 'rhf';
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/@tanstack/react-router')
            ) {
              return 'vendor';
            }
            if (id.includes('node_modules/@tanstack/react-query')) return 'query';
            // NO manual chunk for cmdk (the command palette): it is only ever
            // reached via a dynamic import (CommandPaletteLazy), so natural
            // splitting already isolates it. Forcing such a lib into a named chunk
            // makes rollup hoist a shared helper there, statically chaining the
            // whole chunk to the entry (this regressed first-paint when `recharts`
            // was a 'charts' chunk — see tooling/ci/check-preload-graph.mjs).
          },
        },
      },
    },

    // Dev-server pre-bundling ONLY — this does not touch the production build.
    //
    // Every dep listed here is reachable only from a lazy route (tables,
    // billing). Left undeclared, Vite first meets
    // them when you navigate to that route, re-optimizes mid-session and hands the
    // page a new dep hash. Modules already evaluated keep the old one, so the tab
    // ends up running TWO copies of React: `react/compiler-runtime` then reads a
    // null dispatcher off the wrong copy and every compiled component dies on
    // "Cannot read properties of null (reading 'useMemoCache')", behind a
    // "504 (Outdated Optimize Dep)" in the network log. Declaring them up front
    // means one optimize pass at server start and no mid-session swap.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        // Pinned to the same pass as react — it reads React's internals directly.
        'react/compiler-runtime',
        '@tanstack/react-table',
        '@stripe/react-stripe-js',
        '@stripe/stripe-js',
        '@sentry/react',
        // The MFA enrollment QR code (`shared/components/QrCode`) is their only
        // importer, and it sits behind the lazy Security settings panel. Missing
        // here, the first visit re-optimized mid-session and BOTH lazy settings
        // panels that pull pre-bundled deps (Security, Billing) died on a 504 for
        // the rest of that server's life — eight E2E specs red on a cold cache.
        'qrcode',
        'culori',
      ],
    },
  };
});
