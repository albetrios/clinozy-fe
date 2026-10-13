import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ArrowDownLeft, ArrowUpRight } from '@/shared/icons/index.ts';

import { RoomPrimary } from './RoomPrimary.tsx';

const tier = vi.hoisted(() => ({ current: 'desktop' as 'phone' | 'tablet' | 'desktop' }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => tier.current,
}));

const withClient = (ui: ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const fab = () => document.querySelector<HTMLElement>('[data-slot="fab"]');

beforeEach(() => {
  tier.current = 'desktop';
});

describe('RoomPrimary — in the toolbar (md and up)', () => {
  it('is a 36px primary with Plus and "New <thing>"', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    withClient(
      <RoomPrimary
        action={{ id: 'new-patient', label: 'New patient', onSelect }}
        testIdPrefix="patients"
      />,
    );
    const primary = screen.getByRole('button', { name: 'New patient' });
    expect(primary).toBe(screen.getByTestId('patients-new-patient'));
    expect(primary.className).toContain('h-9');
    expect(primary.querySelector('svg')).not.toBeNull();
    await user.click(primary);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(fab()).toBeNull();
  });

  it('splits off a "⌄" segment listing the other create actions', async () => {
    const offer = vi.fn();
    const user = userEvent.setup();
    withClient(
      <RoomPrimary
        action={{ id: 'new-offering', label: 'New offering', onSelect: vi.fn() }}
        menu={{
          label: 'Create something else',
          actions: [
            { id: 'new-offer', label: 'New offer', onSelect: offer },
            { id: 'new-package', label: 'New package', onSelect: vi.fn() },
          ],
        }}
        testIdPrefix="offerings"
      />,
    );
    const chevron = screen.getByRole('button', { name: 'Create something else' });
    expect(chevron.className).toContain('w-8');
    await user.click(chevron);
    const list = await screen.findByTestId('offerings-new-menu-panel');
    await user.click(within(list).getByRole('option', { name: 'New offer' }));
    expect(offer).toHaveBeenCalledOnce();
  });

  it('names the split segment "More create actions" by default', () => {
    withClient(
      <RoomPrimary
        action={{ id: 'new-task', label: 'New task', onSelect: vi.fn() }}
        menu={{ actions: [{ id: 'new-rule', label: 'New rule', onSelect: vi.fn() }] }}
        testIdPrefix="tasks"
      />,
    );
    expect(
      screen.getByRole('button', { name: 'More create actions' }),
    ).toBeInTheDocument();
  });

  it('pairs an outline action before the primary (Payments)', () => {
    withClient(
      <RoomPrimary
        secondary={{ id: 'pay', label: 'Pay', icon: ArrowUpRight, onSelect: vi.fn() }}
        action={{
          id: 'receive',
          label: 'Receive',
          icon: ArrowDownLeft,
          onSelect: vi.fn(),
        }}
        testIdPrefix="payments"
      />,
    );
    const [pay, receive] = screen.getAllByRole('button');
    expect(pay).toHaveAccessibleName('Pay');
    expect(pay).toHaveAttribute('data-variant', 'outline');
    expect(receive).toHaveAccessibleName('Receive');
  });

  it('carries each action’s title and its icon’s own ink (Payments’ red Pay arrow)', () => {
    withClient(
      <RoomPrimary
        secondary={{
          id: 'pay',
          label: 'Pay',
          title: 'Pay · money out',
          icon: ArrowUpRight,
          iconClassName: 'text-destructive',
          onSelect: vi.fn(),
        }}
        action={{
          id: 'receive',
          label: 'Receive',
          title: 'Receive · money in',
          onSelect: vi.fn(),
        }}
        testIdPrefix="payments"
      />,
    );
    const pay = screen.getByTestId('payments-pay');
    expect(pay).toHaveAttribute('title', 'Pay · money out');
    expect(pay.querySelector('svg')).toHaveClass('text-destructive');
    expect(screen.getByTestId('payments-receive')).toHaveAttribute(
      'title',
      'Receive · money in',
    );
  });

  it('gives the create menu’s rows their sub line and tone', async () => {
    const user = userEvent.setup();
    withClient(
      <RoomPrimary
        action={{ id: 'add', label: 'Add pending', onSelect: vi.fn() }}
        menu={{
          actions: [
            {
              id: 'give',
              label: 'Give',
              sub: 'We pay a patient or party back',
              tone: 'blush',
              onSelect: vi.fn(),
            },
          ],
        }}
        testIdPrefix="payments-pending"
      />,
    );
    await user.click(screen.getByTestId('payments-pending-new-menu'));
    const option = await screen.findByRole('option', { name: /Give/ });
    expect(option).toHaveTextContent('We pay a patient or party back');
  });

  it('has no accessibility violations', async () => {
    const { container } = withClient(
      <RoomPrimary
        action={{ id: 'new-medicine', label: 'New medicine', onSelect: vi.fn() }}
        menu={{ actions: [{ id: 'new-sale', label: 'New sale', onSelect: vi.fn() }] }}
        testIdPrefix="medical"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('RoomPrimary — the floating "New" (phone)', () => {
  it('leaves the toolbar for a 52px pill fixed above the bottom stack', () => {
    tier.current = 'phone';
    const { container } = withClient(
      <RoomPrimary
        action={{ id: 'new-patient', label: 'New patient', onSelect: vi.fn() }}
        testIdPrefix="patients"
      />,
    );
    expect(container).toBeEmptyDOMElement();
    const floating = fab();
    expect(floating).not.toBeNull();
    expect(floating?.parentElement).toBe(document.body);
    expect(floating).toHaveAttribute('data-testid', 'patients-fab');
    expect(floating?.className).toContain('fixed');
    expect(floating?.className).toContain('end-4');
    expect(floating?.className).toContain(
      'bottom-[calc(var(--floating-bottom-offset,0rem)+1rem+env(safe-area-inset-bottom,0rem)+var(--floating-notice-height,0rem))]',
    );
    const pill = within(floating as HTMLElement).getByRole('button', {
      name: 'New patient',
    });
    expect(pill).toHaveAttribute('data-slot', 'pill');
    expect(pill.className).toContain('h-13');
    expect(pill.className).toContain('rounded-full');
    expect(pill.className).toContain('shadow-(--elevation-fab)');
  });

  it('publishes its height through the bottom-stack contract while mounted', () => {
    tier.current = 'phone';
    const fabRule = ":root:has([data-slot='fab'])";
    const { unmount } = withClient(
      <RoomPrimary
        action={{ id: 'new-lead', label: 'New lead', onSelect: vi.fn() }}
        testIdPrefix="leads"
      />,
    );
    // index.css sets --floating-fab-height under this selector (bottom-stack-css.test.ts).
    expect(document.documentElement.matches(fabRule)).toBe(true);
    unmount();
    expect(document.documentElement.matches(fabRule)).toBe(false);
  });

  it('floats split and paired actions side by side, the chevron at least 44px wide', () => {
    tier.current = 'phone';
    withClient(
      <RoomPrimary
        secondary={{ id: 'pay', label: 'Pay', onSelect: vi.fn() }}
        action={{ id: 'receive', label: 'Receive', onSelect: vi.fn() }}
        menu={{ actions: [{ id: 'refund', label: 'Refund', onSelect: vi.fn() }] }}
        testIdPrefix="payments"
      />,
    );
    const floating = fab() as HTMLElement;
    expect(floating.className).toContain('gap-2');
    const pills = within(floating).getAllByRole('button');
    expect(
      pills.map((pill) => pill.getAttribute('aria-label') ?? pill.textContent),
    ).toEqual(['Pay', 'Receive', 'More create actions']);
    for (const pill of pills) expect(pill).toHaveAttribute('data-slot', 'pill');
    expect(pills[2]?.className).toContain('min-w-11');
  });
});
