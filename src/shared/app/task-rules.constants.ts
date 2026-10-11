import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type {
  TaskFollowUpWhen,
  TaskOutcomeIdOf,
  TaskRuleGroup,
  TaskSnoozeOption,
  TaskType,
} from '@/shared/api/app/tasks-contracts.ts';

/**
 * The task catalogue's copy (`src/shared/api/app/tasks-contracts.ts`) lives in the Tasks room's
 * namespace — the Rules popover, the type filter, the drawer's how-to and outcome buttons, and
 * Today's work queue (which loads `tasks` beside `today`) all read it here.
 */
export const TASK_RULES_NS = I18N_NAMESPACES.tasks;

/** One type's keys: its name, its Rules-popover line, its automation, its steps and its outcomes. */
interface TaskTypeKeySet<T extends TaskType> {
  readonly label: string;
  readonly description: string;
  /**
   * "Let Clinozy handle" — the step the server takes for a rule it can do (`can_be_automatic`:
   * confirm, feedback, payment due, regulars gone quiet; route map §4 #21); null for the others.
   */
  readonly automation: string | null;
  /** The drawer's "2 · How" steps (none for the rules the design did not draw). */
  readonly how: readonly string[];
  readonly outcomes: {
    readonly [O in TaskOutcomeIdOf<T>]: {
      readonly label: string;
      readonly effect: string;
    };
  };
}

/**
 * Keys in the `tasks` namespace for the types (`tasks.md:42–56, 314–346`), their outcomes and
 * effect lines (`tasks.md:185–227`), the Snooze options and "What’s next" When chips. Each type's
 * copy keeps the design's rule id as its key segment (`follow_up` → `rules.follow`, `call_back` →
 * `rules.unhappy`, "Follow-ups you set" → `rules.manual`, …); `{{owner}}`, `{{doctor}}` and
 * `{{first}}` interpolate names.
 */
