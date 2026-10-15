import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PinAreaChips } from './PinAreaChips.tsx';

const place = (areas: string[]) => ({
  pin: '395007',
  district: 'Surat',
  state: 'Gujarat',
  areas,
});

describe('PinAreaChips', () => {
  it('says an unknown PIN in words', () => {
    render(<PinAreaChips place={null} area="" onAreaChange={vi.fn()} testId="branch" />);
    expect(screen.getByTestId('branch-pin-unknown')).toHaveTextContent(
      "We don't know this PIN",
    );
  });

  it('offers a chip per area and picks one', async () => {
    const onAreaChange = vi.fn();
    const { container } = render(
      <PinAreaChips
        place={place(['Vesu', 'Piplod'])}
        area="Vesu"
        onAreaChange={onAreaChange}
        testId="branch"
      />,
    );
    expect(screen.getByText('Pick your area')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('branch-area-pick-Piplod'));
    expect(onAreaChange).toHaveBeenCalledWith('Piplod');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws nothing before six digits, or for a PIN with one area', () => {
    const { container, rerender } = render(
      <PinAreaChips place={undefined} area="" onAreaChange={vi.fn()} testId="branch" />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <PinAreaChips
        place={place(['Vesu'])}
        area=""
        onAreaChange={vi.fn()}
        testId="branch"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
