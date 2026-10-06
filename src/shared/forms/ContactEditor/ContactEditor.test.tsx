import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as NotifyModule from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { lri } from '@/tests/utils/bidi-marks.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { type ContactEditorValue, emptyContactValue } from './contact-editor-value.ts';
import { ContactEditor, type ContactEditorProps } from './ContactEditor.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { info: vi.fn(), success: vi.fn(), error: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: notifyMock,
}));

const RHEA: ContactEditorValue = {
  name: 'Rhea Shah',
  phones: [
    { digits: '9825011241', whatsapp: true },
    { digits: '9099055120', whatsapp: true },
  ],
  instagram: ['@rhea'],
  defaultChannel: 'whatsapp',
  preferences: ['No calls', 'Call after lunch'],
};

/** A page that opens the editor and keeps what "Done" hands back. */
function Harness(props: Partial<ContactEditorProps>) {
  const [open, setOpen] = useState(true);
  const [kept, setKept] = useState<ContactEditorValue | null>(null);
  return (
    <>
      <output data-testid="kept">{kept ? JSON.stringify(kept) : 'none'}</output>
      <ContactEditor
        value={RHEA}
        record={{ kind: 'lead', displayId: '#2365' }}
        {...props}
        open={open}
        onDone={(value) => {
          setKept(value);
          setOpen(false);
          props.onDone?.(value);
        }}
        onClose={() => {
          setOpen(false);
          props.onClose?.();
        }}
      />
    </>
  );
}

const kept = (): ContactEditorValue | null => {
  const text = screen.getByTestId('kept').textContent ?? 'none';
  return text === 'none' ? null : (JSON.parse(text) as ContactEditorValue);
};

beforeEach(() => {
  for (const mock of Object.values(notifyMock)) mock.mockReset();
});

