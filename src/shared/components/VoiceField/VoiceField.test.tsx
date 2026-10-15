import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  installFakeSpeechRecognition,
  lastSpeechRecognition,
} from '@/tests/utils/speech-recognition-doubles.ts';

import { useVoiceField } from './use-voice-field.ts';
import { VoiceField } from './VoiceField.tsx';

/** A controlled note or line in the common voice field, as a dialog's reason or a drawer's note. */
function Field({
  testId = 'note',
  multiline = true,
  onPhrase,
  blocked = false,
}: {
  testId?: string;
  multiline?: boolean;
  onPhrase?: (text: string) => void;
  blocked?: boolean;
}) {
  const [text, setText] = useState('');
  const voice = useVoiceField({ multiline, onPhrase, blocked, testId });
  const shared = {
    ...voice.fieldProps,
    'aria-label': testId,
    'data-testid': testId,
    value: text,
    readOnly: blocked,
  };
  return (
    <VoiceField voice={voice}>
      {multiline ? (
        <textarea {...shared} onChange={(event) => setText(event.target.value)} />
      ) : (
        <input {...shared} onChange={(event) => setText(event.target.value)} />
      )}
    </VoiceField>
  );
}

const say = (words: string) => act(() => lastSpeechRecognition()?.say(words, true));

describe('VoiceField — the common voice field', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the field as it is where the browser cannot recognise speech', () => {
    render(<Field />);
    expect(screen.getByTestId('note')).toBeInTheDocument();
    expect(screen.queryByTestId('note-voice')).toBeNull();
    expect(screen.getByTestId('note')).not.toHaveAttribute('aria-keyshortcuts');
  });

  it('writes spoken marks, breaks the line and takes back a phrase on "scratch that"', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(<Field />);
    const note = screen.getByRole('textbox', { name: 'note' });

    await user.click(screen.getByTestId('note-voice'));
    expect(screen.getByTestId('note-voice-hint')).toHaveTextContent(
      'Say “full stop”, “comma”, “new line” or “scratch that”',
    );
    say('mild redness full stop avoid sun');
    expect(note).toHaveValue('Mild redness. Avoid sun');
    say('new line');
    say('apply twice daily');
    expect(note).toHaveValue('Mild redness. Avoid sun\nApply twice daily');
    say('scratch that');
    expect(note).toHaveValue('Mild redness. Avoid sun\n');
    say('use sunscreen comma every morning');
    expect(note).toHaveValue('Mild redness. Avoid sun\nUse sunscreen, every morning');
  });

  it('leaves a phrase alone once the text has been typed over since', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(<Field />);
    const note = screen.getByRole('textbox', { name: 'note' });
    await user.click(screen.getByTestId('note-voice'));
    say('healed well');
    await user.type(note, ' today');
    say('scratch that');
    expect(note).toHaveValue('Healed well today');
  });

  it('starts and stops from inside the field with the shortcut, which the field names', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(<Field />);
    const note = screen.getByRole('textbox', { name: 'note' });
    const mic = screen.getByTestId('note-voice');
    expect(note).toHaveAttribute(
      'aria-keyshortcuts',
      expect.stringMatching(/\+Shift\+Space$/),
    );
    expect(mic).toHaveAttribute('tabindex', '-1');
    expect(mic).toHaveAttribute(
      'title',
      expect.stringMatching(/^Dictate with your voice \(/),
    );

    await user.click(note);
    await user.keyboard('{Control>}{Shift>} {/Shift}{/Control}');
    expect(mic).toHaveAttribute('aria-pressed', 'true');
    expect(note).toHaveFocus();
    await user.keyboard('{Control>}{Shift>} {/Shift}{/Control}');
    expect(mic).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the focus in the field when its mic is pressed', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(<Field />);
    const note = screen.getByRole('textbox', { name: 'note' });
    await user.click(note);
    await user.click(screen.getByTestId('note-voice'));
    expect(note).toHaveFocus();
  });

  it('puts the caret in its own field when a mic is pressed from elsewhere', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(
      <>
        <Field testId="first" />
        <Field testId="second" />
      </>,
    );
    await user.click(screen.getByRole('textbox', { name: 'first' }));
    await user.click(screen.getByTestId('second-voice'));
    expect(screen.getByRole('textbox', { name: 'second' })).toHaveFocus();
  });

  it('lets one field listen at a time', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(
      <>
        <Field testId="first" />
        <Field testId="second" />
      </>,
    );
    await user.click(screen.getByTestId('first-voice'));
    await user.click(screen.getByTestId('second-voice'));
    expect(screen.getByTestId('first-voice')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('second-voice')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a line’s mic only while the line is in use, floats its status, and has no lines', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(<Field testId="reason" multiline={false} />);
    const reason = screen.getByRole('textbox', { name: 'reason' });
    const micBox = screen.getByTestId('reason-voice').parentElement;
    expect(micBox).toHaveClass('opacity-0', 'pointer-events-none');

    await user.click(reason);
    await user.keyboard('{Control>}{Shift>} {/Shift}{/Control}');
    expect(screen.getByTestId('reason-voice-status').parentElement).toHaveClass(
      'absolute',
      'top-full',
    );
    say('itching new line on both arms');
    expect(reason).toHaveValue('Itching on both arms');
  });

  it('hands each phrase to its owner instead of writing it, when asked', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    const onPhrase = vi.fn();
    render(<Field testId="chips" multiline={false} onPhrase={onPhrase} />);
    await user.click(screen.getByRole('textbox', { name: 'chips' }));
    await user.keyboard('{Control>}{Shift>} {/Shift}{/Control}');
    say('acne comma pigmentation');
    expect(onPhrase).toHaveBeenCalledWith('acne, pigmentation');
    expect(screen.getByRole('textbox', { name: 'chips' })).toHaveValue('');
  });

  it('offers no mic and no shortcut on a read-only field', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(<Field blocked />);
    expect(screen.queryByTestId('note-voice')).toBeNull();
    await user.click(screen.getByRole('textbox', { name: 'note' }));
    await user.keyboard('{Control>}{Shift>} {/Shift}{/Control}');
    expect(lastSpeechRecognition()).toBeNull();
  });

  it('has no accessibility violations', async () => {
    installFakeSpeechRecognition();
    const { container } = render(
      <>
        <Field />
        <Field testId="reason" multiline={false} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
