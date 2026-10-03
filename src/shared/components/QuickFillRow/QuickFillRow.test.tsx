import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { type QuickFillItem, QuickFillRow } from './QuickFillRow.tsx';

const items = (onSelect = vi.fn()): QuickFillItem[] => [
  {
    id: 'single',
    label: 'Single session',
    tone: 'sage',
    description: 'One session',
    onSelect,
  },
  { id: 'consult', label: 'Consultation', onSelect },
];

describe('QuickFillRow', () => {
  it('labels the row "Quick fill" and names it as a group', () => {
    render(<QuickFillRow items={items()} testId="of" />);

    expect(screen.getByRole('group', { name: 'Quick fill' })).toBe(
      screen.getByTestId('of-quick-fill'),
    );
  });

  it('draws each preset as a dashed chip with the bolt icon', () => {
    render(<QuickFillRow items={items()} testId="of" />);

    const chip = screen.getByTestId('of-quick-fill-single');
    expect(chip).toHaveTextContent('Single session');
    expect(chip).toHaveClass('border-dashed', 'h-6', 'rounded-full');
    expect(chip).toHaveAttribute('data-slot', 'pill');
    expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(chip).toHaveAttribute('title', 'One session');
  });

  it('takes the preset’s tone — its fill, with its ink for the text and the dashed edge', () => {
    render(<QuickFillRow items={items()} testId="of" />);

    expect(screen.getByTestId('of-quick-fill-single')).toHaveClass(
      'bg-tone-sage',
      'text-tone-sage-foreground',
      'border-current',
    );
    expect(screen.getByTestId('of-quick-fill-consult')).toHaveClass(
      'bg-muted',
      'text-foreground',
      'border-current',
    );
  });

  it('runs the preset on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<QuickFillRow items={items(onSelect)} testId="of" />);

    await user.click(screen.getByTestId('of-quick-fill-consult'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders nothing without presets', () => {
    const { container } = render(<QuickFillRow items={[]} testId="of" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<QuickFillRow items={items()} testId="of" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