export const TASK_RULE_KEYS = {
  groups: {
    leads: 'ruleGroups.leads',
    appointments: 'ruleGroups.appointments',
    feedback: 'ruleGroups.feedback',
    treatments: 'ruleGroups.treatments',
    patients: 'ruleGroups.patients',
    team: 'ruleGroups.team',
    payments: 'ruleGroups.payments',
    medical: 'ruleGroups.medical',
  },
  rules: {
    reply: {
      label: 'rules.reply.label',
      description: 'rules.reply.description',
      automation: null,
      how: ['rules.reply.how.first', 'rules.reply.how.second', 'rules.reply.how.third'],
      outcomes: {
        bookedVisit: {
          label: 'rules.reply.outcomes.bookedVisit.label',
          effect: 'rules.reply.outcomes.bookedVisit.effect',
        },
        notInterested: {
          label: 'rules.reply.outcomes.notInterested.label',
          effect: 'rules.reply.outcomes.notInterested.effect',
        },
        spamOrWrongNumber: {
          label: 'rules.reply.outcomes.spamOrWrongNumber.label',
          effect: 'rules.reply.outcomes.spamOrWrongNumber.effect',
        },
      },
    },
    follow_up: {
      label: 'rules.follow.label',
      description: 'rules.follow.description',
      automation: null,
      how: [
        'rules.follow.how.first',
        'rules.follow.how.second',
        'rules.follow.how.third',
      ],
      outcomes: {
        bookedVisit: {
          label: 'rules.follow.outcomes.bookedVisit.label',
          effect: 'rules.follow.outcomes.bookedVisit.effect',
        },
        callBackTomorrow: {
          label: 'rules.follow.outcomes.callBackTomorrow.label',
          effect: 'rules.follow.outcomes.callBackTomorrow.effect',
        },
        noAnswer: {
          label: 'rules.follow.outcomes.noAnswer.label',
          effect: 'rules.follow.outcomes.noAnswer.effect',
        },
        notInterested: {
          label: 'rules.follow.outcomes.notInterested.label',
          effect: 'rules.follow.outcomes.notInterested.effect',
        },
      },
    },
    claim: {
      label: 'rules.claim.label',
      description: 'rules.claim.description',
      automation: null,
      how: ['rules.claim.how.first', 'rules.claim.how.second', 'rules.claim.how.third'],
      outcomes: {
        claimIt: {
          label: 'rules.claim.outcomes.claimIt.label',
          effect: 'rules.claim.outcomes.claimIt.effect',
        },
        leaveWithOwner: {
          label: 'rules.claim.outcomes.leaveWithOwner.label',
          effect: 'rules.claim.outcomes.leaveWithOwner.effect',
        },
      },
    },
    failed_message: {
      label: 'rules.failed.label',
      description: 'rules.failed.description',
      automation: null,
      how: [
        'rules.failed.how.first',
        'rules.failed.how.second',
        'rules.failed.how.third',
      ],
      outcomes: {
        retrySend: {
          label: 'rules.failed.outcomes.retrySend.label',
          effect: 'rules.failed.outcomes.retrySend.effect',
        },
        calledInstead: {
          label: 'rules.failed.outcomes.calledInstead.label',
          effect: 'rules.failed.outcomes.calledInstead.effect',
        },
        fixTheNumber: {
          label: 'rules.failed.outcomes.fixTheNumber.label',
          effect: 'rules.failed.outcomes.fixTheNumber.effect',
        },
      },
    },
    confirm: {
      label: 'rules.confirm.label',
      description: 'rules.confirm.description',
      automation: 'rules.confirm.automation',
      how: [
        'rules.confirm.how.first',
        'rules.confirm.how.second',
        'rules.confirm.how.third',
      ],
      outcomes: {
        confirmedOnCall: {
          label: 'rules.confirm.outcomes.confirmedOnCall.label',
          effect: 'rules.confirm.outcomes.confirmedOnCall.effect',
        },
        moveToAnotherSlot: {
          label: 'rules.confirm.outcomes.moveToAnotherSlot.label',
          effect: 'rules.confirm.outcomes.moveToAnotherSlot.effect',
        },
        cancelledByPatient: {
          label: 'rules.confirm.outcomes.cancelledByPatient.label',
          effect: 'rules.confirm.outcomes.cancelledByPatient.effect',
        },
        noAnswer: {
          label: 'rules.confirm.outcomes.noAnswer.label',
          effect: 'rules.confirm.outcomes.noAnswer.effect',
        },
      },
    },
    arrive: {
      label: 'rules.arrive.label',
      description: 'rules.arrive.description',
      automation: null,
      how: [
        'rules.arrive.how.first',
        'rules.arrive.how.second',
        'rules.arrive.how.third',
      ],
      outcomes: {
        checkedIn: {
          label: 'rules.arrive.outcomes.checkedIn.label',
          effect: 'rules.arrive.outcomes.checkedIn.effect',
        },
        runningLate: {
          label: 'rules.arrive.outcomes.runningLate.label',
          effect: 'rules.arrive.outcomes.runningLate.effect',
        },
        noShow: {
          label: 'rules.arrive.outcomes.noShow.label',
          effect: 'rules.arrive.outcomes.noShow.effect',
        },
      },
    },
    rebook: {
      label: 'rules.rebook.label',
      description: 'rules.rebook.description',
      automation: null,
      how: [
        'rules.rebook.how.first',
        'rules.rebook.how.second',
        'rules.rebook.how.third',
      ],
      outcomes: {
        rebooked: {
          label: 'rules.rebook.outcomes.rebooked.label',
          effect: 'rules.rebook.outcomes.rebooked.effect',
        },
        willCallBack: {
          label: 'rules.rebook.outcomes.willCallBack.label',
          effect: 'rules.rebook.outcomes.willCallBack.effect',
        },
        notComingBack: {
          label: 'rules.rebook.outcomes.notComingBack.label',
          effect: 'rules.rebook.outcomes.notComingBack.effect',
        },
      },
    },
    feedback: {
      label: 'rules.feedback.label',
      description: 'rules.feedback.description',
      automation: 'rules.feedback.automation',
      how: [
        'rules.feedback.how.first',
        'rules.feedback.how.second',
        'rules.feedback.how.third',
      ],
      outcomes: {
        happy: {
          label: 'rules.feedback.outcomes.happy.label',
          effect: 'rules.feedback.outcomes.happy.effect',
        },
        unhappy: {
          label: 'rules.feedback.outcomes.unhappy.label',
          effect: 'rules.feedback.outcomes.unhappy.effect',
        },
        logCheckIn: {
          label: 'rules.feedback.outcomes.logCheckIn.label',
          effect: 'rules.feedback.outcomes.logCheckIn.effect',
        },
        sentTheForm: {
          label: 'rules.feedback.outcomes.sentTheForm.label',
          effect: 'rules.feedback.outcomes.sentTheForm.effect',
        },
      },
    },
    call_back: {
      label: 'rules.unhappy.label',
      description: 'rules.unhappy.description',
      automation: null,
      how: [
        'rules.unhappy.how.first',
        'rules.unhappy.how.second',
        'rules.unhappy.how.third',
      ],
      outcomes: {
        calledResolved: {
          label: 'rules.unhappy.outcomes.calledResolved.label',
          effect: 'rules.unhappy.outcomes.calledResolved.effect',
        },
        offeredReviewVisit: {
          label: 'rules.unhappy.outcomes.offeredReviewVisit.label',
          effect: 'rules.unhappy.outcomes.offeredReviewVisit.effect',
        },
      },
    },
    aftercare: {
      label: 'rules.aftercare.label',
      description: 'rules.aftercare.description',
      automation: null,
      how: [
        'rules.aftercare.how.first',
        'rules.aftercare.how.second',
        'rules.aftercare.how.third',
      ],
      outcomes: {
        logCheckIn: {
          label: 'rules.aftercare.outcomes.logCheckIn.label',
          effect: 'rules.aftercare.outcomes.logCheckIn.effect',
        },
        doingWell: {
          label: 'rules.aftercare.outcomes.doingWell.label',
          effect: 'rules.aftercare.outcomes.doingWell.effect',
        },
        noAnswer: {
          label: 'rules.aftercare.outcomes.noAnswer.label',
          effect: 'rules.aftercare.outcomes.noAnswer.effect',
        },
      },
    },
    next_visit: {
      label: 'rules.nextvisit.label',
      description: 'rules.nextvisit.description',
      automation: null,
      how: [
        'rules.nextvisit.how.first',
        'rules.nextvisit.how.second',
        'rules.nextvisit.how.third',
      ],
      outcomes: {
        bookNextVisit: {
          label: 'rules.nextvisit.outcomes.bookNextVisit.label',
          effect: 'rules.nextvisit.outcomes.bookNextVisit.effect',
        },
        setFollowUpDate: {
          label: 'rules.nextvisit.outcomes.setFollowUpDate.label',
          effect: 'rules.nextvisit.outcomes.setFollowUpDate.effect',
        },
        noFollowUpNeeded: {
          label: 'rules.nextvisit.outcomes.noFollowUpNeeded.label',
          effect: 'rules.nextvisit.outcomes.noFollowUpNeeded.effect',
        },
      },
    },
    gone_quiet: {
      label: 'rules.noreply.label',
      description: 'rules.noreply.description',
      automation: 'rules.noreply.automation',
      how: [
        'rules.noreply.how.first',
        'rules.noreply.how.second',
        'rules.noreply.how.third',
      ],
      outcomes: {
        callNow: {
          label: 'rules.noreply.outcomes.callNow.label',
          effect: 'rules.noreply.outcomes.callNow.effect',
        },
        sendOffer: {
          label: 'rules.noreply.outcomes.sendOffer.label',
          effect: 'rules.noreply.outcomes.sendOffer.effect',
        },
        notComingBack: {
          label: 'rules.noreply.outcomes.notComingBack.label',
          effect: 'rules.noreply.outcomes.notComingBack.effect',
        },
      },
    },
    by_hand: {
      label: 'rules.manual.label',
      description: 'rules.manual.description',
      automation: null,
      how: [
        'rules.manual.how.first',
        'rules.manual.how.second',
        'rules.manual.how.third',
      ],
      outcomes: {
        done: {
          label: 'rules.manual.outcomes.done.label',
          effect: 'rules.manual.outcomes.done.effect',
        },
        noAnswer: {
          label: 'rules.manual.outcomes.noAnswer.label',
          effect: 'rules.manual.outcomes.noAnswer.effect',
        },
        bookedVisit: {
          label: 'rules.manual.outcomes.bookedVisit.label',
          effect: 'rules.manual.outcomes.bookedVisit.effect',
        },
      },
    },
    payment_due: {
      label: 'rules.payment.label',
      description: 'rules.payment.description',
      automation: 'rules.payment.automation',
      how: [],
      outcomes: {
        collectAtCheckout: {
          label: 'rules.payment.outcomes.collectAtCheckout.label',
          effect: 'rules.payment.outcomes.collectAtCheckout.effect',
        },
        sendUpiLink: {
          label: 'rules.payment.outcomes.sendUpiLink.label',
          effect: 'rules.payment.outcomes.sendUpiLink.effect',
        },
        called: {
          label: 'rules.payment.outcomes.called.label',
          effect: 'rules.payment.outcomes.called.effect',
        },
      },
    },
    settle_by: {
      label: 'rules.settleBy.label',
      description: 'rules.settleBy.description',
      automation: null,
      how: [],
      outcomes: {
        done: {
          label: 'rules.settleBy.outcomes.done.label',
          effect: 'rules.settleBy.outcomes.done.effect',
        },
      },
    },
    medical_rep_visit: {
      label: 'rules.medicalRepVisit.label',
      description: 'rules.medicalRepVisit.description',
      automation: null,
      how: [],
      outcomes: {
        done: {
          label: 'rules.medicalRepVisit.outcomes.done.label',
          effect: 'rules.medicalRepVisit.outcomes.done.effect',
        },
      },
    },
  },
  snoozeOptions: {
    oneHour: 'snoozeOptions.oneHour',
    threeHours: 'snoozeOptions.threeHours',
    tomorrow: 'snoozeOptions.tomorrow',
    nextWeek: 'snoozeOptions.nextWeek',
  },
  followUpWhen: {
    inThreeHours: 'followUpWhen.inThreeHours',
    tomorrow: 'followUpWhen.tomorrow',
    inThreeDays: 'followUpWhen.inThreeDays',
    nextWeek: 'followUpWhen.nextWeek',
  },
} as const satisfies {
  readonly groups: Readonly<Record<TaskRuleGroup, string>>;
  readonly rules: { readonly [T in TaskType]: TaskTypeKeySet<T> };
  readonly snoozeOptions: Readonly<Record<TaskSnoozeOption, string>>;
  readonly followUpWhen: Readonly<Record<TaskFollowUpWhen, string>>;
};

