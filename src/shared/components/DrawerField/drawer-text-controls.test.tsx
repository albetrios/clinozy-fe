import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  installFakeSpeechRecognition,
  lastSpeechRecognition,
} from '@/tests/utils/speech-recognition-doubles.ts';

import { capitalizesFirstLetter } from './auto-capitalize.ts';
import { DrawerInput, DrawerTextarea } from './drawer-text-controls.tsx';

describe('DrawerInput — first letter capitalised as typed (H:4515–4521)', () => {
  it('capitalises a name and keeps typing where the caret is', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(
      <DrawerInput
        aria-label="Full name"
        onChange={(event) => seen.push(event.target.value)}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'Full name' });
    await user.type(field, 'riya shah');
    expect(field).toHaveValue('Riya shah');
    // The caller's own onChange already reads the capitalised value.
    expect(seen.at(-1)).toBe('Riya shah');
    expect(seen[0]).toBe('R');
  });

  it('hands react-hook-form the capitalised value', async () => {
    const user = userEvent.setup();
    let read: () => string = () => '';
    function Form() {
      const { register, getValues } = useForm<{ name: string }>({
        defaultValues: { name: '' },
      });
      read = () => getValues('name');
      return <DrawerInput aria-label="Name" {...register('name')} />;
    }
    render(<Form />);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'meera');
    expect(read()).toBe('Meera');
  });

  it.each([
    ['a phone type', { type: 'tel', 'aria-label': 'Mobile number' }],
    ['an email type', { type: 'email', 'aria-label': 'Work address' }],
    ['a numeric input mode', { inputMode: 'numeric' as const, 'aria-label': 'Qty' }],
    ['an Instagram placeholder', { placeholder: 'Instagram handle', 'aria-label': 'IG' }],
    ['the opt-out', { capitalize: false, 'aria-label': 'Code' }],
  ])('leaves %s alone', async (_case, props) => {
    const user = userEvent.setup();
    render(<DrawerInput data-testid="field" {...props} />);
    await user.type(screen.getByTestId('field'), 'abc');
    expect(screen.getByTestId('field')).toHaveValue('abc');
  });

  it('leaves a handle typed with its "@" alone', async () => {
    const user = userEvent.setup();
    render(<DrawerInput aria-label="Referred by" />);
    const field = screen.getByRole('textbox', { name: 'Referred by' });
    await user.type(field, '@riya');
    expect(field).toHaveValue('@riya');
  });

  it('reads a visible label as well as aria-label and placeholder', () => {
    render(
      <>
        <label htmlFor="mobile">Phone</label>
        <DrawerInput id="mobile" />
      </>,
    );
    expect(capitalizesFirstLetter(screen.getByRole('textbox'))).toBe(false);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<DrawerInput aria-label="Full name" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DrawerInput — speak into a prose line (feat-write-less D18)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has no microphone unless the line asks for one', () => {
    installFakeSpeechRecognition();
    render(<DrawerInput aria-label="Name" data-testid="name" />);
    expect(screen.queryByTestId('name-voice')).toBeNull();
    expect(screen.getByTestId('name').parentElement).toBe(document.body.firstChild);
  });

  it('writes a spoken phrase into a dictated line, the box taking the line’s place in its row', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    function Reason() {
      const { register, watch } = useForm<{ reason: string }>({
        defaultValues: { reason: '' },
      });
      return (
        <>
          <DrawerInput
            aria-label="Reason"
            data-testid="reason"
            dictation
            boxClassName="min-w-0 flex-1"
            {...register('reason')}
          />
          <output data-testid="reason-value">{watch('reason')}</output>
        </>
      );
    }
    render(<Reason />);
    const field = screen.getByRole('textbox', { name: 'Reason' });
    expect(field.parentElement).toHaveClass('flex-1');
    expect(field).toHaveClass('pe-8');
    await user.click(field);
    await user.click(screen.getByTestId('reason-voice'));
    act(() => lastSpeechRecognition()?.say('pigmentation on cheeks', true));
    expect(field).toHaveValue('Pigmentation on cheeks');
    expect(screen.getByTestId('reason-value')).toHaveTextContent(
      'Pigmentation on cheeks',
    );
  });

  it('hands a spoken phrase to onDictation instead of the field', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    const onDictation = vi.fn();
    render(<DrawerInput aria-label="Add" data-testid="add" onDictation={onDictation} />);
    await user.click(screen.getByRole('textbox', { name: 'Add' }));
    await user.click(screen.getByTestId('add-voice'));
    act(() => lastSpeechRecognition()?.say('acne', true));
    expect(onDictation).toHaveBeenCalledWith('acne');
    expect(screen.getByRole('textbox', { name: 'Add' })).toHaveValue('');
  });
});

describe('DrawerTextarea', () => {
  it('capitalises a note but not a message', async () => {
    const user = userEvent.setup();
    render(
      <>
        <DrawerTextarea aria-label="Note" />
        <DrawerTextarea aria-label="Message" />
      </>,
    );
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'called twice');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'hello');
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('Called twice');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('hello');
  });
});

