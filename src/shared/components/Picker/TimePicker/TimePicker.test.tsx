import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { TimePicker } from './TimePicker.tsx';

const tier = vi.hoisted(() => ({ current: 'desktop' as 'phone' | 'tablet' | 'desktop' }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => tier.current,
}));

function Controlled({
  initial = null,
  onPick = () => {},
}: {
  initial?: string | null;
  onPick?: (time: string) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <TimePicker
      label="From"
      value={value}
      onChange={(time) => {
        setValue(time);
        onPick(time);
      }}
    />
  );
}

beforeEach(() => {
  tier.current = 'desktop';
});

describe('TimePicker', () => {
  it('shows "Pick a time" with a clock glyph until a time is picked', () => {
    render(<Controlled />);
    const trigger = screen.getByTestId('time-picker');
    expect(trigger).toHaveTextContent('Pick a time');
    expect(trigger).toHaveAccessibleName('From · Pick a time');
    expect(trigger.querySelector('svg')).not.toBeNull();
  });

  it('opens 36 tiles from 06:00 to 23:30 in a 220px grid, focused on the pick', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="10:00" />);
    expect(screen.getByTestId('time-picker')).toHaveAccessibleName('From · 10:00');
    await user.click(screen.getByTestId('time-picker'));
    const panel = await screen.findByTestId('time-picker-panel');
    expect(panel.className).toContain('min-w-55');
    expect(panel.querySelector('.max-h-55')).not.toBeNull();
    const tiles = screen.getAllByRole('radio');
    expect(tiles).toHaveLength(36);
    expect(tiles[0]).toHaveTextContent('06:00');
    expect(tiles.at(-1)).toHaveTextContent('23:30');
    const picked = screen.getByTestId('time-picker-option-10:00');
    expect(picked).toHaveAttribute('data-state', 'on');
    await waitFor(() => expect(picked).toHaveFocus());
  });

  it('picks a tile and closes; arrow keys move between tiles', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<Controlled initial="10:00" onPick={onPick} />);
    await user.click(screen.getByTestId('time-picker'));
    await screen.findByTestId('time-picker-panel');
    await waitFor(() =>
      expect(screen.getByTestId('time-picker-option-10:00')).toHaveFocus(),
    );
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('time-picker-option-10:30')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('10:30');
    await waitFor(() =>
      expect(screen.queryByTestId('time-picker-panel')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('time-picker')).toHaveTextContent('10:30');
  });

  it('closes without a change when the picked tile is pressed again', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<Controlled initial="10:00" onPick={onPick} />);
    await user.click(screen.getByTestId('time-picker'));
    await user.click(await screen.findByTestId('time-picker-option-10:00'));
    await waitFor(() =>
      expect(screen.queryByTestId('time-picker-panel')).not.toBeInTheDocument(),
    );
    expect(onPick).not.toHaveBeenCalled();
  });

  it('opens the picker sheet on a phone', async () => {
    tier.current = 'phone';
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByTestId('time-picker'));
    expect(await screen.findByTestId('time-picker-panel')).toHaveAttribute(
      'data-picker-surface',
      'sheet',
    );
  });

  it('has no accessibility violations while open', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<Controlled initial="10:00" />);
    await user.click(screen.getByTestId('time-picker'));
    await screen.findByTestId('time-picker-panel');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
