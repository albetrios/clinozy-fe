/**
 * PostHog event catalog — single source of truth for product analytics.
 * See `docs/integrations/posthog-frontend.md` for property schemas and dashboards.
 */
export const ANALYTICS_EVENTS = {
  /** Cookie banner accept (denied is store-only — no event). */
  consentDecision: 'analytics_consent_decision',

  /** Auth funnel */
  authEmailCodeSent: 'auth_email_code_sent',
  authEmailCodeVerified: 'auth_email_code_verified',
  authOauthStarted: 'auth_oauth_started',
  authOauthCompleted: 'auth_oauth_completed',
  /** OAuth returned to /callback but the exchange failed — the drop-off the
   *  success events alone could never show. */
  authOauthFailed: 'auth_oauth_failed',
  sessionStarted: 'session_started',
  sessionEnded: 'session_ended',

  /** Tenancy */
  organizationSwitched: 'organization_switched',
  inviteAccepted: 'invite_accepted',

  /** Product surfaces */
  onboardingCompleted: 'onboarding_completed',
  settingsSectionViewed: 'settings_section_viewed',
  commandPaletteOpened: 'command_palette_opened',
  appearanceDialogOpened: 'appearance_dialog_opened',

  /** Clinic setup (feat-clinic-setup KICKOFF §6.8) — never with patient data. */
  setupStarted: 'setup_started',
  setupStepCompleted: 'setup_step_completed',
  setupLive: 'setup_live',
  setupDeferred: 'setup_deferred',
  setupGuideItem: 'setup_guide_item',
  setupGuideHidden: 'setup_guide_hidden',
  firstAppointmentBooked: 'first_appointment_booked',
  /** "How did you hear about us?" — asked on "You're live" since /onboarding was shortened. */
  setupHeardAbout: 'setup_heard_about',

  /** Deploy / version */
  deploymentUpdateAvailable: 'deployment_update_available',
  deploymentUpdateRefreshClicked: 'deployment_update_refresh_clicked',
  deploymentUpdateDismissed: 'deployment_update_dismissed',
  deploymentUpdateRequired: 'deployment_update_required',
  deploymentUpdateRequiredReloadClicked: 'deployment_update_required_reload_clicked',

  /** Performance */
  webVital: 'web_vital',

  /** SPA navigation (hash stripped; settings hash emits `settingsSectionViewed`). */
  routeViewed: 'route_viewed',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** PostHog group type for B2B org analytics. */
export const ANALYTICS_ORG_GROUP_TYPE = 'organization';

/** Super properties registered once at init. */
export const ANALYTICS_SUPER_PROPERTIES = {
  appVersion: 'app_version',
  appBuildId: 'app_build_id',
  environment: 'environment',
} as const;
