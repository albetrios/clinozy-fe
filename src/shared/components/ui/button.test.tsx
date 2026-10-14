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
