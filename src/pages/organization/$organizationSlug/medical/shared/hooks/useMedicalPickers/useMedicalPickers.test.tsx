import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';

import { useMedicalPickers } from './useMedicalPickers.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => resetAppFixtures());

describe('useMedicalPickers (medical.md:175, 182, 311–325)', () => {
  it('offers the makers as tone pills with their medicine counts', async () => {
    const { result } = renderHook(useMedicalPickers, { wrapper });
    await waitFor(() => expect(result.current.manufacturers).toHaveLength(6));
    const alvi = result.current.manufacturers.find((option) => option.label === 'ALVI');
    expect(alvi).toMatchObject({ tone: 'lav', leading: { kind: 'pill' } });
    expect(alvi?.sub).toMatch(/^\d+ medicines?$/);
  });

  it('groups the suppliers by the maker they distribute, phones as their sub line', async () => {
    const { result } = renderHook(useMedicalPickers, { wrapper });
    await waitFor(() => expect(result.current.suppliers()).toHaveLength(4));
    const grouped = result.current.suppliers(ref.manufacturer(6));
    expect(grouped.map((option) => option.group)).toEqual([
      'Distributes BLA',
      'Distributes BLA',
      'Other suppliers',
      'Other suppliers',
    ]);
    expect(grouped[0]?.sub).toMatch(/^\+91 /);
    expect(result.current.suppliers().every((option) => option.group === undefined)).toBe(
      true,
    );
  });

  it('lists a quick record at once, and a stacked child’s until the catalogue has it', async () => {
    const { result } = renderHook(useMedicalPickers, { wrapper });
    await waitFor(() => expect(result.current.mrs).toHaveLength(3));
    let id = '';
    await act(async () => {
      id = await result.current.addMr('Ravi');
    });
    expect(notifyMock.success).toHaveBeenCalledWith('MR Ravi added');
    expect(result.current.mrs.find((option) => option.key === id)?.sub).toBe(
      'No phone yet',
    );

    act(() =>
      result.current.remember.supplier({
        id: 'stacked-supplier',
        name: 'Om Pharma',
        phone: null,
        gstNumber: null,
        manufacturerIds: [],
        isQuick: false,
      } as never),
    );
    expect(
      result.current.suppliers().some((option) => option.key === 'stacked-supplier'),
    ).toBe(true);
    act(() =>
      result.current.remember.manufacturer({
        id: 'stacked-maker',
        name: 'ZEN',
        tone: 'mint',
        isQuick: false,
      } as never),
    );
    expect(
      result.current.manufacturers.some((option) => option.key === 'stacked-maker'),
    ).toBe(true);
  });
});