describe('ContactEditor', () => {
  it('is a dialog: "Edit contact", the sub line, the band and the ID chip', async () => {
    renderWithProviders(<Harness />);

    const dialog = await screen.findByRole('dialog', { name: 'Edit contact' });
    expect(dialog).toHaveAccessibleDescription(
      'Saved once · used by every lead, patient and chat',
    );
    await waitFor(() => expect(screen.getByText('Edit contact')).toHaveFocus());
    const band = screen.getByTestId('contact-editor-band');
    expect(band).toHaveClass('bg-tone-lav-tint');
    expect(within(band).getByText('Rhea Shah')).toBeInTheDocument();
    expect(within(band).getByText('Lead')).toBeInTheDocument();
    expect(screen.getByTestId('contact-editor-id')).toHaveTextContent('#2365');
    expect(
      screen.getByText('One contact · shared by leads, patients and chats'),
    ).toBeInTheDocument();
    // The record drawer's 560px (six light fields), the form drawers' ×.
    expect(dialog).toHaveClass('md:w-[min(560px,calc(100vw-56px))]');
    expect(screen.getByTestId('contact-editor-dismiss')).toHaveTextContent('Back');
  });

  it('shows a new contact as "New contact" on the canvas band, without an ID', async () => {
    renderWithProviders(<Harness value={emptyContactValue()} record={null} />);

    const band = await screen.findByTestId('contact-editor-band');
    expect(band).toHaveClass('bg-canvas');
    expect(within(band).getByText('New contact')).toBeInTheDocument();
    expect(within(band).getByText('?')).toBeInTheDocument();
    expect(screen.queryByTestId('contact-editor-id')).toBeNull();

    const circle = () =>
      screen
        .getByTestId('contact-editor-step-identity-trigger')
        .querySelector('[data-slot="pill"]');
    expect(circle()).not.toHaveClass('bg-success');

    await userEvent.type(screen.getByTestId('contact-editor-name'), 'priya');
    expect(within(band).getByText('Priya')).toBeInTheDocument();
    expect(within(band).getByText('Contact')).toBeInTheDocument();
    expect(within(band).getByText('P')).toBeInTheDocument();
    // "Identity & reach" turns green once there is a name.
    expect(circle()).toHaveClass('bg-success');
  });

  it('edits the numbers: a pasted 91 dropped, primary, WhatsApp, remove, add', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    const second = await screen.findByRole('textbox', { name: 'Mobile 2' });
    expect(second).toHaveValue('90990 55120');
    await user.click(screen.getByTestId('contact-editor-primary-2'));
    expect(notifyMock.success).toHaveBeenCalledWith(
      '+91 90990 55120 is now the primary number',
    );
    expect(screen.getByRole('textbox', { name: 'Mobile 1' })).toHaveValue('90990 55120');
    expect(screen.getByTestId('contact-editor-primary-1')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const whatsApp = screen.getByTestId('contact-editor-whatsapp-2');
    expect(whatsApp).toHaveAttribute('aria-checked', 'true');
    await user.click(whatsApp);
    expect(whatsApp).toHaveAttribute('aria-checked', 'false');
    expect(whatsApp).toHaveAttribute('title', 'Not on WhatsApp · click to turn on');

    await user.click(screen.getByTestId('contact-editor-remove-number-1'));
    expect(screen.queryByRole('textbox', { name: 'Mobile 2' })).toBeNull();
    // One number left: no × to remove it.
    expect(screen.queryByTestId('contact-editor-remove-number-1')).toBeNull();

    await user.click(screen.getByTestId('contact-editor-add-number'));
    await user.click(screen.getByRole('textbox', { name: 'Mobile 2' }));
    await user.paste('+91 98765-43210');
    expect(screen.getByRole('textbox', { name: 'Mobile 2' })).toHaveValue('98765 43210');
  });

  it('adds and removes Instagram handles, and picks the default channel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness value={{ ...RHEA, instagram: [] }} />);

    await user.click(await screen.findByTestId('contact-editor-add-instagram'));
    await user.type(screen.getByRole('textbox', { name: 'Instagram 1' }), '@rhea.skin');
    expect(screen.queryByTestId('contact-editor-add-instagram')).toBeNull();
    await user.click(screen.getByTestId('contact-editor-add-handle'));
    await user.click(screen.getAllByRole('button', { name: 'Remove handle' })[0]!);
    expect(notifyMock.success).toHaveBeenCalledWith('Removed @rhea.skin');

    await user.click(screen.getByTestId('contact-editor-channel-sms'));
    expect(screen.getByTestId('contact-editor-channel-sms')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByTestId('contact-editor-done'));
    expect(kept()).toMatchObject({ instagram: [''], defaultChannel: 'sms' });
  });

  it('moves to Contact preferences, toggles presets and adds a custom one', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await screen.findByTestId('contact-editor-step-identity-next'));
    const group = screen.getByRole('group', { name: 'Contact preferences' });
    expect(within(group).getByRole('button', { name: 'No calls' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      within(group).getByRole('button', { name: 'Call after lunch' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Collapsed, Identity & reach names the contact.
    expect(screen.getByTestId('contact-editor-step-identity')).toHaveTextContent(
      'Rhea Shah',
    );

    await user.click(within(group).getByRole('button', { name: 'Hindi' }));
    await user.click(within(group).getByRole('button', { name: 'No calls' }));
    await user.click(screen.getByTestId('contact-editor-custom'));
    await user.type(screen.getByTestId('contact-editor-custom-input'), 'hindi{Enter}');
    await user.click(screen.getByTestId('contact-editor-custom'));
    await user.type(screen.getByTestId('contact-editor-custom-input'), 'Weekends{Enter}');

    await user.click(screen.getByTestId('contact-editor-done'));
    expect(kept()?.preferences).toEqual(['Hindi', 'Call after lunch', 'Weekends']);
  });

  it('leaves the custom field on Esc and keeps the editor open', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(
      await screen.findByTestId('contact-editor-step-preferences-trigger'),
    );
    await user.click(screen.getByTestId('contact-editor-custom'));
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('contact-editor-custom-input')).toBeNull();
    expect(screen.getByTestId('contact-editor')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('contact-editor')).toBeNull());
    expect(kept()).toBeNull();
  });

  it('keeps nothing from ×: it asks first once edited, and only Done hands the values back', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<Harness onClose={onClose} />);

    await user.clear(await screen.findByTestId('contact-editor-name'));
    await user.type(screen.getByTestId('contact-editor-name'), 'Rhea S');
    await user.click(screen.getByTestId('contact-editor-close'));
    // An edited contact asks before discarding (Q-P1).
    await screen.findByTestId('confirm-dialog');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('confirm-accept'));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(kept()).toBeNull();
  });

  it('closes at once from × when nothing was edited', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<Harness onClose={onClose} />);

    await user.click(await screen.findByTestId('contact-editor-close'));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });

  it('copies the record’s ID from its chip', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderWithProviders(<Harness />);

    await user.click(await screen.findByTestId('contact-editor-id'));
    expect(writeText).toHaveBeenCalledWith('#2365');
    // The clipboard takes the bare id; the toast isolates it left to right.
    expect(notifyMock.success).toHaveBeenCalledWith(`Contact ID ${lri('#2365')} copied`);
    expect(screen.getByText('#2365')).toHaveAttribute('dir', 'ltr');
  });

  it('offers the band’s actions for a known contact, closing the editor first', async () => {
    const user = userEvent.setup();
    const onNewLead = vi.fn();
    const onOpenPatientFile = vi.fn();
    const { unmount } = renderWithProviders(
      <Harness onNewLead={onNewLead} onNewPatient={vi.fn()} />,
    );

    await user.click(await screen.findByTestId('contact-editor-new-lead'));
    expect(onNewLead).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByTestId('contact-editor')).toBeNull());
    unmount();

    renderWithProviders(
      <Harness
        record={{ kind: 'patient', displayId: '#3508' }}
        onOpenPatientFile={onOpenPatientFile}
        onNewPatient={vi.fn()}
      />,
    );
    const band = await screen.findByTestId('contact-editor-band');
    expect(band).toHaveClass('bg-tone-sage-tint');
    // A patient is offered no "+ Patient"; the name opens the file.
    expect(screen.queryByTestId('contact-editor-new-patient')).toBeNull();
    await user.click(within(band).getByRole('button', { name: /Rhea Shah/ }));
    expect(onOpenPatientFile).toHaveBeenCalledOnce();
  });

  it('shows the linked notice with its Undo', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    renderWithProviders(
      <Harness
        linked={{
          text: 'Linked to Rhea Shah · Patient #3508 · channels and preferences reused',
          onUndo,
        }}
      />,
    );

    const notice = await screen.findByTestId('contact-editor-linked');
    await user.click(within(notice).getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    renderWithProviders(<Harness />);
    const dialog = await screen.findByRole('dialog', { name: 'Edit contact' });
    expect(await axeForDialog(dialog)).toHaveNoViolations();
  });
});
