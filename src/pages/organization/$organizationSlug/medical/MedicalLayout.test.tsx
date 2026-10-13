import { describe, expect, it } from 'vitest';

import { manifest } from './medical.manifest.ts';
import { MedicalLayout } from './MedicalLayout.tsx';

describe('MedicalLayout', () => {
  it('is the Medical room layout over its tabs', () => {
    expect(MedicalLayout).toBeTypeOf('function');
    expect(manifest.kind).toBe('layout');
    expect(manifest.children).toEqual([
      'sales',
      'medicines',
      'purchases',
      'suppliers',
      'manufacturers',
      'mrs',
      'payments',
      'credits',
    ]);
  });
});
