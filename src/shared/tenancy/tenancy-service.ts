import { ORGANIZATION } from '@/core/config/constants.ts';
import { platformConfig } from '@/core/config/env.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * Seed an initial organization into the store from the current subdomain.
 *
 * Expected format: `{org-slug}.app.example.com`
 * Localhost / bare domains: Falls back to a configurable default org.
 *
 * This function is SYNCHRONOUS — no API call needed for initial resolution.
 * It only SEEDS a fallback so the derived store is never empty at bootstrap:
 * the URL path (`/organization/$organizationSlug`) is the single source of
 * truth for organization context once the route guards take over, and the
 * backend scopes context from that path — there is no tenant/organization
 * request header.
 */
export function resolveOrganizationFromSubdomain(): void {
  const hostname = window.location.hostname;

  // Localhost / IP — use fallback
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    useOrganizationStore
      .getState()
      .setOrganization(ORGANIZATION.LOCALHOST_FALLBACK, ORGANIZATION.LOCALHOST_FALLBACK);
    return;
  }

  // Extract subdomain: "acme.app.example.com" → "acme"
  const parts = hostname.split('.');
  if (parts.length < 3) {
    // No subdomain detected (e.g., "app.example.com") — seed the fallback so
    // the derived store is never empty before the URL guards take over
    if (platformConfig.debugLogging) {
      console.warn(
        '[Tenancy] No subdomain detected in hostname:',
        hostname,
        '— using fallback',
      );
    }
    useOrganizationStore
      .getState()
      .setOrganization(ORGANIZATION.LOCALHOST_FALLBACK, ORGANIZATION.LOCALHOST_FALLBACK);
    return;
  }

  const slug = parts[0]!;

  // Validate slug format to prevent header injection (bounded character class, no ReDoS risk)
  // eslint-disable-next-line security/detect-unsafe-regex -- [a-z0-9-]{0,61} is bounded, not user-controlled pattern
  const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!SLUG_RE.test(slug)) {
    if (platformConfig.debugLogging) {
      console.warn('[Tenancy] Invalid subdomain slug:', slug, '— using fallback');
    }
    useOrganizationStore
      .getState()
      .setOrganization(ORGANIZATION.LOCALHOST_FALLBACK, ORGANIZATION.LOCALHOST_FALLBACK);
    return;
  }

  // Use slug as both ID and slug initially; backend validation can enrich later
  useOrganizationStore.getState().setOrganization(slug, slug);
}

/**
 * Get the current tenant slug (convenience helper).
 */
export function getCurrentOrganizationSlug(): string | null {
  return useOrganizationStore.getState().organizationSlug;
}
