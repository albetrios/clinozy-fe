import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { reportDouble } from '../../__tests__/integration/report-api-double.ts';
import { useReportsTable } from './useReportsTable.tsx';

let client: QueryClient;
const ROWS = [
  reportDouble(),
  reportDouble({ id: 'prep_consent0000000000000', type: 'consent', fileKeys: [] }),
];
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

describe('useReportsTable (H:4760)', () => {
  it('lays out Report · Type · Date, Report the primary — no "Uploaded by" (G4)', () => {
    const { result } = renderHook(() => useReportsTable(ROWS), { wrapper });
    expect(result.current.getAllLeafColumns().map((column) => column.id)).toEqual([
      'report',
      'type',
      'date',
    ]);
    expect(result.current.getVisibleLeafColumns()).toHaveLength(3);
    expect(result.current.getColumn('report')?.columnDef.meta?.primary).toBe(true);
  });

  it('folds the type with its dot', () => {
    const { result } = renderHook(() => useReportsTable(ROWS), { wrapper });
    expect(
      result.current.getColumn('type')?.columnDef.meta?.foldValue?.(ROWS[0]),
    ).toEqual({
      value: 'Lab',
      dotClassName: expect.stringMatching(/^bg-tone-mint/),
    });
  });
});
