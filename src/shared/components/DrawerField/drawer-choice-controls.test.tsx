import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';

import { DrawerInfo, DrawerSwatches, DrawerToggle } from './drawer-choice-controls.tsx';

describe('DrawerSwatches (H:1600)', () => {
  it('picks one colour by name, marking it "✓" with a ring', async () => {
    const user = userEvent.setup();
    function Colours() {
      const [tone, setTone] = useState<Tone>('sage');
      return (
        <DrawerSwatches
          label="Colour"
          tones={['lav', 'sage']}
          value={tone}
          onChange={setTone}
          testId="colour"
        />
      );
    }
    const { container } = render(<Colours />);
    const group = screen.getByRole('radiogroup', { name: 'Colour' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sage' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Sage' })).toHaveAttribute('title', 'Sage');
    expect(screen.getByTestId('colour-sage')).toHaveTextContent('✓');
    await user.click(screen.getByRole('radio', { name: 'Lavender' }));
    expect(screen.getByRole('radio', { name: 'Lavender' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('colour-sage')).toHaveTextContent('');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DrawerSwatches — a mark', () => {
  it('shows the screen’s mark on the picked swatch, "✓" without one', () => {
    const { rerender } = render(
      <DrawerSwatches
        label="Colour"
        tones={['sky']}
        value="sky"
        onChange={vi.fn()}
        mark="RS"
        testId="colour"
      />,
    );
    expect(screen.getByTestId('colour-sky')).toHaveTextContent('RS');
    rerender(
      <DrawerSwatches
        label="Colour"
        tones={['sky']}
        value="sky"
        onChange={vi.fn()}
        mark=""
        testId="colour"
      />,
    );
    expect(screen.getByTestId('colour-sky')).toHaveTextContent('✓');
  });
});

describe('DrawerToggle (H:1601)', () => {
  it('is a switch that says its state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Gst() {
      const [checked, setChecked] = useState(false);
      return (
        <DrawerToggle
          aria-label="GST"
          checked={checked}
          onCheckedChange={(next) => {
            setChecked(next);
            onChange(next);
          }}
          onLabel="Inclusive"
          offLabel="Exclusive"
        />
      );
    }
    const { container } = render(<Gst />);
    const toggle = screen.getByRole('switch', { name: 'GST' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('Exclusive');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveTextContent('Inclusive');
    expect(onChange).toHaveBeenCalledWith(true);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DrawerInfo (H:1596)', () => {
  it('shows a read-only value', () => {
    render(<DrawerInfo testId="billed">₹7,500 · 17% below list</DrawerInfo>);
    expect(screen.getByTestId('billed')).toHaveTextContent('₹7,500 · 17% below list');
  });
});
