import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PrintPreview } from './PrintPreview.tsx';

const { printMock, width } = vi.hoisted(() => ({
  printMock: vi.fn(() => Promise.resolve()),
  width: { current: 0 },
}));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  printDocument: printMock,
}));
vi.mock('@/shared/hooks/useElementWidth/index.ts', () => ({
  useElementWidth: () => [() => undefined, width.current],
}));

const SHEET = <section data-testid="sheet">Remark · Free first visit</section>;

function renderPreview(onClose = vi.fn()) {
  const view = renderWithProviders(
    <PrintPreview
      title="Invoice #787"
      sheet={SHEET}
      onClose={onClose}
      testId="invoice-preview"
    />,
  );
  return { ...view, onClose };
}

beforeEach(() => {
  printMock.mockClear();
  width.current = 0;
});

describe('PrintPreview (KICKOFF §6.6, §6.9; patient-file.md:301–315)', () => {
  it('heads the sheet with what it is, Close and Print / Save PDF — and prints that sheet', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPreview();
    const preview = await screen.findByTestId('invoice-preview');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Print preview · Invoice #787',
    );
    // Focus starts on the title, as on the record drawers (`_patterns.md:38`).
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveFocus());
    expect(await screen.findByTestId('sheet')).toHaveTextContent('Free first visit');
    expect(await axeForDialog(preview)).toHaveNoViolations();
    await user.click(screen.getByTestId('invoice-preview-print'));
    expect(printMock).toHaveBeenCalledWith(SHEET);
    await user.click(screen.getByTestId('invoice-preview-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fits the A4 sheet to the panel, never past its own size', async () => {
    width.current = 437;
    const { unmount } = renderPreview();
    await screen.findByTestId('invoice-preview');
    const frame = document.querySelector<HTMLElement>('[data-slot="print-preview"]');
    // (437 − 40) / 793.7px.
    expect(Number(frame?.style.getPropertyValue('--sheet-fit'))).toBeCloseTo(0.5, 2);
    unmount();

    width.current = 1400;
    renderPreview();
    await screen.findByTestId('invoice-preview');
    const wide = document.querySelector<HTMLElement>('[data-slot="print-preview"]');
    expect(wide?.style.getPropertyValue('--sheet-fit')).toBe('1');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPreview();
    await screen.findByTestId('sheet');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
