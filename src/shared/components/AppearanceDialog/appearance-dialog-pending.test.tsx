import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DRAWER_WIDTH_CLASS,
  resolveDrawerWidth,
} from '@/shared/components/RecordDrawer/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

const platformOverrides = vi.hoisted(() => ({ themeLock: false }));
vi.mock('@/core/config/env.ts', async (importOriginal) => {
  const actual = await importOriginal<{ platformConfig: Record<string, unknown> }>();
  return {
    ...actual,
    platformConfig: {
      ...actual.platformConfig,
      get themeLock() {
        return platformOverrides.themeLock;
      },
    },
  };
});

import {
  APPEARANCE_DRAWER_CONTENT,
  APPEARANCE_PENDING_WIDTH_CLASS,
} from './appearance-dialog.constants.ts';
import { AppearanceDialogPending } from './appearance-dialog-pending.tsx';

describe('AppearanceDialogPending — the drawer before its chunk', () => {
  beforeEach(() => {
    platformOverrides.themeLock = false;
  });

  it('draws the drawer’s own width — the class the record drawer resolves for the form', () => {
    // Spelled out on the entry chunk instead of importing the width table; this
    // is what keeps the placeholder and the drawer the same width.
    expect(APPEARANCE_PENDING_WIDTH_CLASS).toBe(
      DRAWER_WIDTH_CLASS[resolveDrawerWidth(APPEARANCE_DRAWER_CONTENT)],
    );
    render(<AppearanceDialogPending onClose={vi.fn()} />);
    expect(screen.getByTestId('appearance-dialog-pending').className).toContain(
      APPEARANCE_PENDING_WIDTH_CLASS,
    );
  });

  it('heads the cards it will show — the locked note’s in place of Mode under a theme lock', () => {
    const { unmount } = render(<AppearanceDialogPending onClose={vi.fn()} />);
    const cards = () =>
      within(screen.getByTestId('appearance-dialog-pending'))
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent);
    expect(cards()).toEqual(['Mode', 'Language', 'Date & time', 'Number format']);
    unmount();

    platformOverrides.themeLock = true;
    render(<AppearanceDialogPending onClose={vi.fn()} />);
    expect(cards()).toEqual(['Theme', 'Language', 'Date & time', 'Number format']);
  });

  it('closes from its backdrop', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AppearanceDialogPending onClose={onClose} />);

    await user.click(document.querySelector('[data-slot="sheet-overlay"]') as Element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { baseElement } = render(<AppearanceDialogPending onClose={vi.fn()} />);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
