import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTodayEnquiries, fetchTodayFloor } from '@/shared/api/clinic/today-api.ts';
import { notify } from '@/shared/notify/index.ts';

import { seededFloor } from '../../__tests__/integration/today-fixtures.ts';
import { useTodayFloorView } from './useTodayFloorView.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));
vi.mock('@/shared/api/clinic/today-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTodayFloor: vi.fn(),
  fetchTodayEnquiries: vi.fn(),
}));
/** Whether the member sees Leads — the Enquiries lane's read. */
const access = vi.hoisted(() => ({ leads: true }));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => ({
    can: (section: string) => section !== 'leads' || access.leads,
    canCode: () => false,
    isResolved: true,
  }),
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  access.leads = true;
  const { rows, enquiries } = seededFloor();
  vi.mocked(fetchTodayFloor).mockResolvedValue(rows);
  vi.mocked(fetchTodayEnquiries).mockResolvedValue(enquiries);
});
afterEach(() => {
  client.clear();
});

describe('useTodayFloorView (KICKOFF §6.2 Route and data, States)', () => {
  it('reads the floor into lanes and the pulse, loading until both reads land', async () => {
    const { result } = renderHook(() => useTodayFloorView(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pulse).toEqual({ inClinic: 7, waiting: 3, arriving: 2 });
    expect(result.current.lanes.enquiries.map((card) => card.name)).toEqual([
      'Ishaan Verma',
      'Anaya Desai',
    ]);
  });

  it('reads no enquiries for a member who does not see Leads', async () => {
    access.leads = false;
    const { result } = renderHook(() => useTodayFloorView(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchTodayEnquiries).not.toHaveBeenCalled();
    expect(result.current.lanes.enquiries).toEqual([]);
    expect(result.current.pulse.waiting).toBe(3);
  });

  it('toasts a failed read once, with Retry', async () => {
    vi.mocked(fetchTodayFloor).mockRejectedValue(new Error('connection dropped'));
    const { result } = renderHook(() => useTodayFloorView(), { wrapper });
    await waitFor(() => expect(notify.error).toHaveBeenCalledTimes(1));
    expect(notify.error).toHaveBeenCalledWith(
      'Couldn’t load this list · connection dropped. Showing the last copy.',
      expect.objectContaining({ id: 'list-error:today-floor' }),
    );
    expect(result.current.lanes.waiting).toEqual([]);
  });
});
