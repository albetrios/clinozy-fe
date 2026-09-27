/**
 * URL search-param schema for /onboarding (consumed by routeTree's
 * `validateSearch`). `redirect` = the deep link a not-yet-onboarded user
 * originally requested (attached by the workspace guards); the finish step
 * returns them there instead of dropping the destination. Validated against
 * `isSafeRedirectPath` at consume time, mirroring /login.
 */
export interface OnboardingSearch {
  redirect?: string;
}

/** Parse `/onboarding` search params into a typed {@link OnboardingSearch}. */
export function validateOnboardingSearch(
  search: Record<string, unknown>,
): OnboardingSearch {
  return {
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  };
}
