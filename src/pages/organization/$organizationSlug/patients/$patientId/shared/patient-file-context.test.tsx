import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  PatientFileContext,
  type PatientFileContextValue,
  usePatientFileContext,
} from './patient-file-context.ts';

describe('usePatientFileContext', () => {
  it('hands a part of the file what the layout provides', () => {
    const value: PatientFileContextValue = {
      patientId: 'p1',
      file: undefined,
      section: 'visits',
      viewable: ['visits'],
      masked: true,
      toggleMasked: vi.fn(),
      photos: { pick: vi.fn(), upload: vi.fn() },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PatientFileContext.Provider value={value}>{children}</PatientFileContext.Provider>
    );
    const { result } = renderHook(() => usePatientFileContext(), { wrapper });
    expect(result.current).toBe(value);
  });

  it('refuses to run outside the patient file', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => usePatientFileContext())).toThrow(
      'usePatientFileContext must be used inside the patient file',
    );
    vi.restoreAllMocks();
  });
});
