import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { RetryError } from './RetryError.tsx';

describe('RetryError', () => {
  it('renders default "Something went wrong." message', () => {
    render(<RetryError onRetry={() => {}} />);
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<RetryError message="Custom error message" onRetry={() => {}} />);
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('calls onRetry when button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<RetryError onRetry={onRetry} />);

    const button = screen.getByRole('button', { name: /try again/i });
    await user.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when isRetrying=true', () => {
    render(<RetryError onRetry={() => {}} isRetrying />);
    const button = screen.getByRole('button', { name: /try again/i });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<RetryError onRetry={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
