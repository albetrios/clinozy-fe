import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PhotoSelectionBar } from './PhotoSelectionBar.tsx';

function renderBar(count: number) {
  const handlers = { onClear: vi.fn(), onCompare: vi.fn(), onDone: vi.fn() };
  const view = render(
    <PhotoSelectionBar
      count={count}
      comparable={count >= 2 && count <= 8}
      {...handlers}
    />,
  );
  return { ...view, ...handlers };
}

describe('PhotoSelectionBar', () => {
  it('counts the picks and compares two or more', async () => {
    const user = userEvent.setup();
    const { container, onCompare, onClear, onDone } = renderBar(3);
    expect(screen.getByTestId('patient-photos-selection-count')).toHaveTextContent(
      '3 selected',
    );
    expect(screen.getByText('Pick 2 to 8 photos to compare')).toBeInTheDocument();
    await user.click(screen.getByTestId('patient-photos-compare'));
    expect(onCompare).toHaveBeenCalled();
    await user.click(screen.getByTestId('patient-photos-selection-clear'));
    expect(onClear).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps Compare off below two and Clear off with none', () => {
    renderBar(1);
    expect(screen.getByTestId('patient-photos-compare')).toBeDisabled();
    renderBar(0);
    expect(screen.getAllByTestId('patient-photos-selection-clear')[1]).toBeDisabled();
  });
});
