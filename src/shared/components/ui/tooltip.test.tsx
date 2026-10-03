import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip.tsx';

function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <TooltipProvider>
      <Tooltip onOpenChange={onOpenChange}>
        <TooltipTrigger aria-label="Call">☎</TooltipTrigger>
        <TooltipContent>Call</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** The visible bubble (Radix also renders a visually hidden `role="tooltip"` copy). */
const bubble = () => document.querySelector('[data-slot="tooltip-content"]');

afterEach(() => {
  vi.useRealTimers();
});

describe('Tooltip', () => {
  it('shows 160ms after hover, not before', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.hover(screen.getByRole('button', { name: 'Call' }));
    expect(bubble()).toBeNull();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Call');
    expect(bubble()).not.toBeNull();
  });

  it('draws the design bubble and never shows below md', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.hover(screen.getByRole('button', { name: 'Call' }));
    await screen.findByRole('tooltip');

    const content = bubble();
    // The phone never shows a tooltip (H:94): the class hides it below `md`.
    expect(content).toHaveClass('max-md:hidden');
    expect(content).toHaveClass('bg-primary', 'text-primary-foreground', 'text-caption');
    expect(content).toHaveClass('rounded-md', 'whitespace-nowrap', 'font-medium');
  });

  it('shows on a touch press and hides 1,400ms later', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Call' });

    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    expect(bubble()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1399);
    });
    expect(bubble()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(bubble()).toBeNull();
  });

  it('ignores a mouse press', () => {
    render(<Harness />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Call' }), {
      pointerType: 'mouse',
    });
    expect(bubble()).toBeNull();
  });

  it.each([
    ['the wheel', () => fireEvent.wheel(document)],
    ['a key press', () => fireEvent.keyDown(document, { key: 'a' })],
  ])('hides on %s', (_name, dismiss) => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Call' }), {
      pointerType: 'touch',
    });
    expect(bubble()).not.toBeNull();

    act(dismiss);

    expect(bubble()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('follows a controlled open prop', () => {
    const { rerender } = render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Info</TooltipTrigger>
          <TooltipContent>Details</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(bubble()).not.toBeNull();

    rerender(
      <TooltipProvider>
        <Tooltip open={false}>
          <TooltipTrigger>Info</TooltipTrigger>
          <TooltipContent>Details</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(bubble()).toBeNull();
  });

  it('has no accessibility violations while shown', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<Harness />);
    await user.hover(screen.getByRole('button', { name: 'Call' }));
    await screen.findByRole('tooltip');

    // `region` judges page structure (landmarks), which a bare test page lacks;
    // the bubble portals to <body> next to it.
    expect(
      await axe(baseElement, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
