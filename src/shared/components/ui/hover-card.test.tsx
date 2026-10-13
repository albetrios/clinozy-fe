import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card.tsx';

/** A delay no other timer in the run uses, so the open's timers can be told apart. */
const OPEN_DELAY_MS = 37;

function Harness() {
  return (
    <HoverCard openDelay={OPEN_DELAY_MS} closeDelay={0}>
      <HoverCardTrigger asChild>
        <button type="button">Meera Iyer</button>
      </HoverCardTrigger>
      <HoverCardContent data-testid="card">Meera Iyer · 10:30</HoverCardContent>
    </HoverCard>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Meera Iyer' });
/** Real time passing — longer than the open delay. */
const pastTheOpenDelay = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, OPEN_DELAY_MS * 3)));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HoverCardTrigger', () => {
  it('opens on hover', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.hover(trigger());
    expect(await screen.findByTestId('card')).toHaveTextContent('Meera Iyer · 10:30');
  });

  it('opens on keyboard focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(trigger()).toHaveFocus();
    expect(await screen.findByTestId('card')).toBeInTheDocument();
  });

  it('schedules the open once for a click: the focus a press gives does not ask again', async () => {
    const timers = vi.spyOn(window, 'setTimeout');
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    expect(timers.mock.calls.filter(([, delay]) => delay === OPEN_DELAY_MS)).toHaveLength(
      1,
    );
  });

  it('stays closed when the pointer leaves right after a click — no open outlives the leave', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.unhover(trigger());
    await pastTheOpenDelay();
    expect(screen.queryByTestId('card')).not.toBeInTheDocument();
  });
});
