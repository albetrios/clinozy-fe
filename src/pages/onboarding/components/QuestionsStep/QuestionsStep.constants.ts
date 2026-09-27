/** i18n keys for qualifying-question option chips (labels in `onboarding` namespace JSON). */
export const TEAM_SIZE_OPTION_KEYS = [
  'questions.teamSize.options.justMe',
  'questions.teamSize.options.twoToTen',
  'questions.teamSize.options.elevenToFifty',
  'questions.teamSize.options.fiftyOneToTwoHundred',
  'questions.teamSize.options.twoHundredPlus',
] as const;

export const USE_CASE_OPTION_KEYS = [
  'questions.useCase.options.customerManagement',
  'questions.useCase.options.teamCollaboration',
  'questions.useCase.options.analyticsReporting',
  'questions.useCase.options.internalTools',
  'questions.useCase.options.somethingElse',
] as const;

export const REFERRAL_OPTION_KEYS = [
  'questions.referral.options.search',
  'questions.referral.options.socialMedia',
  'questions.referral.options.friendOrColleague',
  'questions.referral.options.blogOrArticle',
  'questions.referral.options.other',
] as const;

export const QUESTIONS_STEP_KEYS = {
  teamSize: {
    label: 'questions.teamSize.label',
    testId: 'onboarding-team-size',
  },
  useCase: {
    label: 'questions.useCase.label',
    testId: 'onboarding-use-case',
  },
  referral: {
    label: 'questions.referral.label',
    testId: 'onboarding-referral',
  },
} as const;
