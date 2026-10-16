import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Switch } from './switch.tsx';

describe('Switch — its motion (change-motion-polish)', () => {
  it('animates the track’s colour and ring, never `all`', () => {
    render(<Switch aria-label="Reminders" />);
    const track = screen.getByRole('switch', { name: 'Reminders' });
    expect(track).toHaveClass('transition-[background-color,box-shadow]');
    expect(track).not.toHaveClass('transition-all');
  });

  it('moves the thumb by its transform (timed by switch.css)', () => {
    render(<Switch aria-label="Reminders" defaultChecked />);
    const thumb = screen
      .getByRole('switch', { name: 'Reminders' })
      .querySelector('[data-slot="switch-thumb"]');
    expect(thumb).toHaveClass('transition-transform');
  });
});
