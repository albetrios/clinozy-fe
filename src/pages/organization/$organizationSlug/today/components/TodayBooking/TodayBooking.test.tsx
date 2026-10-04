import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { TodayBooking } from './TodayBooking.tsx';

/** The shared form, as a stub that shows how it was opened. */
vi.mock('@/shared/forms/AppointmentForm/index.ts', () => ({
  AppointmentForm: (props: {
    mode: string;
    prefill?: { whoId?: string; copyOf?: string; collapsed?: boolean };
    appointmentId?: string;
    readOnly?: boolean;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Booking">
      <span data-testid="mode">{props.mode}</span>
      <span data-testid="who">{props.prefill?.whoId ?? props.appointmentId}</span>
      <span data-testid="read-only">{String(props.readOnly ?? false)}</span>
      <button type="button" onClick={props.onClose}>
        Close
      </button>
    </div>
  ),
}));

afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
});

describe('TodayBooking (the shared form stacked over Today)', () => {
  it('renders nothing until a booking is asked for', () => {
    renderWithProviders(<TodayBooking request={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a new booking with its prefill, and closes back to Today', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <TodayBooking
        request={{ mode: 'create', prefill: { whoId: 'p-1', collapsed: true } }}
        onClose={onClose}
      />,
    );
    expect(await screen.findByTestId('mode')).toHaveTextContent('create');
    expect(screen.getByTestId('who')).toHaveTextContent('p-1');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves a booking — read-only without Appointments Edit', async () => {
    useOrganizationStore.getState().setPermissions(['organization:read']);
    useUIStore.setState({ previewRole: 'pharmacist' });
    renderWithProviders(
      <TodayBooking
        request={{ mode: 'reschedule', appointmentId: 'a-1' }}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByTestId('mode')).toHaveTextContent('reschedule');
    expect(screen.getByTestId('who')).toHaveTextContent('a-1');
    expect(screen.getByTestId('read-only')).toHaveTextContent('true');
  });
});
