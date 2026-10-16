import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './checkbox.tsx';

describe('Checkbox — its tick (change-motion-polish)', () => {
  it('mounts the tick only while checked, so it pops in on each check', () => {
    const { rerender } = render(<Checkbox aria-label="Select row" checked={false} />);
    const box = screen.getByRole('checkbox', { name: 'Select row' });
    expect(box.querySelector('[data-slot="checkbox-indicator"]')).toBeNull();
    rerender(<Checkbox aria-label="Select row" checked />);
    expect(box.querySelector('[data-slot="checkbox-indicator"]')).not.toBeNull();
  });
});
