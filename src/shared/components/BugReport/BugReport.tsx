import './bug-report.css';

import {
  type KeyboardEvent,
  type SubmitEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { cn } from '@/lib/utils.ts';
import { createBugReport, currentPagePath } from '@/shared/api/bug-report-api.ts';
import {
  BUG_REPORT_DESCRIPTION_MAX_LENGTH,
  type BugReport as StoredBugReport,
  type CreateBugReportRequest,
} from '@/shared/api/bug-report-contracts.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import {
  resolveSpeechLanguage,
  type SpeechRecognitionState,
  useSpeechRecognition,
} from '@/shared/hooks/useSpeechRecognition/index.ts';
import { Bug, Loader, Send, X } from '@/shared/icons/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import {
  BUG_REPORT_KEYS,
  BUG_REPORT_NS,
  BUG_REPORT_SENT_HOLD_MS,
  BUG_REPORT_TEST_IDS,
} from './bug-report.constants.ts';
import { appendPhrase, inputMethodOf, voiceStatusKey } from './bug-report-text.ts';
import { VoiceInputButton } from './VoiceInputButton/index.ts';

const DESCRIPTION_ID = 'bug-report-description';

/** The drawn check and a thank-you — what the panel becomes once the report is stored. */
function BugReportSent() {
  const { t } = useTranslation(BUG_REPORT_NS);
  return (
    <output
      data-testid={BUG_REPORT_TEST_IDS.sent}
      className="bug-report-sent flex flex-col items-center gap-3 px-6 py-8 text-center"
    >
      <svg
        viewBox="0 0 52 52"
        aria-hidden="true"
        className="bug-report-check text-success"
      >
        <circle
          cx="26"
          cy="26"
          r="23"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M15 27.5 22.5 35 37.5 18.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-foreground text-sm font-medium">
        {t(BUG_REPORT_KEYS.sent)}
      </span>
    </output>
  );
}

/** The panel's title row: the bug, what to do, and a close. */
function BugReportHeader({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(BUG_REPORT_NS);
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
      >
        <Bug className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-foreground text-sm font-semibold">
          {t(BUG_REPORT_KEYS.title)}
        </h2>
        <p className="text-muted-foreground text-xs">{t(BUG_REPORT_KEYS.subtitle)}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t(BUG_REPORT_KEYS.close)}
        data-testid={BUG_REPORT_TEST_IDS.close}
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  );
}

/** The row under the text: the voice button (where the browser has one), its status, Send. */
function BugReportToolbar({
  speech,
  onToggleVoice,
  canSend,
  pending,
}: {
  speech: SpeechRecognitionState;
  onToggleVoice: () => void;
  canSend: boolean;
  pending: boolean;
}) {
  const { t } = useTranslation(BUG_REPORT_NS);
  const statusKey = voiceStatusKey(speech);
  const voiceLabel = t(
    speech.listening ? BUG_REPORT_KEYS.voiceStop : BUG_REPORT_KEYS.voiceStart,
  );
  const SendIcon = pending ? Loader : Send;

  return (
    <div className="flex items-center gap-2 px-2 pt-1 pb-2">
      {speech.supported ? (
        <VoiceInputButton
          listening={speech.listening}
          hearing={speech.hearing}
          label={voiceLabel}
          onToggle={onToggleVoice}
          disabled={pending}
        />
      ) : null}
      <p
        data-testid={BUG_REPORT_TEST_IDS.voiceStatus}
        aria-live="polite"
        className={cn(
          'min-w-0 flex-1 text-xs',
          // A problem says what to do next, so it wraps; "Listening…" is one short line.
          speech.problem
            ? 'text-destructive leading-snug'
            : 'text-muted-foreground truncate',
        )}
      >
        {statusKey ? t(statusKey) : ''}
      </p>
      <Button
        type="submit"
        size="sm"
        data-testid={BUG_REPORT_TEST_IDS.send}
        disabled={!canSend}
        className="bug-report-press"
      >
        <SendIcon className={cn(pending && 'animate-spin')} aria-hidden="true" />
        {t(pending ? BUG_REPORT_KEYS.sending : BUG_REPORT_KEYS.send)}
      </Button>
    </div>
  );
}

/**
 * The panel's body: one textbox, the voice button, Send — and, once sent, the drawn check.
 * Mounted only while the panel is open (Radix unmounts closed content), so every open starts
 * clean and a closing panel aborts any recognizer still running.
 */
function BugReportPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(BUG_REPORT_NS);
  const locale = useLocaleStore((state) => state.locale);
  const reporter = useAuthStore((state) => state.user?.name ?? state.user?.email ?? '');
  const [text, setText] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const [typed, setTyped] = useState(false);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const appendFinal = useCallback((phrase: string) => {
    setUsedVoice(true);
    setText((current) => appendPhrase(current, phrase));
  }, []);

  const speech = useSpeechRecognition({
    language: resolveSpeechLanguage({
      appLocale: locale,
      browserLanguages: globalThis.navigator?.languages ?? [],
    }),
    onFinal: appendFinal,
  });

  const mutation = useAppMutation<StoredBugReport, CreateBugReportRequest>({
    mutationFn: (input, action) =>
      createBugReport({ input, idempotencyKey: action.idempotencyKey }),
    // The panel says what went wrong itself, next to the words that are still there.
    notifyOnError: false,
    onSuccess: () => setSent(true),
  });

  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(onClose, BUG_REPORT_SENT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [sent, onClose]);

  if (sent) return <BugReportSent />;

  const interim = speech.interim.trim();
  const draft = interim ? appendPhrase(text, interim) : text;
  const canSend = draft.trim().length > 0 && !mutation.isPending;

  const send = () => {
    if (!canSend) return;
    // Words still being recognised are part of what the person said: take them now, and stop
    // the recognizer without handing them over a second time.
    if (speech.listening) speech.cancel();
    setText(draft);
    mutation.mutate({
      description: draft.trim(),
      input_method: inputMethodOf({ usedVoice: usedVoice || interim.length > 0, typed }),
      page_path: currentPagePath(),
      app_version: platformConfig.appVersion?.trim() ? platformConfig.appVersion : null,
    });
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    send();
  };

  const toggleVoice = () => {
    if (speech.listening) speech.stop();
    else speech.start();
    textareaRef.current?.focus();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="bug-report-stagger flex flex-col gap-3 p-4"
      noValidate
    >
      <BugReportHeader onClose={onClose} />
      <div
        className={cn(
          'bug-report-field border-input bg-background focus-within:border-ring focus-within:ring-ring/50 rounded-xl border transition-[border-color,box-shadow] focus-within:ring-[3px]',
        )}
        data-listening={speech.listening || undefined}
      >
        <label htmlFor={DESCRIPTION_ID} className="sr-only">
          {t(BUG_REPORT_KEYS.label)}
        </label>
        <textarea
          id={DESCRIPTION_ID}
          ref={textareaRef}
          data-testid={BUG_REPORT_TEST_IDS.description}
          value={text}
          onChange={(event) => {
            setTyped(true);
            setText(event.target.value);
          }}
          onKeyDown={onKeyDown}
          maxLength={BUG_REPORT_DESCRIPTION_MAX_LENGTH}
          placeholder={t(BUG_REPORT_KEYS.placeholder)}
          rows={4}
          disabled={mutation.isPending}
          className="bug-report-textarea placeholder:text-muted-foreground block field-sizing-content w-full resize-none bg-transparent px-3 pt-3 text-sm outline-none"
        />
        {interim ? (
          <p
            data-testid={BUG_REPORT_TEST_IDS.interim}
            aria-hidden="true"
            className="bug-report-interim px-3 pb-1 text-sm"
          >
            {interim}
          </p>
        ) : null}
        <BugReportToolbar
          speech={speech}
          onToggleVoice={toggleVoice}
          canSend={canSend}
          pending={mutation.isPending}
        />
      </div>
      {mutation.isError ? (
        <p
          data-testid={BUG_REPORT_TEST_IDS.error}
          role="alert"
          className="text-destructive text-xs"
        >
          {t(BUG_REPORT_KEYS.sendError)}
        </p>
      ) : null}
      {reporter ? (
        <p className="text-muted-foreground text-xs">
          {t(BUG_REPORT_KEYS.signedAs, { name: reporter })}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Report a bug — our own, in place of Sentry's feedback widget (iteration
 * feat-bug-report-2026-10-13-dgnx): a floating pill in the bottom-end corner that unfolds into a
 * non-modal panel with one textbox and a native voice button. The report goes to clinozy-be
 * (`POST /users/me/bug-reports`), which stamps the signed-in person from the session.
 *
 * @remarks Placement lives in `index.css` (`[data-slot='feedback-trigger']`): above the phone tab
 * bar, and out of the way of a modal, a floating "New", the upload tray and the phone consent card.
 * The motion is there too (`.bug-report-*`).
 */
export function BugReport() {
  const { t } = useTranslation(BUG_REPORT_NS);
  const [open, setOpen] = useState(false);
  const focusDescription = useCallback((event: Event) => {
    event.preventDefault();
    document.getElementById(DESCRIPTION_ID)?.focus();
  }, []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div data-slot="feedback-trigger" className="fixed z-40">
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="pill"
            variant="outline"
            data-testid={BUG_REPORT_TEST_IDS.trigger}
            data-open={open || undefined}
            className="bug-report-trigger bug-report-press bg-background/90 h-10 backdrop-blur-sm"
          >
            <Bug className="bug-report-trigger-icon" aria-hidden="true" />
            {t(BUG_REPORT_KEYS.trigger)}
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        collisionPadding={16}
        onOpenAutoFocus={focusDescription}
        data-testid={BUG_REPORT_TEST_IDS.panel}
        aria-label={t(BUG_REPORT_KEYS.title)}
        className="bug-report-panel rounded-2xl p-0 shadow-(--elevation-tray)"
      >
        <BugReportPanel onClose={close} />
      </PopoverContent>
    </Popover>
  );
}
