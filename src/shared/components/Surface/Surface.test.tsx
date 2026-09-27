import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { Surface } from './Surface.tsx';

const base = {
  open: true,
  onOpenChange: vi.fn(),
  title: 'Settings',
  children: <p>Body content</p>,
};

describe('Surface', () => {
  it('renders as a centered modal by default', () => {
    render(<Surface {...base} />);
    expect(screen.getByTestId('surface').dataset.variant).toBe('modal');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders as a right drawer when as="drawer"', () => {
    render(<Surface {...base} as="drawer" />);
    expect(screen.getByTestId('surface').dataset.variant).toBe('drawer');
  });

  it('closes via the close button', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<Surface {...base} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has no accessibility violations', async () => {
    const { baseElement } = render(
      <Surface {...base} description="Manage your account" />,
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
