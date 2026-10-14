import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** i18next namespace for this island — matches `src/locales/en/onboarding.json`. */
export const ONBOARDING_NS = I18N_NAMESPACES.onboarding;

// ── i18n keys (stable paths — strings live in locale JSON) ───────────────────

export const ONBOARDING_KEYS = {
  manifest: { title: 'manifest.title' },
  steps: {
    welcome: { title: 'steps.welcome.title', description: 'steps.welcome.description' },
    profile: { title: 'steps.profile.title', description: 'steps.profile.description' },
    workspace: {
      title: 'steps.workspace.title',
      description: 'steps.workspace.description',
    },
    done: { title: 'steps.done.title', description: 'steps.done.description' },
  },
  welcome: { body: 'welcome.body', bodyPersonal: 'welcome.bodyPersonal' },
  profile: {
    firstNameLabel: 'profile.firstNameLabel',
    firstNamePlaceholder: 'profile.firstNamePlaceholder',
    lastNameLabel: 'profile.lastNameLabel',
    lastNamePlaceholder: 'profile.lastNamePlaceholder',
  },
  workspace: {
    organizationNameLabel: 'workspace.organizationNameLabel',
    organizationNamePlaceholder: 'workspace.organizationNamePlaceholder',
    slugLabel: 'workspace.slugLabel',
    slugPlaceholder: 'workspace.slugPlaceholder',
    urlPreview: 'workspace.urlPreview',
    slugFallback: 'workspace.slugFallback',
    slugInvalid: 'workspace.slugInvalid',
  },
  done: {
    nameLabel: 'done.nameLabel',
    organizationLabel: 'done.organizationLabel',
    emptyValue: 'done.emptyValue',
  },
  actions: {
    back: 'actions.back',
    continue: 'actions.continue',
    enterWorkspace: 'actions.enterWorkspace',
    settingUp: 'actions.settingUp',
  },
  defaults: {
    organizationName: 'defaults.organizationName',
  },
  toast: {
    finishSuccess: 'toast.finishSuccess',
    finishError: 'toast.finishError',
    profileSaveFailed: 'toast.profileSaveFailed',
  },
  session: {
    loadError: 'session.loadError',
  },
  guard: {
    title: 'guard.title',
    description: 'guard.description',
    discard: 'guard.discard',
    stay: 'guard.stay',
  },
} as const;

// ── Motion (Anime.js — first-run wizard only) ────────────────────────────────

export const ONBOARDING_MOTION = {
  /** Card shell — rare first paint only. */
  cardDurationMs: 400,
  cardOffsetY: 14,
  cardScaleFrom: 0.985,
  /** Step change — under 300ms per product motion rules. */
  stepDurationMs: 280,
  stepBodyDelayMs: 36,
  /** Never animate from opacity 0 (Strict Mode safe). */
  stepOpacityFrom: 0.94,
  stepScaleFrom: 0.992,
  /** Vertical only: forward rises, back settles upward. */
  stepOffsetYForward: 10,
  stepOffsetYBack: -5,
} as const;

// ── Test IDs ─────────────────────────────────────────────────────────────────

export const ONBOARDING_TEST_IDS = {
  page: 'onboarding-page',
  stepTitle: 'onboarding-step-title',
  back: 'onboarding-back',
  next: 'onboarding-next',
  finish: 'onboarding-finish',
  stepMotion: 'onboarding-step-motion',
  stepError: 'onboarding-step-error',
  finishError: 'onboarding-finish-error',
  contextGate: 'onboarding-context-gate',
  firstName: 'onboarding-first-name',
  lastName: 'onboarding-last-name',
  organizationName: 'onboarding-organization-name',
  organizationSlug: 'onboarding-organization-slug',
  slugError: 'onboarding-slug-error',
  urlPreview: 'onboarding-url-preview',
} as const;
