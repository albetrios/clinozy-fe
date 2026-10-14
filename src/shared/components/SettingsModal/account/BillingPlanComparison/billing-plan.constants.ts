import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The plan comparison's namespace (`app` › `billingPlans`). Not `settings`: the English settings
 * bundle ships in the first-paint chunk, and this copy only matters inside the Settings modal,
 * which loads `app` before it opens (`SettingsModalLazy`) — the same reasoning that put the bug
 * report's copy there.
 */
export const BILLING_PLAN_NS = I18N_NAMESPACES.app;

/** The plan cards, the cycle switch's saving, the comparison table and the capability names. */
export const BILLING_PLAN_KEYS = {
  upgradeTo: 'billingPlans.upgradeTo',
  plan: {
    perMonth: 'billingPlans.plan.perMonth',
    billedYearlyTotal: 'billingPlans.plan.billedYearlyTotal',
    monthlyOnly: 'billingPlans.plan.monthlyOnly',
    freeForever: 'billingPlans.plan.freeForever',
    save: 'billingPlans.plan.save',
    saveUpTo: 'billingPlans.plan.saveUpTo',
    includes: 'billingPlans.plan.includes',
    everythingInPlus: 'billingPlans.plan.everythingInPlus',
    everythingIn: 'billingPlans.plan.everythingIn',
    audienceSolo: 'billingPlans.plan.audienceSolo',
    audienceTeam: 'billingPlans.plan.audienceTeam',
    audienceAny: 'billingPlans.plan.audienceAny',
    seatsOne: 'billingPlans.plan.seatsOne',
    seatsUpTo: 'billingPlans.plan.seatsUpTo',
    seatsUnlimited: 'billingPlans.plan.seatsUnlimited',
  },
  compare: {
    toggle: 'billingPlans.compare.toggle',
    caption: 'billingPlans.compare.caption',
    current: 'billingPlans.compare.current',
    included: 'billingPlans.compare.included',
    notIncluded: 'billingPlans.compare.notIncluded',
    notOffered: 'billingPlans.compare.notOffered',
    unlimited: 'billingPlans.compare.unlimited',
    groups: {
      pricing: 'billingPlans.compare.groups.pricing',
      team: 'billingPlans.compare.groups.team',
      features: 'billingPlans.compare.groups.features',
    },
    rows: {
      monthly: 'billingPlans.compare.rows.monthly',
      monthlyHint: 'billingPlans.compare.rows.monthlyHint',
      yearly: 'billingPlans.compare.rows.yearly',
      yearlyHint: 'billingPlans.compare.rows.yearlyHint',
      seats: 'billingPlans.compare.rows.seats',
      seatsHint: 'billingPlans.compare.rows.seatsHint',
    },
  },
  features: {
    auditLog: 'billingPlans.features.auditLog',
    auditLogHint: 'billingPlans.features.auditLogHint',
    sso: 'billingPlans.features.sso',
    ssoHint: 'billingPlans.features.ssoHint',
    prioritySupport: 'billingPlans.features.prioritySupport',
    prioritySupportHint: 'billingPlans.features.prioritySupportHint',
  },
} as const;
