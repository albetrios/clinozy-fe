import { faker } from '@faker-js/faker';

/** Shared disposable domain — clinozy-be mail_outbox + email-code E2E accept it. */
export const E2E_EMAIL_DOMAIN = 'acme.test';

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '')
    .slice(0, 40);
}

/**
 * Unique mailbox for a single E2E run (label aids grep in mail_outbox).
 * Example: `workflow.avery42.1782634720925@acme.test`
 */
export function uniqueE2eEmail(label = 'e2e'): string {
  const local = slugifySegment(faker.internet.username());
  return `${label}.${local}.${Date.now()}@${E2E_EMAIL_DOMAIN}`;
}

/** Profile full name for onboarding / display-name fields. */
export function e2eDisplayName(): string {
  return faker.person.fullName();
}

/** Organization / workspace name for onboarding or create-org dialogs. */
export function e2eOrganizationName(): string {
  return faker.company.name();
}

/** URL-safe team org slug with optional label prefix. */
export function e2eOrganizationSlug(label = 'team'): string {
  const base = slugifySegment(faker.company.buzzNoun() || faker.word.noun());
  const suffix = faker.string.alphanumeric(6).toLowerCase();
  return slugifySegment(`${label}-${base}-${suffix}`);
}

/** Paired name + slug for team org creation (switcher or API). */
export function e2eTeamOrgProfile(opts?: {
  label?: string;
  name?: string;
  slug?: string;
}): { name: string; slug: string } {
  const slug = opts?.slug ?? e2eOrganizationSlug(opts?.label ?? 'team');
  const name = opts?.name ?? e2eOrganizationName();
  return { name, slug };
}

/** Custom RBAC role name for tenancy API E2E. */
export function e2eRoleName(): string {
  return `${faker.person.jobTitle()} ${faker.string.alphanumeric(4)}`;
}
