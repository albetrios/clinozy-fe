import { useSearch } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import type { PatientFileSearch } from '../../patient-id.search.ts';
import { usePatientFileActivity } from './usePatientFileActivity.ts';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

/** The column's state as a toggle, reading `activity` from the URL. */
function ActivityProbe() {
  const { activity }: PatientFileSearch = useSearch({ strict: false });
  const { open, toggle } = usePatientFileActivity(activity);
  return (
    <button type="button" aria-pressed={open} onClick={toggle}>
      Activity
    </button>
  );
}

const toggle = () => screen.findByRole('button', { name: 'Activity' });

beforeEach(() => {
  viewport.tier = 'desktop';
  useUIStore.setState({ fileActivityOpen: null });
});
afterEach(() => useUIStore.setState({ fileActivityOpen: null }));

describe('usePatientFileActivity', () => {
  it('opens from md and stays closed on a phone, with no link and no state', async () => {
    const desktop = renderWithProviders(<ActivityProbe />);
    expect(await toggle()).toHaveAttribute('aria-pressed', 'true');
    desktop.unmount();

    viewport.tier = 'phone';
    renderWithProviders(<ActivityProbe />);
    expect(await toggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('follows a link’s `activity` and makes it the session’s state', async () => {
    renderWithProviders(<ActivityProbe />, { initialEntries: ['/?activity=closed'] });
    expect(await toggle()).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(useUIStore.getState().fileActivityOpen).toBe(false));
  });

  it('keeps the state it was last left in when a link says nothing', async () => {
    useUIStore.setState({ fileActivityOpen: false });
    renderWithProviders(<ActivityProbe />);
    expect(await toggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('flips the session’s state and drops the link’s word', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders(<ActivityProbe />, {
      initialEntries: ['/?activity=open'],
    });
    await user.click(await toggle());
    await waitFor(() =>
      expect(router.state.location.search).not.toHaveProperty('activity'),
    );
    expect(useUIStore.getState().fileActivityOpen).toBe(false);
    expect(await toggle()).toHaveAttribute('aria-pressed', 'false');

    await user.click(await toggle());
    expect(useUIStore.getState().fileActivityOpen).toBe(true);
    expect(await toggle()).toHaveAttribute('aria-pressed', 'true');
  });
});
