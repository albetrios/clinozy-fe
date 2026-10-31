import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  buildTrustedTypesReportOnlyPolicy,
  CSP_META_PLACEHOLDERS,
  fillCspMetaPlaceholders,
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

  it('names the build’s own bucket and Sentry ingest — no other bucket or project (F-7)', () => {
    const named = buildContentSecurityPolicy('https://api.example.com', undefined, {
      storedFilesOrigin: 'https://clinozy-files.s3.ap-south-1.amazonaws.com/',
      sentryDsn: 'https://publickey@o42.ingest.us.sentry.io/7',
    });
    expect(named).toContain(
      "img-src 'self' data: blob: https://clinozy-files.s3.ap-south-1.amazonaws.com;",
    );
    expect(named).toMatch(
      /connect-src [^;]*https:\/\/clinozy-files\.s3\.ap-south-1\.amazonaws\.com/,
    );
    expect(named).toMatch(/connect-src [^;]*https:\/\/o42\.ingest\.us\.sentry\.io/);
    expect(named).not.toContain('*.amazonaws.com');
    expect(named).not.toContain('*.sentry.io');
    expect(named).not.toContain('publickey');
  });

  it('allows no Sentry host at all without a DSN — Sentry is off', () => {
    expect(policy).not.toMatch(/sentry\.io/);
  });

  it('fills the meta placeholders exactly as the header names the same origins', () => {
    const html = `connect-src 'self'${CSP_META_PLACEHOLDERS.apiConnectSrc}${CSP_META_PLACEHOLDERS.sentryConnectSrc} x${CSP_META_PLACEHOLDERS.storedFileSrc}; img-src 'self'${CSP_META_PLACEHOLDERS.storedFileSrc};`;
    const filled = fillCspMetaPlaceholders(html, 'https://api.example.com', {
      storedFilesOrigin: 'https://b.s3.amazonaws.com',
      sentryDsn: 'https://k@o1.ingest.sentry.io/2',
    });
    expect(filled.replace(/\s+/g, ' ')).toBe(
      "connect-src 'self' https://api.example.com https://o1.ingest.sentry.io x https://b.s3.amazonaws.com; img-src 'self' https://b.s3.amazonaws.com;",
    );
    expect(fillCspMetaPlaceholders(html, undefined).replace(/\s+/g, ' ')).toBe(
      "connect-src 'self' x https://*.amazonaws.com; img-src 'self' https://*.amazonaws.com;",
    );
  });

  it('lets the browser send uploads to S3 and show stored files from it — nothing else (D86)', () => {
    expect(policy).toContain("img-src 'self' data: blob: https://*.amazonaws.com");
    expect(policy).toMatch(/connect-src [^;]*https:\/\/\*\.amazonaws\.com/);
    expect(policy).not.toMatch(/(?:script|frame|default)-src[^;]*amazonaws/);
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
