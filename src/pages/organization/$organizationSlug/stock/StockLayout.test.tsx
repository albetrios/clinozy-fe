import { describe, expect, it } from 'vitest';

import { manifest } from './stock.manifest.ts';
import { StockLayout } from './StockLayout.tsx';

describe('StockLayout', () => {
  it('is the Clinic stock room layout over its tabs', () => {
    expect(StockLayout).toBeTypeOf('function');
    expect(manifest.kind).toBe('layout');
    expect(manifest.children).toEqual(['items', 'purchases', 'movements', 'vendors']);
  });
});
