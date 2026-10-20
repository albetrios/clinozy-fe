import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// Locks the three conventions tooling/eslint/conventions-plugin.mjs checks, against the REAL
// config. The planted-bug drill (20 Oct 2026) reached a PR with each one broken: a login page
// importing the mfa island by a relative path (A1-9), an import with no extension (A1-8) and a
// constant inline style (A1-11). Each case lints a probe at a real path, so the island lookup
// reads the real src/pages tree.

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: process.cwd() });
});

/** The ids of the conventions rules that fire on `source` linted as `filePath`. */
async function fired(options: { source: string; filePath: string }): Promise<string[]> {
  const [result] = await eslint.lintText(options.source, { filePath: options.filePath });
  return (result?.messages ?? [])
    .map((message) => message.ruleId ?? '')
    .filter((ruleId) => ruleId.startsWith('conventions/'));
}

const PATIENT = 'src/pages/organization/$organizationSlug/patients/$patientId';

describe('a page never imports a sideways page island', () => {
  it('the login page may not import the mfa island by a relative path', async () => {
    expect(
      await fired({
        source:
          "import { MFA_NS } from '../mfa/mfa.constants.ts';\nexport const ns = MFA_NS;\n",
        filePath: 'src/pages/login/LoginPage.tsx',
      }),
    ).toContain('conventions/no-sibling-island-import');
  });

  it('a parent island may import its child islands, and a child its parent', async () => {
    expect(
      await fired({
        source: "export { Route } from './edit/edit.route.tsx';\n",
        filePath: `${PATIENT}/patient-id.sections.ts`,
      }),
    ).toEqual([]);
    expect(
      await fired({
        source: "export { Route } from '../patient-id.route.tsx';\n",
        filePath: `${PATIENT}/edit/probe.ts`,
      }),
    ).toEqual([]);
  });

  it('files inside one island import each other freely', async () => {
    expect(
      await fired({
        source:
          "import { MFA_NS } from '../mfa.constants.ts';\nexport const ns = MFA_NS;\n",
        filePath: 'src/pages/mfa/forms/probe.ts',
      }),
    ).toEqual([]);
  });
});

describe('every relative and @/ import names its extension', () => {
  it.each([
    "import { cn } from '@/lib/utils';",
    "import { a } from './contracts';",
    "import { b } from '../x/y';",
  ])('%s fails', async (line) => {
    expect(
      await fired({
        source: `${line}\nexport {};\n`,
        filePath: 'src/shared/components/Probe/Probe.tsx',
      }),
    ).toContain('conventions/import-extension');
  });

  it.each([
    "import { cn } from '@/lib/utils.ts';",
    "import './probe.css';",
    "import { z } from 'zod';",
  ])('%s passes', async (line) => {
    expect(
      await fired({
        source: `${line}\nexport {};\n`,
        filePath: 'src/shared/components/Probe/Probe.tsx',
      }),
    ).toEqual([]);
  });
});

describe('a constant inline style is a Tailwind class', () => {
  const component = (style: string) =>
    `export function Probe({ offset }: { offset: number }) {\n  return <li style={${style}}>{offset}</li>;\n}\n`;

  it('style={{ minWidth: 24 }} fails', async () => {
    expect(
      await fired({
        source: component('{ minWidth: 24 }'),
        filePath: 'src/pages/onboarding/components/Probe/Probe.tsx',
      }),
    ).toContain('conventions/no-static-inline-style');
  });

  it('a style computed at runtime passes', async () => {
    expect(
      await fired({
        source: component('{ top: offset, height: `${offset}px` }'),
        filePath: 'src/pages/onboarding/components/Probe/Probe.tsx',
      }),
    ).toEqual([]);
  });

  it('vendored shadcn primitives keep their inline CSS variables', async () => {
    expect(
      await fired({
        source: component("{ '--radius': '4px' }"),
        filePath: 'src/shared/components/ui/probe.tsx',
      }),
    ).toEqual([]);
  });
});
