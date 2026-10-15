import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';
import {
  installFakeSpeechRecognition,
  lastSpeechRecognition,
} from '@/tests/utils/speech-recognition-doubles.ts';

const { createBugReportMock } = vi.hoisted(() => ({ createBugReportMock: vi.fn() }));
vi.mock('@/shared/api/bug-report-api.ts', () => ({
  createBugReport: createBugReportMock,
  currentPagePath: () => '/organization/acme/today',
}));

import { BUG_REPORT_SENT_HOLD_MS, BUG_REPORT_TEST_IDS } from './bug-report.constants.ts';
import { BugReport } from './BugReport.tsx';

const STORED = {
  id: 'bug_aaaaaaaaaaaaaaaaaaaaa',
  description: 'x',
  input_method: 'typed',
  page_path: '/organization/acme/today',
  app_version: null,
  user_id: 'usr_bbbbbbbbbbbbbbbbbbbbb',
  reporter_name: 'Asha Rao',
  organization_id: null,
  created_at: '2026-10-13T10:00:00.000Z',
};

async function openPanel() {
  const user = userEvent.setup();
  renderWithProviders(<BugReport />);
  await user.click(await screen.findByTestId(BUG_REPORT_TEST_IDS.trigger));
  await screen.findByTestId(BUG_REPORT_TEST_IDS.panel);
  return user;
}

