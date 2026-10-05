import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { VisitCheck } from '@/shared/api/clinic/visits-contracts.ts';

/** The visit flow reads the patient file's namespace. */
export const VISIT_FLOW_NS = I18N_NAMESPACES.patientFile;

/** The five steps, in their fixed order (`patient-file.md:394`). */
export const VISIT_FLOW_STEPS = [
  'checks',
  'rx',
  'treatment',
  'invoice',
  'collect',
] as const;
/** One step. */
export type VisitFlowStep = (typeof VISIT_FLOW_STEPS)[number];

/**
 * The patient file's visit flow (KICKOFF §6.6 Visit flow; `patient-file.md:92–101,
 * 392–404`; H:758–768, H:4871–4898), verbatim.
 */
export const VISIT_FLOW_KEYS = {
  pill: 'visitFlow.pill',
  lead: 'visitFlow.lead',
  pause: 'visitFlow.pause',
  complete: 'visitFlow.complete',
  /** The end toast's parts, each only when it happened: "Visit completed · …". */
  completed: 'visitFlow.completed',
  packageUsed: 'visitFlow.packageUsed',
  followUp: 'visitFlow.followUp',
  loading: 'visitFlow.loading',
  steps: {
    checks: 'visitFlow.steps.checks',
    rx: 'visitFlow.steps.rx',
    treatment: 'visitFlow.steps.treatment',
    invoice: 'visitFlow.steps.invoice',
    collect: 'visitFlow.steps.collect',
  } satisfies Record<VisitFlowStep, string>,
  checks: {
    labels: {
      consent: 'visitFlow.checks.labels.consent',
      photos: 'visitFlow.checks.labels.photos',
      allergies: 'visitFlow.checks.labels.allergies',
    } satisfies Record<VisitCheck, string>,
    hints: {
      consent: 'visitFlow.checks.hints.consent',
      photos: 'visitFlow.checks.hints.photos',
      allergies: 'visitFlow.checks.hints.allergies',
    } satisfies Record<VisitCheck, string>,
    /** "2 checks left" (plural). */
    left: 'visitFlow.checks.left',
    done: 'visitFlow.checks.done',
  },
  rx: {
    /** "⚡ Hair fall kit". */
    kit: 'visitFlow.rx.kit',
    write: 'visitFlow.rx.write',
    empty: 'visitFlow.rx.empty',
    /** Toast: "Hair fall kit prescribed". */
    prescribed: 'visitFlow.rx.prescribed',
  },
  treatment: {
    /** "⚡ Repeat · LHR Full Face · session 2". */
    repeat: 'visitFlow.treatment.repeat',
    new: 'visitFlow.treatment.new',
    memo: 'visitFlow.treatment.memo',
    /** "Uses 1 session of LHR Full Face · B4G7". */
    pack: 'visitFlow.treatment.pack',
    blocked: 'visitFlow.treatment.blocked',
    empty: 'visitFlow.treatment.empty',
    last: 'visitFlow.treatment.last',
    /** "LHR Full Face · session 2". */
    done: 'visitFlow.treatment.done',
    /** Toast: "Session 2 recorded with last settings". */
    repeated: 'visitFlow.treatment.repeated',
  },
  invoice: {
    total: 'visitFlow.invoice.total',
    create: 'visitFlow.invoice.create',
    custom: 'visitFlow.invoice.custom',
    /** Toast: "Invoice #1043 created from the visit". */
    created: 'visitFlow.invoice.created',
    nothing: 'visitFlow.invoice.nothing',
    /** "2 items ready · ₹6,250" (plural). */
    ready: 'visitFlow.invoice.ready',
    covered: 'visitFlow.invoice.covered',
    empty: 'visitFlow.invoice.empty',
    /** "#1043 · ₹6,250". */
    done: 'visitFlow.invoice.done',
  },
  collect: {
    /** "Collect ₹1,500 · UPI". */
    upi: 'visitFlow.collect.upi',
    /** Toast: "₹1,500 received by UPI". */
    received: 'visitFlow.collect.received',
    share: 'visitFlow.collect.share',
    /** Toast: "Rx, invoice and photos sent to Dharti Galani on WhatsApp". */
    shared: 'visitFlow.collect.shared',
    /** "₹1,500 due". */
    due: 'visitFlow.collect.due',
    nothing: 'visitFlow.collect.nothing',
    sent: 'visitFlow.collect.sent',
  },
} as const;

/** The flow's test ids (`docs/reference/e2e-testids-inventory.md` › Patient file visit flow). */
export const VISIT_FLOW_TEST_IDS = {
  root: 'visit-flow',
  pause: 'visit-flow-pause',
  complete: 'visit-flow-complete',
  step: (step: VisitFlowStep) => `visit-flow-step-${step}`,
  check: (check: VisitCheck) => `visit-flow-check-${check}`,
  kit: 'visit-flow-kit',
  writeRx: 'visit-flow-write-rx',
  repeat: 'visit-flow-repeat',
  newTreatment: 'visit-flow-new-treatment',
  createInvoice: 'visit-flow-create-invoice',
  customInvoice: 'visit-flow-custom-invoice',
  collect: (mode: string) => `visit-flow-collect-${mode}`,
  share: 'visit-flow-share',
} as const;
