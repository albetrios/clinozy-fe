import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { useFixturePlan } from './useFixturePlan.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('useFixturePlan', () => {
  it('reads a fixture patient’s plan — the invoice drawer’s rows — and stays idle without one', async () => {
    const dharti =
      clinicFixtures.patients.snapshot((row) => row.firstName === 'Dharti')[0]?.id ?? '';
    const { result } = renderHook(
      () => ({ plan: useFixturePlan(dharti), none: useFixturePlan(null) }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.plan.data?.suggestions.length).toBeGreaterThan(0),
    );
    expect(result.current.none.fetchStatus).toBe('idle');
  });
});
