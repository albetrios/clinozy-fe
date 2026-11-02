import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'dotenv';
import { describe, expect, it } from 'vitest';

import { envProfiles } from '../../src/core/config/env-schema.ts';

// Runs the real validator, not a copy of its matcher: `env-schema.test.ts` proved each rule
// matches, while the validator read only git-tracked env files, of which there are none. Every
// `forbidden` rule was dead, and a production deploy with a test Stripe key printed `OK`.

const TSX = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const VALIDATOR = join(process.cwd(), 'tooling', 'validate', 'client-env.ts');

/** `pnpm validate:client-env --env <environment>` as a deploy's validate step runs it. */
function validateDeploy(
  environment: 'development' | 'production',
  injected: Record<string, string>,
): { status: number | null; output: string } {
  const result = spawnSync(TSX, [VALIDATOR, '--env', environment], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_ACTIONS: 'true',
      NODE_ENV: 'production',
      VITE_APP_ENV: environment,
      ...injected,
    },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('the client-env check gates what a deploy carries', () => {
  it('refuses local-only and test values on a production deploy', () => {
    const { status, output } = validateDeploy('production', {
      DEV_API_URL: 'http://localhost:3000',
      VITE_API_BASE_URL: 'http://localhost:3000',
      VITE_CAPTCHA_DISABLED: 'true',
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_planted',
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    });
    expect(status).toBe(1);
    expect(output).toContain('DEV_API_URL must not be set in production');
    expect(output).toContain('VITE_API_BASE_URL must not be set in production');
    expect(output).toContain('VITE_STRIPE_PUBLISHABLE_KEY must not be set in production');
    expect(output).toContain('VITE_TURNSTILE_SITE_KEY must not be set in production');
    expect(output).toContain('VITE_CAPTCHA_DISABLED=true is not allowed in production');
  });

  it('refuses local-only values and a live Stripe key on a development deploy', () => {
    const { status, output } = validateDeploy('development', {
      DEV_API_URL: 'http://localhost:3000',
      VITE_API_BASE_URL: 'http://127.0.0.1:3000',
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_live_planted',
    });
    expect(status).toBe(1);
    expect(output).toContain('DEV_API_URL must not be set in development');
    expect(output).toContain('VITE_API_BASE_URL must not be set in development');
    expect(output).toContain(
      'VITE_STRIPE_PUBLISHABLE_KEY must not be set in development',
    );
  });

  it('leaves real deploy values alone', () => {
    const { output } = validateDeploy('production', {
      DEV_API_URL: '',
      VITE_API_BASE_URL: 'https://api.example.test',
      VITE_CAPTCHA_DISABLED: 'false',
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_live_real',
      VITE_TURNSTILE_SITE_KEY: '0x4AAAAAAArealkey',
    });
    expect(output).not.toContain('DEV_API_URL must not be set');
    expect(output).not.toContain('VITE_API_BASE_URL must not be set');
    expect(output).not.toContain('VITE_STRIPE_PUBLISHABLE_KEY must not be set');
    expect(output).not.toContain('VITE_TURNSTILE_SITE_KEY must not be set');
    expect(output).not.toContain('VITE_CAPTCHA_DISABLED=');
  });

  // New env files start as a copy of `.env.example` (clinozy-infra's export, `pnpm setup:local`),
  // so a value there lands in deploy files. That is how production came to hold the dev proxy's
  // `http://localhost:3000`.
  it('.env.example seeds nothing a deploy refuses', () => {
    const example = parse(readFileSync(join(process.cwd(), '.env.example')));
    const seeded = [
      ...envProfiles.development.forbidden,
      ...envProfiles.production.forbidden,
    ].filter((rule) => {
      const value = example[rule.key];
      return value ? (rule.valuePattern?.test(value) ?? true) : false;
    });
    expect(seeded.map((rule) => rule.key)).toEqual([]);
  });
});
