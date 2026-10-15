import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The plan comparison's namespace (`app` › `billingPlans`). Not `settings`: the English settings
 * bundle ships in the first-paint chunk, and this copy only matters inside the Settings modal,
 * which loads `app` before it opens (`SettingsModalLazy`) — the same reasoning that put the bug
 * report's copy there.
 */
export const BILLING_PLAN_NS = I18N_NAMESPACES.app;

/**
 * The plan cards, the cycle switch's saving, the plan picker, "Your plan", the plan-change
 * confirm, the comparison table and the capability names.
 */
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
    nextStepUp: 'billingPlans.plan.nextStepUp',
    freeFrom: 'billingPlans.plan.freeFrom',
  },
  picker: {
    title: 'billingPlans.picker.title',
    sub: 'billingPlans.picker.sub',
    compareTitle: 'billingPlans.picker.compareTitle',
    compareSub: 'billingPlans.picker.compareSub',
  },
  yourPlan: {
    adjust: 'billingPlans.yourPlan.adjust',
    upgrade: 'billingPlans.yourPlan.upgrade',
    view: 'billingPlans.yourPlan.view',
    seatsUsed: 'billingPlans.yourPlan.seatsUsed',
    seatsUsedUnlimited: 'billingPlans.yourPlan.seatsUsedUnlimited',
    noPlanLine: 'billingPlans.yourPlan.noPlanLine',
  },
  notice: {
    renews: 'billingPlans.notice.renews',
    ends: 'billingPlans.notice.ends',
    resubscribe: 'billingPlans.notice.resubscribe',
    trialEnds: 'billingPlans.notice.trialEnds',
    pastDue: 'billingPlans.notice.pastDue',
    incomplete: 'billingPlans.notice.incomplete',
  },
  confirm: {
    keep: 'billingPlans.confirm.keep',
    notNow: 'billingPlans.confirm.notNow',
    now: 'billingPlans.confirm.now',
    next: 'billingPlans.confirm.next',
    price: 'billingPlans.confirm.price',
    seats: 'billingPlans.confirm.seats',
    billedYearly: 'billingPlans.confirm.billedYearly',
    gains: 'billingPlans.confirm.gains',
    losses: 'billingPlans.confirm.losses',
    nothingLost: 'billingPlans.confirm.nothingLost',
    when: 'billingPlans.confirm.when',
    whenNow: 'billingPlans.confirm.whenNow',
    whenProrated: 'billingPlans.confirm.whenProrated',
    whenFirst: 'billingPlans.confirm.whenFirst',
    whenFirstPayment: 'billingPlans.confirm.whenFirstPayment',
    whenFree: 'billingPlans.confirm.whenFree',
    seatWarning: 'billingPlans.confirm.seatWarning',
  },
  compare: {
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
