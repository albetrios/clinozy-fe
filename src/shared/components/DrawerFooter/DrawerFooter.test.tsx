import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

import { DrawerFooter, type DrawerFooterProps } from './DrawerFooter.tsx';

function renderFooter(props: Partial<DrawerFooterProps> = {}) {
  const handlers = {
    onDismiss: vi.fn(),
    onSave: vi.fn(),
    onSaveAndAdd: vi.fn(),
    onDelete: vi.fn(),
  };
  const view = render(
    <DrawerFooter
      testId="pt"
      summary="Priya Shah · Aesthetic"
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('DrawerFooter', () => {
  it('lays out summary · Delete · Cancel · Save & add another · Save', () => {
    renderFooter();

    const footer = screen.getByTestId('pt-footer');
    const order = [...footer.children].map((node) => node.textContent);
    expect(order).toEqual([
      'Priya Shah · Aesthetic',
      'Delete',
      'Cancel',
      'Save & add another',
      'Save',
    ]);
  });

  it('labels the primary with the screen’s own action', () => {
    renderFooter({
      saveLabel: 'Create patient',
      saveAndAddLabel: 'Create & add another',
    });

    expect(screen.getByTestId('pt-save')).toHaveTextContent('Create patient');
    expect(screen.getByTestId('pt-save-and-add')).toHaveTextContent(
      'Create & add another',
    );
  });

  it('wires every button to its handler', async () => {
    const user = userEvent.setup();
    const { onDismiss, onSave, onSaveAndAdd, onDelete } = renderFooter();

    await user.click(screen.getByTestId('pt-dismiss'));
    await user.click(screen.getByTestId('pt-save'));
    await user.click(screen.getByTestId('pt-save-and-add'));
    await user.click(screen.getByTestId('pt-delete'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSaveAndAdd).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('offers Delete only when the record can be deleted', () => {
    renderFooter({ onDelete: undefined });
    expect(screen.queryByTestId('pt-delete')).not.toBeInTheDocument();
  });

  it('reads "Back" in a stacked child drawer', () => {
    renderFooter({ stacked: true });
    expect(screen.getByTestId('pt-dismiss')).toHaveTextContent('Back');
  });

  it('is view only when read-only: "Close" and the role note, nothing to save or delete', () => {
    renderFooter({ readOnly: true });

    expect(screen.getByTestId('pt-dismiss')).toHaveTextContent('Close');
    expect(screen.getByTestId('pt-summary')).toHaveTextContent(
      'View only · your role can’t change this',
    );
    expect(screen.queryByTestId('pt-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pt-save-and-add')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pt-delete')).not.toBeInTheDocument();
  });

  it('after a failed save reads "Retry save" beside "Not saved · your changes are kept"', () => {
    renderFooter({ saveState: 'failed' });

    expect(screen.getByTestId('pt-save')).toHaveTextContent('Retry save');
    expect(screen.getByTestId('pt-save')).toBeEnabled();
    const note = screen.getByRole('alert');
    expect(note).toHaveTextContent('Not saved · your changes are kept');
    expect(note.querySelector('[aria-hidden="true"]')).toHaveClass(
      'size-1.5',
      'bg-destructive',
    );
  });

  it('while saving reads "Saving…" and holds every exit', () => {
    renderFooter({ saveState: 'saving' });

    expect(screen.getByTestId('pt-save')).toHaveTextContent('Saving…');
    expect(screen.getByTestId('pt-save')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('pt-save')).toBeDisabled();
    expect(screen.getByTestId('pt-dismiss')).toBeDisabled();
    expect(screen.getByTestId('pt-save-and-add')).toBeDisabled();
    expect(screen.getByTestId('pt-delete')).toBeDisabled();
  });

  describe('on a phone', () => {
    beforeEach(() => {
      viewport.tier = 'phone';
    });

    it('does not offer "Save & add another"', () => {
      renderFooter();
      expect(screen.queryByTestId('pt-save-and-add')).not.toBeInTheDocument();
    });

    it('wraps: 44px buttons share the row, the summary drops to its own last row', () => {
      renderFooter();

      expect(screen.getByTestId('pt-footer')).toHaveClass('flex-wrap', 'md:flex-nowrap');
      for (const id of ['pt-delete', 'pt-dismiss', 'pt-save']) {
        expect(screen.getByTestId(id)).toHaveClass(
          'max-md:h-11',
          'max-md:flex-auto',
          'max-md:px-3',
        );
      }
      expect(screen.getByTestId('pt-summary')).toHaveClass(
        'max-md:order-last',
        'max-md:basis-full',
        'max-md:text-center',
        'max-md:empty:hidden',
      );
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderFooter({ saveState: 'failed' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
