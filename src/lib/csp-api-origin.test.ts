import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  buildTrustedTypesReportOnlyPolicy,
  formatCspApiConnectSrcFragment,
  getCspConnectSrcOrigin,
} from './csp-api-origin.ts';

describe('getCspConnectSrcOrigin', () => {
  it('returns null for empty or whitespace', () => {
    expect(getCspConnectSrcOrigin(undefined)).toBeNull();
    expect(getCspConnectSrcOrigin('')).toBeNull();
    expect(getCspConnectSrcOrigin('   ')).toBeNull();
  });

  it('returns origin for https API base URL', () => {
    expect(getCspConnectSrcOrigin('https://api.example.com')).toBe(
      'https://api.example.com',
    );
    expect(getCspConnectSrcOrigin('https://api.example.com/api/v1')).toBe(
      'https://api.example.com',
    );
  });

  it('returns origin for http localhost', () => {
    expect(getCspConnectSrcOrigin('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('returns null for invalid URL', () => {
    expect(getCspConnectSrcOrigin('not-a-url')).toBeNull();
  });

  it('returns null for non-http(s) schemes', () => {
    expect(getCspConnectSrcOrigin('javascript:alert(1)')).toBeNull();
  });
});

describe('formatCspApiConnectSrcFragment', () => {
  it('returns empty string when no API URL', () => {
    expect(formatCspApiConnectSrcFragment(undefined)).toBe('');
  });

  it('returns newline-indented origin for CSP connect-src', () => {
    expect(formatCspApiConnectSrcFragment('https://api.example.com')).toBe(
      '\n               https://api.example.com',
    );
  });
});

describe('buildContentSecurityPolicy', () => {
  const policy = buildContentSecurityPolicy('https://api.example.com');

  it.each([
    "default-src 'self'",
    "script-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ])('carries the locked directive %s', (directive) => {
    expect(policy).toContain(directive);
  });

  it('adds the API origin to connect-src', () => {
    expect(policy).toContain("connect-src 'self' https://api.example.com");
  });

  it('never weakens script-src with unsafe-inline or unsafe-eval', () => {
    expect(policy).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/);
  });

  it('allowlists Cloudflare Turnstile in script-src and frame-src', () => {
    expect(policy).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(policy).toContain('frame-src https://challenges.cloudflare.com');
  });

  it('allowlists Stripe.js in script-src, frame-src, and connect-src', () => {
    expect(policy).toContain('https://js.stripe.com');
    expect(policy).toContain('https://hooks.stripe.com');
    expect(policy).toContain('https://api.stripe.com');
  });

  it('omits reporting directives when no collector is configured', () => {
    expect(policy).not.toContain('report-uri');
    expect(policy).not.toContain('report-to');
  });

  it('adds report-uri + report-to when a collector is configured', () => {
    const reported = buildContentSecurityPolicy(undefined, 'https://collect.example/csp');
    expect(reported).toContain('report-uri https://collect.example/csp');
    expect(reported).toContain('report-to csp');
  });
});

describe('buildTrustedTypesReportOnlyPolicy', () => {
  it('requires trusted types for script sinks', () => {
    expect(buildTrustedTypesReportOnlyPolicy()).toBe(
      "require-trusted-types-for 'script'",
    );
  });

  it('does not constrain policy names while reporting', () => {
    expect(buildTrustedTypesReportOnlyPolicy()).not.toContain('trusted-types ');
  });

  it('adds reporting directives when a collector is configured', () => {
    const reported = buildTrustedTypesReportOnlyPolicy('https://collect.example/csp');
    expect(reported).toContain('report-uri https://collect.example/csp');
    expect(reported).toContain('report-to csp');
  });
});