beforeEach(() => {
  createBugReportMock.mockReset();
  createBugReportMock.mockResolvedValue(STORED);
  useAuthStore.setState({
    user: {
      id: 'usr_bbbbbbbbbbbbbbbbbbbbb',
      email: 'asha@example.com',
      role: 'user',
      name: 'Asha Rao',
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('BugReport', () => {
  it('opens one textbox — no name, email or screenshot — focused, with Send disabled until there is text', async () => {
    await openPanel();

    const panel = screen.getByTestId(BUG_REPORT_TEST_IDS.panel);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByLabelText(/name|email|screenshot/i)).not.toBeInTheDocument();
    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.description)).toHaveFocus();
    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.send)).toBeDisabled();
    expect(panel).toHaveTextContent('Sent as Asha Rao');
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('sends a typed report with the page and version, shows the check, then folds away', async () => {
    const user = await openPanel();
    await user.type(
      screen.getByTestId(BUG_REPORT_TEST_IDS.description),
      '  The total is wrong ',
    );
    await user.click(screen.getByTestId(BUG_REPORT_TEST_IDS.send));

    await waitFor(() => expect(createBugReportMock).toHaveBeenCalledOnce());
    expect(createBugReportMock.mock.calls[0]?.[0]).toMatchObject({
      input: {
        description: 'The total is wrong',
        input_method: 'typed',
        page_path: '/organization/acme/today',
      },
      idempotencyKey: expect.any(String),
    });
    expect(await screen.findByTestId(BUG_REPORT_TEST_IDS.sent)).toHaveTextContent(
      'Thanks — the team has it.',
    );
    await waitFor(
      () =>
        expect(screen.queryByTestId(BUG_REPORT_TEST_IDS.panel)).not.toBeInTheDocument(),
      { timeout: BUG_REPORT_SENT_HOLD_MS + 2000 },
    );
  });

  it('sends with Ctrl+Enter', async () => {
    const user = await openPanel();
    await user.type(screen.getByTestId(BUG_REPORT_TEST_IDS.description), 'Froze');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(createBugReportMock).toHaveBeenCalledOnce());
  });

  it('keeps the words and says so when sending fails', async () => {
    createBugReportMock.mockRejectedValue(new Error('offline'));
    const user = await openPanel();
    await user.type(screen.getByTestId(BUG_REPORT_TEST_IDS.description), 'Froze');
    await user.click(screen.getByTestId(BUG_REPORT_TEST_IDS.send));

    expect(await screen.findByTestId(BUG_REPORT_TEST_IDS.error)).toHaveTextContent(
      "Couldn't send your report",
    );
    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.description)).toHaveValue('Froze');
  });

  it('has no voice button where the browser cannot recognise speech', async () => {
    await openPanel();
    expect(screen.queryByTestId(BUG_REPORT_TEST_IDS.voice)).not.toBeInTheDocument();
  });

  it('dictates into the textbox, shows interim words live, and records voice', async () => {
    installFakeSpeechRecognition();
    const user = await openPanel();

    const voice = screen.getByTestId(BUG_REPORT_TEST_IDS.voice);
    expect(voice).toHaveAttribute('aria-pressed', 'false');
    await user.click(voice);
    expect(voice).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.voiceStatus)).toHaveTextContent(
      'Listening…',
    );
    expect(lastSpeechRecognition()?.lang).toMatch(/^en/);

    act(() => lastSpeechRecognition()?.onspeechstart?.());
    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.voiceStatus)).toHaveTextContent(
      'Hearing you…',
    );
    act(() => lastSpeechRecognition()?.say('the invoice total', true));
    act(() => lastSpeechRecognition()?.say('does not upd', false));

    // The shared insert starts a sentence with a capital (feat-write-less, D6).
    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.description)).toHaveValue(
      'The invoice total',
    );
    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.interim)).toHaveTextContent(
      'does not upd',
    );

    // Send while still listening: the interim words go with it, once.
    await user.click(screen.getByTestId(BUG_REPORT_TEST_IDS.send));
    await waitFor(() => expect(createBugReportMock).toHaveBeenCalledOnce());
    expect(createBugReportMock.mock.calls[0]?.[0].input).toMatchObject({
      description: 'The invoice total does not upd',
      input_method: 'voice',
    });
  });

  it('records mixed when dictation is edited by hand', async () => {
    installFakeSpeechRecognition();
    const user = await openPanel();
    await user.click(screen.getByTestId(BUG_REPORT_TEST_IDS.voice));
    act(() => lastSpeechRecognition()?.say('It froze', true));
    await user.click(screen.getByTestId(BUG_REPORT_TEST_IDS.voice));
    await user.type(screen.getByTestId(BUG_REPORT_TEST_IDS.description), ' on save');
    await user.click(screen.getByTestId(BUG_REPORT_TEST_IDS.send));

    await waitFor(() => expect(createBugReportMock).toHaveBeenCalledOnce());
    expect(createBugReportMock.mock.calls[0]?.[0].input).toMatchObject({
      description: 'It froze on save',
      input_method: 'mixed',
    });
  });

  it('writes a spoken full stop and takes a phrase back on "scratch that"', async () => {
    installFakeSpeechRecognition();
    const user = await openPanel();
    await user.click(screen.getByTestId(BUG_REPORT_TEST_IDS.voice));
    act(() => lastSpeechRecognition()?.say('it froze full stop on save', true));
    act(() => lastSpeechRecognition()?.say('the list went blank', true));
    act(() => lastSpeechRecognition()?.say('scratch that', true));
    expect(screen.getByTestId(BUG_REPORT_TEST_IDS.description)).toHaveValue(
      'It froze. On save',
    );
  });

  it('says when the microphone is blocked', async () => {
    installFakeSpeechRecognition();
    const user = await openPanel();
    await user.click(screen.getByTestId(BUG_REPORT_TEST_IDS.voice));
    act(() => lastSpeechRecognition()?.onerror?.({ error: 'not-allowed' }));
    act(() => lastSpeechRecognition()?.onend?.());

    const status = screen.getByTestId(BUG_REPORT_TEST_IDS.voiceStatus);
    expect(status).toHaveTextContent('The microphone is blocked');
    // The whole sentence stays readable — it tells the user how to fix it.
    expect(status).not.toHaveClass('truncate');
  });

  it('the trigger is the bug icon alone, named by its aria-label', async () => {
    renderWithProviders(<BugReport />);
    const trigger = await screen.findByRole('button', { name: 'Report a bug' });
    expect(trigger).toHaveAttribute('data-testid', BUG_REPORT_TEST_IDS.trigger);
    expect(trigger).not.toHaveTextContent('Report a bug');
  });

  it('the closed trigger has no a11y violations', async () => {
    const { container } = renderWithProviders(<BugReport />);
    await screen.findByTestId(BUG_REPORT_TEST_IDS.trigger);
    expect(await axe(container)).toHaveNoViolations();
  });
});
