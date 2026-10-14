import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, buttonVariants } from './button.tsx';

const PRESS = 'motion-safe:active:scale-[0.97]';

describe('Button — the press (change-motion-polish)', () => {
  it.each(['default', 'destructive', 'danger', 'outline', 'secondary', 'ghost'] as const)(
    'sinks to 97%% while a %s button is held',
    (variant) => {
      expect(buttonVariants({ variant }).split(' ')).toContain(PRESS);
    },
  );

  it('leaves a text link still', () => {
    expect(buttonVariants({ variant: 'link' }).split(' ')).not.toContain(PRESS);
  });

  it('carries scale on its own transition, so the press eases back', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'transition-[color,background-color,border-color,box-shadow,scale]',
      PRESS,
    );
  });
});