describe('DrawerTextarea — speak instead of typing (feat-write-less)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A note field on react-hook-form, as most drawers register theirs. */
  function RegisteredNote({ maxLength }: { maxLength?: number }) {
    const { register, watch } = useForm<{ note: string }>({
      defaultValues: { note: '' },
    });
    return (
      <>
        <DrawerTextarea
          aria-label="Notes"
          data-testid="note"
          maxLength={maxLength}
          {...register('note')}
        />
        <output data-testid="form-value">{watch('note')}</output>
      </>
    );
  }

  it('shows no microphone where the browser cannot recognise speech', () => {
    render(<DrawerTextarea aria-label="Notes" data-testid="note" />);
    expect(screen.queryByTestId('note-voice')).toBeNull();
  });

  it('listens, shows the live words, and writes each settled phrase into the form', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(<RegisteredNote />);

    const mic = screen.getByTestId('note-voice');
    expect(mic).toHaveAccessibleName('Dictate with your voice');
    await user.click(mic);
    expect(mic).toHaveAttribute('aria-pressed', 'true');
    expect(mic).toHaveAccessibleName('Stop dictating');
    expect(screen.getByTestId('note-voice-status')).toHaveTextContent('Listening…');

    act(() => lastSpeechRecognition()?.onspeechstart?.());
    expect(screen.getByTestId('note-voice-status')).toHaveTextContent('Hearing you…');
    act(() => lastSpeechRecognition()?.say('pigmentation on both', false));
    expect(screen.getByTestId('note-interim')).toHaveTextContent('pigmentation on both');

    act(() => lastSpeechRecognition()?.say('pigmentation on both cheeks', true));
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue(
      'Pigmentation on both cheeks',
    );
    expect(screen.getByTestId('form-value')).toHaveTextContent(
      'Pigmentation on both cheeks',
    );
    expect(screen.queryByTestId('note-interim')).toBeNull();

    await user.click(mic);
    expect(mic).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('note-voice-status')).toBeNull();
  });

  it('writes at the caret once the field has been used, within its limit', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(<RegisteredNote maxLength={40} />);
    const field = screen.getByRole('textbox', { name: 'Notes' });
    await user.type(field, 'Apply twice daily');
    (field as HTMLTextAreaElement).setSelectionRange(6, 6);

    await user.click(screen.getByTestId('note-voice'));
    act(() => lastSpeechRecognition()?.say('gently', true));
    expect(field).toHaveValue('Apply gently twice daily');

    act(() => lastSpeechRecognition()?.say('and every night before you sleep', true));
    expect((field as HTMLTextAreaElement).value).toHaveLength(40);
  });

  it('feeds a controlled field through its onChange', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    function Controlled() {
      const [text, setText] = useState('Healed well.');
      return (
        <DrawerTextarea
          aria-label="Remark"
          data-testid="remark"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      );
    }
    render(<Controlled />);
    await user.click(screen.getByTestId('remark-voice'));
    act(() => lastSpeechRecognition()?.say('continue sunscreen', true));
    expect(screen.getByRole('textbox', { name: 'Remark' })).toHaveValue(
      'Healed well. Continue sunscreen',
    );
  });

  it('says a blocked microphone in words', async () => {
    installFakeSpeechRecognition();
    const user = userEvent.setup();
    render(<RegisteredNote />);
    await user.click(screen.getByTestId('note-voice'));
    act(() => {
      lastSpeechRecognition()?.fail('not-allowed');
      lastSpeechRecognition()?.onend?.();
    });
    expect(screen.getByTestId('note-voice-status')).toHaveTextContent(
      'The microphone is blocked',
    );
  });

  it('offers no microphone on a read-only, disabled or opted-out field', () => {
    installFakeSpeechRecognition();
    render(
      <>
        <DrawerTextarea aria-label="A" data-testid="read-only" readOnly />
        <DrawerTextarea aria-label="B" data-testid="disabled" disabled />
        <DrawerTextarea aria-label="C" data-testid="opted-out" dictation={false} />
      </>,
    );
    expect(screen.queryByTestId('read-only-voice')).toBeNull();
    expect(screen.queryByTestId('disabled-voice')).toBeNull();
    expect(screen.queryByTestId('opted-out-voice')).toBeNull();
  });

  it('writes a suggestion into the field once, then hides its chip', async () => {
    const user = userEvent.setup();
    function WithSuggestion() {
      const { register, watch } = useForm<{ plan: string }>({
        defaultValues: { plan: '' },
      });
      return (
        <>
          <DrawerTextarea
            aria-label="Next plan"
            data-testid="plan"
            suggestions={[
              {
                id: 'last',
                label: 'Same plan as last time',
                text: 'Sunscreen and serum',
              },
            ]}
            {...register('plan')}
          />
          <output data-testid="plan-value">{watch('plan')}</output>
        </>
      );
    }
    const { container } = render(<WithSuggestion />);
    await user.click(screen.getByTestId('plan-suggestion-last'));
    expect(screen.getByRole('textbox', { name: 'Next plan' })).toHaveValue(
      'Sunscreen and serum',
    );
    expect(screen.getByTestId('plan-value')).toHaveTextContent('Sunscreen and serum');
    expect(screen.queryByTestId('plan-suggestion-last')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations with the microphone', async () => {
    installFakeSpeechRecognition();
    const { container } = render(<RegisteredNote />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
