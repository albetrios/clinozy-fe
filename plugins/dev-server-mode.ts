import type { ConfigEnv, Plugin } from 'vite';

/**
 * The Vite mode the dev server runs in (`pnpm dev` passes `--mode dev-server`).
 *
 * Not Vite's default `development`: Vite loads `.env`, `.env.local`, `.env.<mode>` and
 * `.env.<mode>.local`, the later file winning, so under `development` the gitignored
 * `.env.development` — the development DEPLOY-env file `pnpm github:sync` pushes from —
 * overrides `.env.local` key by key. A dev server then called the hosted API instead of
 * clinozy-be on :3000. No env file is named after this mode, so the dev server reads
 * `.env.local` only, which is the `local` environment's file. (Vite 8 forbids a mode named
 * `local`; the environment identity is `VITE_APP_ENV`, never the mode.)
 */
export const DEV_SERVER_MODE = 'dev-server';

/**
 * Throws when the dev server would start in any mode but {@link DEV_SERVER_MODE}.
 *
 * A bare `vite` (or `vite --mode development`) would otherwise read a deploy-env file on top
 * of `.env.local` with nothing on screen to say so. Builds and `vite preview` pass: a build is
 * always `production`, and a preview serves what a build already baked.
 *
 * Pinned by `tests/ci/dev-server-env.policy.test.ts`.
 */
export function assertDevServerMode({
  command,
  mode,
  isPreview,
}: Pick<ConfigEnv, 'command' | 'mode' | 'isPreview'>): void {
  if (command !== 'serve' || isPreview === true || mode === DEV_SERVER_MODE) return;
  throw new Error(
    `The dev server runs in mode "${DEV_SERVER_MODE}", not "${mode}" — start it with \`pnpm dev\`. ` +
      `In mode "${mode}" Vite would load .env.${mode} on top of .env.local, and the dev server ` +
      'reads .env.local only (.env.development and .env.production are the deploy-env files).',
  );
}

/**
 * Runs {@link assertDevServerMode} in a `config` hook — after the config file is evaluated
 * and before Vite loads any env file, so a refused dev server never reads one.
 *
 * A plugin rather than a call in `vite.config.ts`'s own function: tools such as knip
 * evaluate that function with Vite's default `serve` + `development` to read the config,
 * and only Vite itself runs plugin hooks.
 */
export function devServerMode(): Plugin {
  return {
    name: 'clinozy-fe-dev-server-mode',
    config(_config, env) {
      assertDevServerMode(env);
    },
  };
}
