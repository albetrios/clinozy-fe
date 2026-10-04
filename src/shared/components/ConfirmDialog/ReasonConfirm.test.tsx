import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

const { viewport } = vi.hoisted(() => ({
  viewport: { tier: 'desktop' as ViewportTier },
}));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

import {
  clinicHttpError,
  createFixtureCollection,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import { AppToaster, notify } from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { CONFIRM_TEST_IDS, confirmReasonTestId } from './confirm-dialog.constants.ts';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog.tsx';
import { REASON_CONFIRM_KEYS } from './reason-confirm.constants.ts';
import type { ConfirmReasonConfig, ReasonConfirmProps } from './ReasonConfirm.tsx';

const RECORD = 'Priya Shah · #2363';

function renderReason(
  overrides: Partial<Omit<ConfirmDialogProps, 'reason'>> & {
    reason?: ConfirmReasonConfig;
  } = {},
) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const props = {
    open: true,
    onOpenChange,
    title: 'Delete this patient?',
    reason: { record: RECORD },
    onConfirm,
    ...overrides,
  } as ConfirmDialogProps;
  const view = render(<ConfirmDialog {...props} />);
  return { ...view, onOpenChange, onConfirm, props };
}

const dialog = () => screen.getByTestId(CONFIRM_TEST_IDS.dialog);
const action = () => screen.getByTestId(CONFIRM_TEST_IDS.accept);
const hint = () => screen.getByTestId(CONFIRM_TEST_IDS.hint);

/** A caller that really closes the confirm, as every room does. */
function ClosingConfirm(props: Omit<ReasonConfirmProps, 'open' | 'onOpenChange'>) {
  const [open, setOpen] = useState(true);
  return <ConfirmDialog {...props} open={open} onOpenChange={setOpen} />;
}

/**
 * Wait until Sonner hosts the toast reading `text`. The first toast shows in
 * the immediate host while the renderer's lazy import lands, and the handoff
 * replaces that node — anything held from before it is detached.
 */
async function sonnerToast(text: string) {
  await waitFor(
    () => expect(screen.getByText(text).closest('[data-sonner-toast]')).not.toBeNull(),
    { timeout: 5000 },
  );
}

/** Press Undo on the Sonner-hosted toast reading `text`. */
async function clickUndo(user: ReturnType<typeof userEvent.setup>, text: string) {
  await sonnerToast(text);
  expect(screen.getByTestId('toast-action')).toHaveTextContent('Undo');
  await user.click(screen.getByTestId('toast-action'));
}

beforeEach(() => {
  viewport.tier = 'desktop';
});
afterEach(() => {
  act(() => {
    notify.dismiss();
  });
});

