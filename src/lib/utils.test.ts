import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ANIMATIONS, cn, TEXT_STEPS } from './utils.ts';

const TAILWIND_TEXT_STEPS = new Set(['xs', 'sm', 'base', 'lg', 'xl']);

describe('cn', () => {
  it('cn("a", "b") merges classes', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('cn("p-4", "p-2") resolves Tailwind conflicts (tailwind-merge)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('cn(undefined, "a") handles falsy values', () => {
    expect(cn(undefined, 'a')).toBe('a');
    expect(cn(null, 'a')).toBe('a');
    expect(cn(false, 'a')).toBe('a');
  });

  it('keeps a named text step beside a text colour (the type scale is registered)', () => {
    expect(cn('text-body', 'text-muted-foreground')).toBe(
      'text-body text-muted-foreground',
    );
    expect(cn('text-caption text-foreground', 'text-tone-sky-foreground')).toBe(
      'text-caption text-tone-sky-foreground',
    );
    expect(cn('text-sm', 'text-detail')).toBe('text-detail');
  });

  it('registers every named text step index.css declares', () => {
    const css = readFileSync(join(import.meta.dirname, '../index.css'), 'utf8');
    const declared = new Set(
      [...css.matchAll(/--text-([a-z]+):/g)]
        .map((match) => match[1])
        .filter((step) => step !== undefined && !TAILWIND_TEXT_STEPS.has(step)),
    );
    expect([...declared].sort()).toEqual([...TEXT_STEPS].sort());
  });

  it('lets an explicit open animation replace a primitive default', () => {
    expect(
      cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:animate-dropdown-in',
      ),
    ).toBe('data-[state=closed]:animate-out data-[state=open]:animate-dropdown-in');
  });

  it('registers every theme animation index.css declares', () => {
    const css = readFileSync(join(import.meta.dirname, '../index.css'), 'utf8');
    const declared = new Set(
      [...css.matchAll(/--animate-([a-z-]+):/g)].map((match) => match[1]),
    );
    expect([...declared].sort()).toEqual(
      ANIMATIONS.filter((name) => name !== 'in' && name !== 'out').sort(),
    );
  });

  it('cn("") handles empty string', () => {
    expect(cn('')).toBe('');
  });
});
