import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { wireSchema } from './wire-schema.ts';

interface ApiThing {
  id?: string;
  thing_number?: number;
  contact?: { id?: string; first_name?: string } | null;
}

describe('wireSchema', () => {
  it('hands back the schema it was given — the check is at compile time', () => {
    const schema = z.object({ id: z.string(), thing_number: z.number() });

    expect(wireSchema<ApiThing>()(schema)).toBe(schema);
  });

  it('parses at runtime, where presence is enforced (the API types mark every field optional)', () => {
    const thingWire = wireSchema<ApiThing>()(
      z.object({
        id: z.string(),
        thing_number: z.number(),
        contact: z.object({ id: z.string(), first_name: z.string() }).nullable(),
      }),
    );

    expect(
      thingWire.safeParse({ id: 'thg_x', thing_number: 4, contact: null }).success,
    ).toBe(true);
    expect(thingWire.safeParse({ id: 'thg_x', contact: null }).success).toBe(false);
  });
});
