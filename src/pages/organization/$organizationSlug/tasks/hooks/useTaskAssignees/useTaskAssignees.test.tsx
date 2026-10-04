import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FIXTURE_VIEWER_ID } from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { useTaskAssignees } from './useTaskAssignees.ts';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('useTaskAssignees (KICKOFF §6.10 Dropdowns › Assigned)', () => {
  it('offers the active team, the member first as "<name> (you)" with their roles', async () => {
    const { result } = renderHook(() => useTaskAssignees(), { wrapper });
    await waitFor(() => expect(result.current.viewer?.id).toBe(FIXTURE_VIEWER_ID));
    await waitFor(() => expect(result.current.options.length).toBeGreaterThan(1));
    const [first] = result.current.options;
    expect(first?.key).toBe(FIXTURE_VIEWER_ID);
    expect(first?.label).toMatch(/ \(you\)$/);
    expect(first?.sub).toBeTruthy();
    const everyone = clinicFixtures.staff.snapshot();
    const left = everyone.filter((profile) => !profile.active);
    for (const profile of left) {
      expect(result.current.options.map((option) => option.key)).not.toContain(
        profile.id,
      );
      expect(result.current.byId.get(profile.id)).toBeDefined();
    }
  });
});
