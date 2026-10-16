import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Drawer, DrawerContent, DrawerTitle } from './drawer.tsx';

describe('Drawer (bottom sheet)', () => {
  it('rises in on the sheet curve with its scrim and leaves at once — in the primitive', () => {
    render(
      <Drawer open>
        <DrawerContent data-testid="sheet" aria-describedby={undefined}>
          <DrawerTitle>Sheet</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );
    const sheet = screen.getByTestId('sheet');
    // `!`: vaul's own unlayered 500ms slide would win otherwise (feat-payment-celebration D14).
    expect(sheet.className).toContain('data-[state=open]:animate-sheet-up!');
    expect(sheet.className).toContain('data-[state=closed]:animate-none!');
    const scrim = document.querySelector('[data-slot="drawer-overlay"]');
    expect(scrim?.className).toContain('data-[state=open]:animate-backdrop-in!');
    expect(scrim?.className).toContain('data-[state=closed]:animate-none!');
  });
});
