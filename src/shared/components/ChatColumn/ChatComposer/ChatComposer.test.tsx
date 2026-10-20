import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import type { ComposerMode } from '@/shared/api/app/messages-contracts.ts';
import {
  CHAT_COLUMN_NS,
  CHAT_COLUMN_TEST_IDS as ids,
} from '@/shared/components/ChatColumn/chat-column.constants.ts';
import { composerModes } from '@/shared/components/ChatColumn/chat-composer.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { Calendar, WhatsAppMark } from '@/shared/icons/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { axeLabelInName } from '@/tests/utils/axe-label-in-name.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import { ChatComposer, type ChatComposerProps } from './ChatComposer.tsx';

/** The composer with its mode and text held as the column holds them. */
function Harness(props: Partial<ChatComposerProps> & { initialMode?: ComposerMode }) {
  const { initialMode = 'whatsapp', ...rest } = props;
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [text, setText] = useState(rest.text ?? '');
  return (
    <TooltipProvider>
      <ChatComposer
        modes={composerModes({ name: 'Anaya Desai', phone: null, isPatient: false })}
        showLabels={false}
        onSend={vi.fn()}
        textareaRef={createRef<HTMLTextAreaElement>()}
        first="Anaya"
        hint={null}
        outage={false}
        warning={null}
        suggestions={[
          {
            key: 'greet',
            label: 'Greet',
            hint: 'Hi Anaya…',
            tone: 'sage',
            icon: WhatsAppMark,
            text: 'Hi Anaya, this is Riya from Cresence Skin 😊 How can I help you today?',
          },
        ]}
        templates={[
          {
            key: 'slots',
            name: 'Free slots',
            text: 'We have today 4 pm or tomorrow 11 am open for LHR. Which one suits you?',
            tone: 'sky',
            icon: Calendar,
          },
          {
            key: 'location',
            name: 'Location',
            text: 'We are at {{address}} · Google Maps: {{maps link}}.',
            tone: 'lav',
            icon: Calendar,
          },
        ]}
        fillValues={{ address: 'Adajan, Surat', 'maps link': 'maps.app.goo.gl/cresence' }}
        format={{ t: i18n.getFixedT('en', CHAT_COLUMN_NS) }}
        {...rest}
        mode={rest.mode ?? mode}
        onModeChange={rest.onModeChange ?? setMode}
        text={rest.text ?? text}
        onTextChange={rest.onTextChange ?? setText}
      />
    </TooltipProvider>
  );
}

const box = () => screen.getByTestId(ids.textarea);

describe('ChatComposer', () => {
  it('writes the placeholder and Send label for each mode (_patterns.md:160–163)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(box()).toHaveAttribute('placeholder', 'Message to Anaya on WhatsApp');
    expect(screen.getByTestId(ids.send)).toHaveTextContent('Send WhatsApp');
    await user.click(screen.getByRole('tab', { name: 'Call log' }));
    expect(box()).toHaveAttribute('placeholder', 'What happened on the call?');
    expect(screen.getByTestId(ids.send)).toHaveTextContent('Log call');
    await user.click(screen.getByRole('tab', { name: 'Note' }));
    expect(box()).toHaveAttribute('placeholder', 'Note for the team, not sent to Anaya');
    expect(screen.getByTestId(ids.send)).toHaveTextContent('Add note');
  });

  it('falls back to "the lead" without a first name', () => {
    render(<Harness first="" />);
    expect(box()).toHaveAttribute('placeholder', 'Message to the lead on WhatsApp');
  });

  it('sends on Enter — not on Shift+Enter, not mid-composition', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSend={onSend} />);
    await user.type(box(), 'Hi{Shift>}{Enter}{/Shift}there');
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(box(), { key: 'Enter', isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('caps a message at 1,000 characters', () => {
    render(<Harness />);
    expect(box()).toHaveAttribute('maxLength', '1000');
  });

  it('writes the notes beside the tabs', async () => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Harness
        hint={{ kind: 'here' }}
        outage
        warning="afterSix"
        onModeChange={onModeChange}
      />,
    );
    // Their name isolated: a Latin name keeps its order in a right-to-left note.
    expect(screen.getByText(`${fsi('Anaya')} last wrote here`)).toBeVisible();
    expect(screen.getByText('WhatsApp down · replies will queue')).toBeVisible();
    expect(screen.getByText('Prefers contact after 6 pm')).toBeVisible();

    rerender(
      <Harness
        hint={{ kind: 'mismatch', channel: 'instagram' }}
        onModeChange={onModeChange}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: `${fsi('Anaya')} wrote on Instagram · Switch` }),
    );
    expect(onModeChange).toHaveBeenCalledWith('instagram');
  });

  it('opens the suggestions from Suggest, closes them with ×, and fills the box with a pick', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Suggest' }));
    const popover = screen.getByRole('dialog', { name: 'Suggested for Anaya' });
    expect(screen.getByRole('button', { name: 'Suggest' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(await axeForDialog(popover)).toHaveNoViolations();
    await user.click(within(popover).getByRole('button', { name: 'Close suggestions' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Suggest' }));
    await user.click(screen.getByRole('button', { name: /Greet/ }));
    expect(box()).toHaveValue(
      'Hi Anaya, this is Riya from Cresence Skin 😊 How can I help you today?',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on a leading "/" and filters the templates by it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(box(), '/free');
    const popover = screen.getByRole('dialog', { name: 'Suggested for Anaya' });
    expect(within(popover).getByTestId(`${ids.template}-slots`)).toBeVisible();
    expect(
      within(popover).queryByTestId(`${ids.template}-location`),
    ).not.toBeInTheDocument();
    await user.type(box(), ' x');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes a "/" search on Escape and clears it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(box(), '/loc');
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(box()).toHaveValue('');
  });

  it('hides Suggest and Book on a call log or note', async () => {
    const user = userEvent.setup();
    render(<Harness onBook={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Book an appointment' })).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Note' }));
    expect(screen.queryByRole('button', { name: 'Suggest' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Book an appointment' }),
    ).not.toBeInTheDocument();
  });

  it('offers a "Fill in" chip per placeholder', async () => {
    const user = userEvent.setup();
    render(<Harness text={undefined} />);
    await user.click(screen.getByRole('button', { name: 'Suggest' }));
    await user.click(screen.getByTestId(`${ids.template}-location`));
    expect(screen.getByText('Fill in')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'maps link' }));
    expect(box()).toHaveValue('We are at Adajan, Surat · Google Maps: {{maps link}}.');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Harness showLabels />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names Suggest by the word it shows, not "Suggestions" over it (WCAG 2.5.3)', async () => {
    const { container } = render(<Harness />);
    const suggest = screen.getByTestId(ids.suggest);
    expect(suggest).not.toHaveAttribute('aria-label');
    expect(suggest).toHaveAccessibleName('Suggest');
    const results = await axeLabelInName(container);
    expect(results.violations).toEqual([]);
    expect(results.incomplete).toEqual([]);
  });
});