/**
 * A task's due label in words (`tasks.md:58, 309`), in the `tasks` namespace —
 * the Tasks rows and drawer and Today's work queue word it alike
 * (`useTaskDueLabel`).
 */
export const TASK_DUE_KEYS = {
  overdue: {
    minutes: 'due.overdue.minutes',
    hours: 'due.overdue.hours',
    days: 'due.overdue.days',
  },
  soon: { minutes: 'due.soon.minutes', hours: 'due.soon.hours' },
  snoozed: 'due.snoozed',
  /** A snooze with no label of its own reads the Snoozed view's name. */
  snoozedPlain: 'groups.snoozed',
  done: 'due.done',
  doneNow: 'due.doneNow',
  doneByClinozy: 'due.doneByClinozy',
} as const;

/**
 * The work queue's words the Tasks room and Today's aside share (one task
 * model, Q-T3), in the `tasks` namespace.
 */
export const TASK_QUEUE_KEYS = {
  /** "Mine" · "Everyone". */
  scope: { mine: 'scope.mine', everyone: 'scope.everyone' },
  /** A task with no owner and no queue. */
  anyone: 'row.anyone',
  /** To do's empty line — Today's work queue shows it too (its design has none; AMBER). */
  empty: 'empty.queue',
  /**
   * An outcome on a task someone — or the rules — closed first (`409 transition_not_allowed`):
   * the task drawer's and Today's card's words.
   */
  alreadyClosed: 'toasts.alreadyClosed',
} as const;
