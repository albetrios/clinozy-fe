import { describe, expect, it } from 'vitest';

import {
  scrubEventUrls,
  scrubObjectUrls,
  scrubRecordingEventUrls,
  scrubReplayEventUrls,
  scrubSensitiveUrl,
} from './telemetry-scrub.ts';

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

  it('scrubs the extras and every context — the error fields extraErrorData copies (SEC-01)', () => {
    const event = {
      extra: { url: 'https://api.x.dev/api/v1/app/contacts?q=9876543210', status: 503 },
      contexts: {
        HttpError: { url: '/api/v1/app/contacts?q=9876543210', status: 503 },
        trace: {
          data: { 'browser.script.invoker': 'https://app.x.dev/patients?q=Priya' },
        },
      },
    };

    scrubEventUrls(event);

    expect(JSON.stringify(event)).not.toMatch(/9876543210|Priya/);
    expect(event.extra.url).toBe('https://api.x.dev/api/v1/app/contacts');
    expect(event.contexts.HttpError.url).toBe('/api/v1/app/contacts');
    expect(event.extra.status).toBe(503);
  });

  it('handles an event with no request and no breadcrumbs without throwing', () => {
    const event = { type: 'transaction' };
    expect(() => scrubEventUrls(event)).not.toThrow();
    expect(scrubEventUrls(event)).toBe(event);
  });
});

describe('scrubReplayEventUrls — Session Replay segments (F-1)', () => {
  it('drops the query from every page a segment visited and from its request URL', () => {
    const event = {
      type: 'replay_event',
      urls: [
        'https://app.x.dev/o/clinic/patients?q=Priya%20Shah',
        '/o/clinic/leads?q=98765',
      ],
      request: { url: 'https://app.x.dev/o/clinic/patients?q=Priya%20Shah' },
    };

    expect(scrubReplayEventUrls(event)).toBe(event);

    expect(JSON.stringify(event)).not.toMatch(/Priya|98765/);
    expect(event.urls).toEqual([
      'https://app.x.dev/o/clinic/patients',
      '/o/clinic/leads',
    ]);
    expect(event.request.url).toBe('https://app.x.dev/o/clinic/patients');
  });

  it('leaves an event that is not a replay segment as it is — beforeSend owns those', () => {
    const event = { request: { url: 'https://app.x.dev/patients?q=Priya' } };
    scrubReplayEventUrls(event);
    expect(event.request.url).toBe('https://app.x.dev/patients?q=Priya');
  });

  it('copes with a segment that names no page', () => {
    const event = { type: 'replay_event' };
    expect(() => scrubReplayEventUrls(event)).not.toThrow();
  });
});

describe('scrubRecordingEventUrls — the recording’s breadcrumbs and spans (F-1)', () => {
  it('drops the query from a navigation breadcrumb, a span and a click breadcrumb', () => {
    const navigation = {
      type: 5,
      data: {
        tag: 'breadcrumb',
        payload: {
          category: 'navigation',
          data: { from: '/o/clinic/patients?q=Priya', to: '/o/clinic/leads?q=98765' },
        },
      },
    };
    const span = {
      type: 5,
      data: {
        tag: 'performanceSpan',
        payload: {
          op: 'resource.fetch',
          description: 'https://api.x.dev/api/v1/app/contacts?q=98765',
          data: { request: { url: 'https://api.x.dev/api/v1/app/contacts?q=98765' } },
        },
      },
    };
    const click = {
      type: 5,
      data: {
        tag: 'breadcrumb',
        payload: {
          category: 'ui.multiClick',
          data: { url: 'https://app.x.dev/a?q=Priya' },
        },
      },
    };

    for (const event of [navigation, span, click]) {
      expect(scrubRecordingEventUrls(event)).toBe(event);
      expect(JSON.stringify(event)).not.toMatch(/Priya|98765/);
    }
    expect(navigation.data.payload.data.to).toBe('/o/clinic/leads');
    expect(span.data.payload.description).toBe('https://api.x.dev/api/v1/app/contacts');
  });

  it('rewrites only URL fields — a message or recorded text with a "/" stays whole', () => {
    const event = {
      type: 5,
      data: {
        tag: 'breadcrumb',
        payload: {
          category: 'ui.click',
          message: '/patients?q=selector#id',
          href: '/p?q=1',
        },
      },
    };
    scrubRecordingEventUrls(event);
    expect(event.data.payload.message).toBe('/patients?q=selector#id');
    expect(event.data.payload.href).toBe('/p');
  });
});
