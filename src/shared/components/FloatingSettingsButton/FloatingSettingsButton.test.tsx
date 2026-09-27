import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setAppearanceOpenMock } = vi.hoisted(() => ({
  setAppearanceOpenMock: vi.fn(),
}));

vi.mock('@/shared/store/useUIStore/index.ts', () => ({
  useUIStore: (
    selector: (s: { setAppearanceOpen: (open: boolean) => void }) => unknown,
  ) => selector({ setAppearanceOpen: setAppearanceOpenMock }),
}));

import { FloatingSettingsButton } from './FloatingSettingsButton.tsx';

describe('FloatingSettingsButton', () => {
  beforeEach(() => {
    setAppearanceOpenMock.mockClear();
  });

  it('opens the appearance popup on click', () => {
    render(<FloatingSettingsButton />);
    screen.getByTestId('floating-settings').click();
    expect(setAppearanceOpenMock).toHaveBeenCalledWith(true);
  });
});
