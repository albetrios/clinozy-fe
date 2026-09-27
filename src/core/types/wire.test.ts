import { describe, expect, it } from 'vitest';

import {
  anyPublicIdSchema,
  decimalString,
  decimalStringToCents,
  isoDateString,
  publicId,
} from './wire.ts';

const VALID_SUFFIX = 'abcdefghij0123456789x'; // 21 lowercase alphanumerics

describe('publicId', () => {
  const orgId = publicId('org');

  it('accepts a canonical prefix + 21-char lowercase suffix', () => {
    expect(orgId.safeParse(`org_${VALID_SUFFIX}`).success).toBe(true);
  });

  it('rejects uppercase, wrong length, wrong prefix, or missing prefix', () => {
    expect(orgId.safeParse('org_ABCDEFGHIJ0123456789X').success).toBe(false);
    expect(orgId.safeParse('org_short').success).toBe(false);
    expect(orgId.safeParse(`org_${VALID_SUFFIX}extra`).success).toBe(false);
    expect(orgId.safeParse(`mem_${VALID_SUFFIX}`).success).toBe(false);
    expect(orgId.safeParse(VALID_SUFFIX).success).toBe(false);
  });
});

describe('anyPublicIdSchema', () => {
  it('accepts 2–5 char prefixes (incl. am_, whk_)', () => {
    expect(anyPublicIdSchema.safeParse(`am_${VALID_SUFFIX}`).success).toBe(true);
    expect(anyPublicIdSchema.safeParse(`whk_${VALID_SUFFIX}`).success).toBe(true);
    expect(anyPublicIdSchema.safeParse(`org_${VALID_SUFFIX}`).success).toBe(true);
  });

  it('rejects out-of-range prefixes', () => {
    expect(anyPublicIdSchema.safeParse(`a_${VALID_SUFFIX}`).success).toBe(false);
    expect(anyPublicIdSchema.safeParse(`toolong_${VALID_SUFFIX}`).success).toBe(false);
  });
});

describe('isoDateString', () => {
  it('accepts an ISO-8601 timestamp', () => {
    expect(isoDateString.safeParse('2026-06-23T12:00:00.000Z').success).toBe(true);
  });

  it('rejects a non-date string', () => {
    expect(isoDateString.safeParse('not-a-date').success).toBe(false);
  });
});

describe('decimal money', () => {
  it('converts a decimal string to integer cents', () => {
    expect(decimalStringToCents('19.00')).toBe(1900);
    expect(decimalStringToCents('0.99')).toBe(99);
    expect(decimalStringToCents('100')).toBe(10000);
  });

  it('decimalString transform yields cents', () => {
    expect(decimalString.parse('19.99')).toBe(1999);
  });

  it('rejects non-decimal input', () => {
    expect(decimalString.safeParse('1.999').success).toBe(false);
    expect(() => decimalStringToCents('abc')).toThrow();
  });
});
