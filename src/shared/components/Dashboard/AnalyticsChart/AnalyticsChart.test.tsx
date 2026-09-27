import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AnalyticsChart } from './AnalyticsChart.tsx';

// Radix Select relies on Pointer Capture + scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('AnalyticsChart', () => {
  it('renders the activity chart card with a time-range selector', async () => {
    renderWithProviders(<AnalyticsChart />);

    expect(await screen.findByTestId('dashboard-analytics-chart')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-analytics-range')).toBeInTheDocument();
    expect(screen.getByText('Workspace activity')).toBeInTheDocument();
  });

  it('lets the user switch the time range', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsChart />);

    const trigger = await screen.findByTestId('dashboard-analytics-range');
    expect(trigger).toHaveTextContent('Last 30 days');

    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Last 7 days' }));

    expect(trigger).toHaveTextContent('Last 7 days');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<AnalyticsChart />);
    await screen.findByTestId('dashboard-analytics-chart');
    expect(await axe(container)).toHaveNoViolations();
  });
});
