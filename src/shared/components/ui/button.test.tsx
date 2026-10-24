import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, buttonVariants } from './button.tsx';

/** One base class: held, a button sinks to 97% — unless it is a text link. */
const PRESS = 'motion-safe:active:not-data-[variant=link]:scale-[0.97]';

describe('Button — the press (change-motion-polish)', () => {
  it.each([
    'default',
    'destructive',
    'danger',
    'outline',
    'secondary',
    'ghost',
    'link',
  ] as const)(
    'carries the press on a %s button, with the variant it is guarded by',
    (variant) => {
      expect(buttonVariants({ variant }).split(' ')).toContain(PRESS);
      render(<Button variant={variant}>Save</Button>);
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
        'data-variant',
        variant,
      );
    },
  );

  it('leaves a text link still — the press skips data-variant="link"', () => {
    expect(PRESS).toContain('not-data-[variant=link]:');
  });

  it('carries scale on its own transition, so the press eases back', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'transition-[color,background-color,border-color,box-shadow,scale]',
      PRESS,
    );
  });
});

describe('Button — busy', () => {
  it('draws the one loader before a label that stays as it is', () => {
    render(<Button isLoading>Send code</Button>);
    const button = screen.getByRole('button', { name: 'Send code' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.firstElementChild).toHaveAttribute('data-slot', 'spinner');
    // Working, not unavailable: aria-busy lifts the disabled dim.
    expect(button).toHaveClass('disabled:opacity-50', 'aria-busy:disabled:opacity-100');
  });

  it('draws no loader while idle', () => {
    render(<Button>Send code</Button>);
    expect(
      screen
        .getByRole('button', { name: 'Send code' })
        .querySelector('[data-slot="spinner"]'),
    ).toBeNull();
  });
});
