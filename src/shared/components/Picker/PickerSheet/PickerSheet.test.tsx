import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { PickerSheet, type PickerSheetProps } from './PickerSheet.tsx';

const tier = vi.hoisted(() => ({ current: 'desktop' as 'phone' | 'tablet' | 'desktop' }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => tier.current,
}));

function Harness(props: Partial<PickerSheetProps>) {
  const [open, setOpen] = useState(false);
  return (
    <PickerSheet
      open={open}
      onOpenChange={setOpen}
      title="Doctor"
      testId="sheet"
      trigger={<button type="button">Open</button>}
      {...props}
    >
      <button type="button">Inside</button>
    </PickerSheet>
  );
}

beforeEach(() => {
  tier.current = 'desktop';
});

describe('PickerSheet', () => {
  it('is a popover from md up, named by its title, 6px below the trigger', async () => {
    tier.current = 'tablet';
    const user = userEvent.setup();
    render(<Harness panelClassName="min-w-60" />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const panel = await screen.findByTestId('sheet');
    expect(panel).toHaveAttribute('data-picker-surface', 'popover');
    expect(panel).toHaveAttribute('role', 'dialog');
    expect(panel).toHaveAttribute('aria-label', 'Doctor');
    expect(panel.className).toContain('min-w-60');
    expect(panel.className).toContain(
      'data-[state=open]:data-[side=top]:animate-dropdown-up',
    );
  });

  it('is the bottom sheet on a phone: sr-only title, dimmed layer, no handle', async () => {
    tier.current = 'phone';
    const user = userEvent.setup();
    const { baseElement } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const sheet = await screen.findByTestId('sheet');
    expect(sheet).toHaveAttribute('data-picker-surface', 'sheet');
    expect(screen.getByRole('dialog', { name: 'Doctor' })).toBe(sheet);
    expect(screen.getByText('Doctor')).toHaveClass('sr-only');
    expect(sheet.querySelector('[data-slot="pill"]')).toBeNull();
    expect(document.querySelector('[data-slot="drawer-overlay"]')?.className).toContain(
      'bg-overlay/40',
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('hands focus placement and Esc to the caller, and closes on Esc', async () => {
    const onOpenAutoFocus = vi.fn();
    const onEscapeKeyDown = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness onOpenAutoFocus={onOpenAutoFocus} onEscapeKeyDown={onEscapeKeyDown} />,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByTestId('sheet');
    await waitFor(() => expect(onOpenAutoFocus).toHaveBeenCalled());
    expect(onOpenAutoFocus.mock.calls[0]?.[0].defaultPrevented).toBe(true);

    await user.keyboard('{Escape}');
    expect(onEscapeKeyDown).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('sheet')).not.toBeInTheDocument());
  });

  it('merges key handling onto the trigger', async () => {
    const onTriggerKeyDown = vi.fn();
    const user = userEvent.setup();
    render(<Harness onTriggerKeyDown={onTriggerKeyDown} />);
    screen.getByRole('button', { name: 'Open' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(onTriggerKeyDown).toHaveBeenCalled();
  });
});
