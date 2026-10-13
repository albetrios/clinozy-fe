import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { TextCell } from './TextCell.tsx';

describe('TextCell', () => {
  it('draws a two-line cell with a toned sub line', async () => {
    const { container } = render(
      <TextCell text="Glycolac Cream" sub="Needs MRP and composition" subTone="butter" />,
    );
    expect(screen.getByText('Needs MRP and composition')).toHaveClass(
      'text-tone-butter-foreground',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('isolates each line in its own direction (a phone on a right-to-left page)', () => {
    render(<TextCell text="Ankur Pharma" sub="+91 98250 44120" />);
    for (const line of [
      screen.getByText('Ankur Pharma'),
      screen.getByText('+91 98250 44120'),
    ]) {
      expect(line).toHaveAttribute('dir', 'auto');
      expect(line).toHaveClass('[text-align:match-parent]');
    }
  });

  it('aligns an amount to the inline end in its weight', () => {
    render(
      <TextCell text="₹1,200" sub="− ₹239 returned" weight="semibold" align="end" />,
    );
    expect(screen.getByText('₹1,200')).toHaveClass('font-semibold');
    expect(screen.getByText('− ₹239 returned')).toHaveClass('text-muted-foreground');
  });
});
