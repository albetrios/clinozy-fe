import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
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
    // The primary's key hint is decoration (aria-hidden), not its words.
    const wordsOf = (node: Element) => {
      const copy = node.cloneNode(true) as Element;
      for (const kbd of copy.querySelectorAll('[data-slot="kbd"]')) kbd.remove();
      return copy.textContent;
    };
    const order = [...footer.children].map(wordsOf);
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

  it('reads the screen’s own dismiss words when it has them ("Nothing next")', () => {
    renderFooter({ stacked: true, dismissLabel: 'Nothing next' });
    expect(screen.getByTestId('pt-dismiss')).toHaveTextContent('Nothing next');
  });

  it('carries the dismiss test id a drawer’s specs already name', () => {
    renderFooter({ dismissTestId: 'apikey-cancel' });
    expect(screen.getByTestId('apikey-cancel')).toHaveTextContent('Cancel');
    expect(screen.queryByTestId('pt-dismiss')).not.toBeInTheDocument();
  });

  it('carries it on the read-only "Close" too', () => {
    renderFooter({ readOnly: true, dismissTestId: 'history-close' });
    expect(screen.getByTestId('history-close')).toHaveTextContent('Close');
  });

  it('submits a form in place of onSave — and is that form’s default button', async () => {
    // A converted dialog keeps its `<form>`: the footer's primary submits it,
    // so the form's own validation and submit run, and Enter in any of its
    // fields saves in the browser (the default button is the first submit
    // button the form OWNS, wherever it sits).
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const onSave = vi.fn();
    render(
      <>
        <form id="role-form" aria-label="Role" onSubmit={onSubmit}>
          <input aria-label="Name" />
          <input aria-label="Description" />
        </form>
        <DrawerFooter
          testId="pt"
          onDismiss={vi.fn()}
          onSave={onSave}
          saveFormId="role-form"
          saveLabel="Create role"
        />
      </>,
    );

    const save = screen.getByTestId('pt-save');
    expect(save).toHaveAttribute('type', 'submit');
    expect(save).toHaveAttribute('form', 'role-form');
    const form = screen.getByRole('form', { name: 'Role' }) as HTMLFormElement;
    expect([...form.elements]).toContain(save);

    await user.click(save);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // The form's submit is the write — never both.
    expect(onSave).not.toHaveBeenCalled();
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

  it('while saving reads the screen’s own words when it has them ("Creating…")', () => {
    renderFooter({ saveState: 'saving', savingLabel: 'Creating…' });

    expect(screen.getByTestId('pt-save')).toHaveTextContent('Creating…');
    expect(screen.getByTestId('pt-save')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('pt-dismiss')).toBeDisabled();
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
