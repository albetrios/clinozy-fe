import { describe, expect, it } from 'vitest';

import { scrubEventUrls, scrubObjectUrls, scrubSensitiveUrl } from './telemetry-scrub.ts';

describe('scrubSensitiveUrl — single-use secrets', () => {
  it('drops ?token= with the rest of the query', () => {
    expect(
      scrubSensitiveUrl('https://app.example.com/reset-password?token=sec-123&a=1'),
    ).toBe('https://app.example.com/reset-password');
  });

  it('drops the Stripe client secrets the billing return carries', () => {
    expect(
      scrubSensitiveUrl(
        'https://app.example.com/organization/acme/dashboard?payment_intent_client_secret=pi_3ABC_secret_xyz&redirect_status=succeeded',
      ),
    ).toBe('https://app.example.com/organization/acme/dashboard');
    expect(
      scrubSensitiveUrl('/dashboard?setup_intent_client_secret=seti_1_secret_2#settings'),
    ).toBe('/dashboard');
  });

  it('drops the name and phone a create drawer carries (S:23, S:31)', () => {
    expect(
      scrubSensitiveUrl(
        'https://app.test/organization/acme/leads/create?name=Rhea%20Shah&phone=%2B919876543210&source=whatsapp',
      ),
    ).toBe('https://app.test/organization/acme/leads/create');
  });

  it('leaves a URL with no query or fragment unchanged', () => {
    const url = '/organization/org_1/dashboard';
    expect(scrubSensitiveUrl(url)).toBe(url);
  });
});

// SEC-01: what a person typed or was sent lives in the query — telemetry keeps the path only.
describe('scrubSensitiveUrl — nothing after the path leaves (SEC-01)', () => {
  const ORG = 'https://app.test/organization/acme';
  it.each([
    [`${ORG}/patients?q=Priya%20Sharma`, `${ORG}/patients`],
    [`${ORG}/patients?view=follow&q=%2B919876543210&sort=seq:desc`, `${ORG}/patients`],
    [`${ORG}/leads?q=C-12345`, `${ORG}/leads`],
    [`${ORG}/appointments?view=day&q=%232371`, `${ORG}/appointments`],
    [`${ORG}/payments/pending?q=Rhea`, `${ORG}/payments/pending`],
    [`${ORG}/tasks?q=Rhea`, `${ORG}/tasks`],
    [`${ORG}/stock?q=Rhea`, `${ORG}/stock`],
    [
      `${ORG}/patients/pat_1/prescriptions/create?medicines=Isotretinoin`,
      `${ORG}/patients/pat_1/prescriptions/create`,
    ],
    ['/login?redirect=%2Forganization%2Facme%2Fpatients%3Fq%3DPriya', '/login'],
    [`${ORG}/patients#q=Priya`, `${ORG}/patients`],
    ['/reset-password?token=sec-123', '/reset-password'],
  ])('%s → %s', (input, expected) => {
    expect(scrubSensitiveUrl(input)).toBe(expected);
  });

  it('leaves strings that are not URLs alone', () => {
    expect(scrubSensitiveUrl('$direct')).toBe('$direct');
    expect(scrubSensitiveUrl('Why? Because.')).toBe('Why? Because.');
  });

  it('scrubs URLs inside arrays and nested objects in place', () => {
    const props: Record<string, unknown> = {
      $current_url: `${ORG}/patients?q=Priya`,
      $session_entry_url: '/login?redirect=%2Fx%3Fq%3DPriya',
      nested: { list: [`${ORG}/leads?q=Priya`, 'plain'] },
    };
    scrubObjectUrls(props);
    expect(JSON.stringify(props)).not.toContain('Priya');
    expect(props.$current_url).toBe(`${ORG}/patients`);
  });
});

describe('scrubObjectUrls', () => {
  it('scrubs flat and nested string values', () => {
    const props: Record<string, unknown> = {
      $current_url: 'https://x.dev/reset-password?token=abc',
      $set_once: { $initial_current_url: 'https://x.dev/verify-email?token=xyz' },
      count: 3,
    };

    scrubObjectUrls(props);

    expect(props.$current_url).toBe('https://x.dev/reset-password');
    expect((props.$set_once as Record<string, unknown>).$initial_current_url).toBe(
      'https://x.dev/verify-email',
    );
    expect(props.count).toBe(3);
  });
});

describe('scrubEventUrls', () => {
  it('scrubs request.url and breadcrumb data on a Sentry-shaped event', () => {
    const event = {
      request: { url: 'https://x.dev/reset-password?token=abc' },
      breadcrumbs: [
        { data: { from: '/login', to: '/reset-password?token=abc' } },
        { data: undefined },
      ],
    };

    const out = scrubEventUrls(event);

    expect(out).toBe(event); // in place, same reference back to Sentry
    expect(out.request.url).toBe('https://x.dev/reset-password');
    expect(out.breadcrumbs[0]?.data?.to).toBe('/reset-password');
    expect(out.breadcrumbs[0]?.data?.from).toBe('/login');
  });

  it('handles an event with no request and no breadcrumbs without throwing', () => {
    const event = { type: 'transaction' };
    expect(() => scrubEventUrls(event)).not.toThrow();
    expect(scrubEventUrls(event)).toBe(event);
  });
});