describe('ConfirmDialog — reason variant', () => {
  it.each(['desktop', 'tablet'] as const)(
    'opens as the end panel on %s: title, record pill and the effect line',
    (tier) => {
      viewport.tier = tier;
      renderReason();

      expect(dialog()).toHaveAttribute('role', 'alertdialog');
      expect(dialog()).toHaveAttribute('data-layout', 'panel');
      expect(screen.getByRole('alertdialog', { name: 'Delete this patient?' })).toBe(
        dialog(),
      );
      expect(screen.getByTestId(CONFIRM_TEST_IDS.record)).toHaveTextContent(RECORD);
      // Record and effect are the description, so a screen reader hears both.
      expect(dialog()).toHaveAccessibleDescription(
        `${RECORD}It disappears from lists and pickers. You can undo from the toast right after.`,
      );
      expect(screen.getByTestId(CONFIRM_TEST_IDS.close)).toHaveAccessibleName('Close');
    },
  );

  it('opens as a bottom sheet on a phone', () => {
    viewport.tier = 'phone';
    renderReason();

    expect(dialog()).toHaveAttribute('role', 'alertdialog');
    expect(dialog()).toHaveAttribute('data-layout', 'sheet');
    expect(dialog()).toHaveAttribute('data-vaul-drawer-direction', 'bottom');
    expect(screen.getByRole('alertdialog', { name: 'Delete this patient?' })).toBe(
      dialog(),
    );
    expect(screen.getByTestId(CONFIRM_TEST_IDS.record)).toHaveTextContent(RECORD);
  });

  it.each(['desktop', 'phone'] as const)('starts on "Keep it" (%s)', async (tier) => {
    viewport.tier = tier;
    renderReason();

    await waitFor(() =>
      expect(screen.getByTestId(CONFIRM_TEST_IDS.cancel)).toHaveFocus(),
    );
    expect(screen.getByTestId(CONFIRM_TEST_IDS.cancel)).toHaveTextContent('Keep it');
  });

  it.each(['desktop', 'tablet', 'phone'] as const)(
    'Esc means "Keep it" on %s — nothing is deleted',
    async (tier) => {
      viewport.tier = tier;
      const user = userEvent.setup();
      const { onOpenChange, onConfirm } = renderReason();
      await user.click(screen.getByTestId(confirmReasonTestId('duplicate')));

      await user.keyboard('{Escape}');

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onConfirm).not.toHaveBeenCalled();
    },
  );

  it('the backdrop, the × and "Keep it" keep the record too', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onConfirm } = renderReason();

    const overlay = document.querySelector('[data-slot="alert-dialog-overlay"]');
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);
    await user.click(screen.getByTestId(CONFIRM_TEST_IDS.close));
    await user.click(screen.getByTestId(CONFIRM_TEST_IDS.cancel));

    expect(onOpenChange).toHaveBeenCalledTimes(3);
    expect(onOpenChange.mock.calls.every(([open]) => open === false)).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('needs a reason: the action stays aria-disabled and the hint says why', async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderReason();

    expect(screen.getByRole('radiogroup', { name: 'Reason' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Created by mistake',
      'Duplicate',
      'No longer needed',
      'Other',
    ]);
    expect(action()).toHaveTextContent('Delete');
    expect(action()).toHaveAttribute('aria-disabled', 'true');
    expect(hint()).toHaveTextContent('Pick a reason to continue');
    expect(action()).toHaveAccessibleDescription('Pick a reason to continue');

    await user.click(action());
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(confirmReasonTestId('duplicate')));
    expect(screen.getByRole('radio', { name: 'Duplicate' })).toBeChecked();
    expect(action()).not.toHaveAttribute('aria-disabled');
    expect(hint()).toBeEmptyDOMElement();

    await user.click(action());
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
        reason: 'duplicate',
        note: null,
        picked: { value: 'duplicate', label: 'Duplicate' },
        comment: '',
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('"Other" needs a note before the action is allowed', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderReason();
    const note = screen.getByTestId(CONFIRM_TEST_IDS.note);
    expect(note).toHaveAccessibleName('Note');
    expect(note).toHaveAttribute('placeholder', 'Add a note (optional)');
    expect(note).toHaveAttribute('maxlength', '160');

    await user.click(screen.getByTestId(confirmReasonTestId('other')));

    expect(note).toHaveAttribute('placeholder', 'Tell the team why (required)');
    expect(note).toBeRequired();
    expect(hint()).toHaveTextContent('Add a short note for “Other”');
    expect(action()).toHaveAttribute('aria-disabled', 'true');
    await user.click(action());
    expect(onConfirm).not.toHaveBeenCalled();

    // Whitespace is not a note.
    await user.type(note, '   ');
    expect(action()).toHaveAttribute('aria-disabled', 'true');

    await user.type(note, 'Booked under the wrong name');
    expect(hint()).toBeEmptyDOMElement();
    await user.click(action());
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'other', note: 'Booked under the wrong name' }),
      ),
    );
  });

  it('stores a reason the schema lacks as "other" with its label in the note', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderReason({
      title: 'Cancel this purchase order?',
      reason: { kind: 'cancel', record: 'PO-218' },
    });
    expect(action()).toHaveTextContent('Cancel order');
    expect(dialog()).toHaveAccessibleDescription(
      'PO-218The order stops here. Stock and supplier dues are not changed.',
    );

    await user.click(screen.getByRole('radio', { name: 'Price changed' }));
    await user.type(screen.getByTestId(CONFIRM_TEST_IDS.note), 'Up 12% this week');
    await user.click(action());

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
        reason: 'other',
        note: 'Price changed · Up 12% this week',
        picked: { value: 'price_changed', label: 'Price changed' },
        comment: 'Up 12% this week',
      }),
    );
  });

  it('takes caller-supplied reasons, toned blush · butter · lav, then stone', () => {
    renderReason({
      reason: {
        options: [
          { value: 'mistake', labelKey: REASON_CONFIRM_KEYS.reasons.mistake },
          { value: 'duplicate', labelKey: REASON_CONFIRM_KEYS.reasons.duplicate },
          { value: 'wrong_items', labelKey: REASON_CONFIRM_KEYS.reasons.wrongItems },
          { value: 'price_changed', labelKey: REASON_CONFIRM_KEYS.reasons.priceChanged },
          { value: 'other', labelKey: REASON_CONFIRM_KEYS.reasons.other },
        ],
      },
    });

    const tones = screen
      .getAllByRole('radio')
      .map((radio) => /bg-tone-(\w+)/.exec(radio.className)?.[1]);
    expect(tones).toEqual(['blush', 'butter', 'lav', 'stone', 'stone']);
  });

  it('Void brings its own reasons, action and effect', () => {
    renderReason({ title: 'Void this sale?', reason: { kind: 'void' } });

    expect(action()).toHaveTextContent('Void sale');
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Billed by mistake',
      'Wrong items',
      'Customer changed mind',
      'Other',
    ]);
    expect(dialog()).toHaveAccessibleDescription(
      'The sale is voided and its invoice is cancelled. Stock goes back.',
    );
    expect(screen.queryByTestId(CONFIRM_TEST_IDS.record)).not.toBeInTheDocument();
  });

  it('shows the server’s note error at the field and stays open (422)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(
      clinicHttpError(422, 'validation', 'Add a short note for "Other"', {
        note: ['Keep the note under 280 characters'],
      }),
    );
    const { onOpenChange } = renderReason({ onConfirm });

    await user.click(screen.getByTestId(confirmReasonTestId('mistake')));
    await user.click(action());

    const error = await screen.findByTestId(CONFIRM_TEST_IDS.noteError);
    expect(error).toHaveTextContent('Keep the note under 280 characters');
    const note = screen.getByTestId(CONFIRM_TEST_IDS.note);
    expect(note).toHaveAttribute('aria-invalid', 'true');
    expect(note).toHaveAccessibleDescription('Keep the note under 280 characters');
    await waitFor(() => expect(note).toHaveFocus());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    // Editing the note clears the stale error.
    await user.type(note, 'x');
    expect(screen.queryByTestId(CONFIRM_TEST_IDS.noteError)).not.toBeInTheDocument();
  });

  it('a failure that is not about its fields leaves the dialog open and silent', async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn()
      .mockRejectedValue(clinicHttpError(409, 'conflict', 'Changed meanwhile'));
    const { onOpenChange } = renderReason({ onConfirm });

    await user.click(screen.getByTestId(confirmReasonTestId('mistake')));
    await user.click(action());

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    await waitFor(() => expect(action()).not.toBeDisabled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.queryByTestId(CONFIRM_TEST_IDS.noteError)).not.toBeInTheDocument();
  });

  it('one gesture is one write — a double click inside a frame confirms once', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { onOpenChange } = renderReason({ onConfirm });
    await user.click(screen.getByTestId(confirmReasonTestId('duplicate')));

    // Both clicks land before React re-renders the button busy — the ref is
    // the only thing between them and a second write.
    await act(async () => {
      action().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      action().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(action()).toBeDisabled();

    // Every exit is held while the write is in flight.
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();

    await act(async () => {
      release();
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('starts clean every time it opens', async () => {
    const user = userEvent.setup();
    const { rerender, props } = renderReason();
    await user.click(screen.getByTestId(confirmReasonTestId('other')));
    await user.type(screen.getByTestId(CONFIRM_TEST_IDS.note), 'stale');

    rerender(<ConfirmDialog {...props} open={false} />);
    rerender(<ConfirmDialog {...props} open />);

    expect(
      screen.getAllByRole('radio').some((radio) => radio.ariaChecked === 'true'),
    ).toBe(false);
    expect(screen.getByTestId(CONFIRM_TEST_IDS.note)).toHaveValue('');
    expect(hint()).toHaveTextContent('Pick a reason to continue');
  });

  it('opens on the caller’s reason, waiting for the note it needs (A-A3)', async () => {
    const user = userEvent.setup();
    const { onConfirm, rerender, props } = renderReason({ reason: { initial: 'other' } });
    expect(screen.getByTestId(confirmReasonTestId('other'))).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(hint()).toHaveTextContent('Add a short note for “Other”');

    // A reopening starts on it again.
    await user.click(screen.getByTestId(confirmReasonTestId('mistake')));
    rerender(<ConfirmDialog {...props} open={false} />);
    rerender(<ConfirmDialog {...props} open />);
    expect(screen.getByTestId(confirmReasonTestId('other'))).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.type(screen.getByTestId(CONFIRM_TEST_IDS.note), 'Clinic closed early');
    await user.click(action());
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'other', note: 'Clinic closed early' }),
      ),
    );
  });

  it('soft-deletes through the store, then Undo restores within the window', async () => {
    const user = userEvent.setup();
    const patients = createFixtureCollection({
      resource: 'patients',
      seed: () => [
        {
          id: 'pt-1',
          seq: 2363,
          name: 'Priya Shah',
          organizationId: '00000000-0000-4000-8000-0000000c1a10',
          createdAt: '2026-10-01T09:00:00.000Z',
          updatedAt: '2026-10-01T09:00:00.000Z',
          createdById: '00000000-0000-4000-8000-0000000a0001',
          deletedAt: null,
          deleteReason: null,
          deleteNote: null,
        },
      ],
    });
    render(<AppToaster />);
    render(
      <ClosingConfirm
        title="Delete this patient?"
        onConfirm={async ({ reason, note }) => {
          await patients.remove('pt-1', reason, note);
        }}
        reason={{
          record: RECORD,
          undo: { message: 'Priya Shah removed', onUndo: () => patients.restore('pt-1') },
        }}
      />,
    );

    await user.click(screen.getByTestId(confirmReasonTestId('not_needed')));
    await user.click(action());

    // Soft-deleted with the stored reason, and the confirm is gone.
    await waitFor(() => expect(patients.snapshot()).toEqual([]));
    await waitFor(() =>
      expect(screen.queryByTestId(CONFIRM_TEST_IDS.dialog)).not.toBeInTheDocument(),
    );
    await clickUndo(user, 'Priya Shah removed');

    await waitFor(() =>
      expect(patients.snapshot().map((row) => row.id)).toEqual(['pt-1']),
    );
    expect(patients.snapshot()[0]).toMatchObject({
      deleteReason: null,
      deleteNote: null,
    });
  });

  it('names the record and the reason in the Undo toast when the caller asks', async () => {
    const user = userEvent.setup();
    render(<AppToaster />);
    renderReason({
      reason: {
        undo: {
          message: ({ picked }) => `Lead #3509 removed · ${picked.label}`,
          onUndo: vi.fn(),
        },
      },
    });

    await user.click(screen.getByTestId(confirmReasonTestId('duplicate')));
    await user.click(action());

    await sonnerToast('Lead #3509 removed · Duplicate');
  });

  it.each(['desktop', 'phone'] as const)(
    'has no accessibility violations (%s)',
    async (tier) => {
      viewport.tier = tier;
      const { baseElement } = renderReason();
      expect(await axeForDialog(baseElement)).toHaveNoViolations();
    },
  );
});
