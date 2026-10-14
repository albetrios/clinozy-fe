import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The clinic shell's namespace (`app` › `bugReport`), like the other shared clinic surfaces —
 * fetched with the widget's chunk (`BugReportLazy`). Not a namespace of its own: every namespace
 * adds a loader per language to the entry chunk (iteration feat-bug-report-2026-10-13-dgnx).
 */
export const BUG_REPORT_NS = I18N_NAMESPACES.app;

/** The trigger, the panel, the voice button and the send states. */
export const BUG_REPORT_KEYS = {
  trigger: 'bugReport.trigger',
  title: 'bugReport.panel.title',
  subtitle: 'bugReport.panel.subtitle',
  label: 'bugReport.panel.label',
  placeholder: 'bugReport.panel.placeholder',
  signedAs: 'bugReport.panel.signedAs',
  close: 'bugReport.panel.close',
  voiceStart: 'bugReport.voice.start',
  voiceStop: 'bugReport.voice.stop',
  voiceListening: 'bugReport.voice.listening',
  voiceHearing: 'bugReport.voice.hearing',
  voiceDenied: 'bugReport.voice.denied',
  voiceNoSpeech: 'bugReport.voice.noSpeech',
  voiceUnavailable: 'bugReport.voice.unavailable',
  send: 'bugReport.send.idle',
  sending: 'bugReport.send.sending',
  sent: 'bugReport.send.sent',
  sendError: 'bugReport.send.error',
} as const;

/** Test ids — `data-testid` on the trigger, the panel and its controls. */
export const BUG_REPORT_TEST_IDS = {
  trigger: 'bug-report-trigger',
  panel: 'bug-report-panel',
  description: 'bug-report-description',
  voice: 'bug-report-voice',
  voiceStatus: 'bug-report-voice-status',
  interim: 'bug-report-interim',
  send: 'bug-report-send',
  error: 'bug-report-error',
  sent: 'bug-report-sent',
  close: 'bug-report-close',
} as const;

/** How long the drawn check shows before the panel folds itself away. */
export const BUG_REPORT_SENT_HOLD_MS = 1600;

/** Bars in the voice-activity meter. */
export const BUG_REPORT_VOICE_BAR_COUNT = 5;
