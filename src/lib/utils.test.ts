import { cn } from './utils.ts';

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

  it('cn("") handles empty string', () => {
    expect(cn('')).toBe('');
  });
});
