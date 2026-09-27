/**
 * TanStack Query keys for billing (plans + subscriptions). Lives beside
 * `billing-api.ts` so hooks share one namespace.
 */
/**
 * `plans` is a global catalog (not org-scoped). Everything else — the
 * subscription, invoices, and saved cards — belongs to one organization, so it
 * is keyed by `organizationId` to keep tenants from sharing a cache entry. The
 * bare `all` prefix still invalidates the whole domain.
 */
export const billingQueryKeys = {
  all: ['billing'] as const,
  plans: () => [...billingQueryKeys.all, 'plans'] as const,
  org: (organizationId: string | null) =>
    [...billingQueryKeys.all, 'org', organizationId] as const,
  subscriptions: (organizationId: string | null) =>
    [...billingQueryKeys.org(organizationId), 'subscriptions'] as const,
  activeSubscription: (organizationId: string | null) =>
    [...billingQueryKeys.org(organizationId), 'active-subscription'] as const,
  invoices: (organizationId: string | null) =>
    [...billingQueryKeys.org(organizationId), 'invoices'] as const,
  paymentMethods: (organizationId: string | null) =>
    [...billingQueryKeys.org(organizationId), 'payment-methods'] as const,
};
