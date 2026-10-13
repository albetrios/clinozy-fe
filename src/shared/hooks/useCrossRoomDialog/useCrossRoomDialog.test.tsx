import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  type CrossRoomDialog,
  CrossRoomDialogContext,
  useCrossRoomDialog,
} from './useCrossRoomDialog.ts';

describe('useCrossRoomDialog (A-P1)', () => {
  it('is null on a drawer’s own route — no host provides one', () => {
    const { result } = renderHook(() => useCrossRoomDialog());
    expect(result.current).toBeNull();
  });

  it('reads the drawer route the host provides over the referring page', () => {
    const dialog: CrossRoomDialog = {
      pathname: '/organization/acme/invoices/create',
      search: { type: 'clinic', from: 'today' },
      params: { organizationSlug: 'acme' },
      close: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CrossRoomDialogContext.Provider value={dialog}>
        {children}
      </CrossRoomDialogContext.Provider>
    );
    const { result } = renderHook(() => useCrossRoomDialog(), { wrapper });
    expect(result.current).toBe(dialog);
  });
});
