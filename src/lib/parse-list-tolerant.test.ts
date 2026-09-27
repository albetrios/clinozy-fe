import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { parseListTolerant } from './parse-list-tolerant.ts';

const row = z.object({ id: z.string(), n: z.number() });

describe('parseListTolerant', () => {
  it('keeps valid rows, drops malformed ones, and warns (telemetry)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const out = parseListTolerant(
      row,
      [
        { id: 'a', n: 1 },
        { id: 'b', n: 'not-a-number' },
        { id: 'c', n: 3 },
      ],
      'things',
    );

    expect(out).toEqual([
      { id: 'a', n: 1 },
      { id: 'c', n: 3 },
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropped 1 malformed'));
    warn.mockRestore();
  });

  it('returns [] and warns for a non-array payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseListTolerant(row, { not: 'an array' }, 'things')).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn when every row is valid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const out = parseListTolerant(row, [{ id: 'a', n: 1 }], 'things');
    expect(out).toEqual([{ id: 'a', n: 1 }]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
