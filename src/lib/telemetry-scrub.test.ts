import { describe, expect, it } from 'vitest';

import {
  scrubElementSelector,
  scrubEventElementText,
  scrubEventUrls,
  scrubObjectUrls,
  scrubRecordingEvent,
  scrubReplayEventUrls,
  scrubSensitiveUrl,
  scrubSpanElementText,
  scrubUiBreadcrumb,
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

describe('scrubRecordingEvent — the recording’s breadcrumb and span URLs (F-1)', () => {
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
      expect(scrubRecordingEvent(event)).toBe(event);
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
    scrubRecordingEvent(event);
    expect(event.data.payload.message).toBe('/patients?q=selector#id');
    expect(event.data.payload.href).toBe('/p');
  });
});

/**
 * What Sentry's `htmlTreeAsString` writes for a click on the screens that label an element with
 * what a patient's chart says (PatientRail, ClinicalChipCard, PatientSection, ContactQuickPick):
 * ancestors first, `tag#id.class` then `[aria-label]`, `[type]`, `[name]`, `[title]`, `[alt]`.
 */
const PATIENT = 'Priya Sharma';
const PATIENT_WORDS = /Priya|Sharma|Isotretinoin|acne|flare/;
const RAIL_CLICK = `main.flex > aside.bg-card.min-h-0.w-72[aria-label="${PATIENT}"] > div.flex > button.rounded-full[type="button"][title="Call ${PATIENT}"]`;
const CHIP_CLICK =
  'li.flex > button.flex.size-5.rounded-full[aria-label="Remove Isotretinoin 20 mg"][type="button"]';
const SECTION_CLICK = `section.grid[aria-label="${PATIENT} · Acne vulgaris"] > img.size-8[alt="${PATIENT}"]`;
const CONTACT_CLICK = `div.bg-card.h-8[title="${PATIENT}"] > input.peer[type="checkbox"][name="contact-${PATIENT}"]`;

describe('scrubElementSelector — the clicked element’s path keeps no element text', () => {
  it.each([
    [
      RAIL_CLICK,
      'main.flex > aside.bg-card.min-h-0.w-72[aria-label="[Filtered]"] > div.flex > button.rounded-full[type="button"][title="[Filtered]"]',
    ],
    [
      CHIP_CLICK,
      'li.flex > button.flex.size-5.rounded-full[aria-label="[Filtered]"][type="button"]',
    ],
    [
      SECTION_CLICK,
      'section.grid[aria-label="[Filtered]"] > img.size-8[alt="[Filtered]"]',
    ],
    [
      CONTACT_CLICK,
      'div.bg-card.h-8[title="[Filtered]"] > input.peer[type="checkbox"][name="[Filtered]"]',
    ],
  ])('%s', (path, expected) => {
    expect(scrubElementSelector(path)).toBe(expected);
  });

  it('removes a value whatever it spells — quotes, a bracket, a " > "', () => {
    const path =
      'button[aria-label="Remove "flare" ] note > acne"][type="button"][title="Priya > Sharma"]';
    const scrubbed = scrubElementSelector(path);
    expect(scrubbed).not.toMatch(PATIENT_WORDS);
    expect(scrubbed).toBe(
      'button[aria-label="[Filtered]"][type="button"][title="[Filtered]"]',
    );
  });

  it('removes a value cut off before its closing quote, to the end', () => {
    expect(scrubElementSelector(`aside.bg-card[aria-label="${PATIENT}`)).toBe(
      'aside.bg-card[aria-label="[Filtered]"]',
    );
  });

  it('keeps tags, ids, classes and type — what says which control it was', () => {
    const path = 'form#sign-in > button.w-full[type="submit"]';
    expect(scrubElementSelector(path)).toBe(path);
    expect(scrubElementSelector('<unknown>')).toBe('<unknown>');
  });
});

describe('scrubUiBreadcrumb — Sentry’s beforeBreadcrumb', () => {
  // The regression this guards: a ui.click on the patient rail sent the patient's name to Sentry.
  it('a realistic ui.click on the patient rail keeps nothing of the patient’s name', () => {
    const breadcrumb = {
      timestamp: 1_767_000_000,
      category: 'ui.click',
      message: RAIL_CLICK,
      data: { 'ui.component_name': 'PatientRail' },
    };
    const scrubbed = scrubUiBreadcrumb(breadcrumb);
    expect(scrubbed).toBe(breadcrumb);
    expect(JSON.stringify(scrubbed)).not.toMatch(PATIENT_WORDS);
    expect(scrubbed.message).toContain(
      'aside.bg-card.min-h-0.w-72[aria-label="[Filtered]"]',
    );
    expect(scrubbed.data).toEqual({ 'ui.component_name': 'PatientRail' });
  });

  it.each(['ui.click', 'ui.keyDown', 'ui.slowClickDetected', 'ui.multiClick'])(
    'scrubs a %s breadcrumb',
    (category) => {
      const breadcrumb = { category, message: CHIP_CLICK };
      expect(JSON.stringify(scrubUiBreadcrumb(breadcrumb))).not.toMatch(PATIENT_WORDS);
    },
  );

  it('replaces a ui.input message outright', () => {
    expect(
      scrubUiBreadcrumb({ category: 'ui.input', message: 'typed text' }).message,
    ).toBe('[Filtered]');
  });

  it('scrubs the attributes Session Replay copies beside a click', () => {
    const breadcrumb = {
      category: 'ui.click',
      message: RAIL_CLICK,
      data: {
        nodeId: 41,
        node: {
          id: 41,
          tagName: 'aside',
          textContent: '************',
          attributes: {
            class: 'bg-card',
            'aria-label': PATIENT,
            title: PATIENT,
            alt: PATIENT,
            name: PATIENT,
            testId: 'patient-rail',
          },
        },
      },
    };
    scrubUiBreadcrumb(breadcrumb);
    expect(JSON.stringify(breadcrumb)).not.toMatch(PATIENT_WORDS);
    expect(breadcrumb.data.node.attributes).toEqual({
      class: 'bg-card',
      'aria-label': '[Filtered]',
      title: '[Filtered]',
      alt: '[Filtered]',
      name: '[Filtered]',
      testId: 'patient-rail',
    });
  });

  it('leaves a breadcrumb that is not ui.* untouched', () => {
    const breadcrumb = { category: 'console', message: `[aria-label="${PATIENT}"]` };
    expect(scrubUiBreadcrumb(breadcrumb).message).toBe(`[aria-label="${PATIENT}"]`);
    expect(scrubUiBreadcrumb({ message: 'no category' }).message).toBe('no category');
  });
});

describe('scrubSpanElementText — ui.interaction and web-vital spans', () => {
  it('scrubs an INP span’s description and target', () => {
    const span = {
      op: 'ui.interaction.click',
      description: RAIL_CLICK,
      data: {
        'browser.web_vital.inp.target': RAIL_CLICK,
        'sentry.op': 'ui.interaction.click',
      },
    };
    expect(scrubSpanElementText(span)).toBe(span);
    expect(JSON.stringify(span)).not.toMatch(PATIENT_WORDS);
    expect(span.data['sentry.op']).toBe('ui.interaction.click');
  });

  it('leaves the description of a span that is not ui.* as it is', () => {
    const span = { op: 'http.client', description: 'GET /api/v1/app/contacts', data: {} };
    scrubSpanElementText(span);
    expect(span.description).toBe('GET /api/v1/app/contacts');
  });
});

describe('scrubEventElementText — error and transaction events', () => {
  it('scrubs breadcrumbs, child spans and the root span’s web-vital elements', () => {
    const event = {
      type: 'transaction',
      breadcrumbs: [
        { category: 'ui.click', message: CONTACT_CLICK },
        { category: 'navigation', data: { from: '/a', to: '/b' } },
      ],
      spans: [
        { op: 'ui.interaction.click', description: CHIP_CLICK, data: {} },
        { op: 'ui.webvital.lcp', description: SECTION_CLICK, data: {} },
      ],
      contexts: {
        trace: {
          op: 'pageload',
          data: { 'lcp.element': SECTION_CLICK, 'cls.source.1': RAIL_CLICK },
        },
      },
    };
    expect(scrubEventElementText(event)).toBe(event);
    expect(JSON.stringify(event)).not.toMatch(PATIENT_WORDS);
    expect(event.breadcrumbs[1]?.data).toEqual({ from: '/a', to: '/b' });
  });

  it('copes with an event that carries none of them', () => {
    const event = { contexts: { trace: 'not an object' } };
    expect(() => scrubEventElementText(event)).not.toThrow();
    expect(() => scrubEventElementText({})).not.toThrow();
  });
});

describe('scrubRecordingEvent — a recorded click’s element text', () => {
  it('scrubs the element path and copied attributes of a recorded click, with its URL', () => {
    const event = {
      type: 5,
      timestamp: 1_767_000_000_000,
      data: {
        tag: 'breadcrumb',
        payload: {
          category: 'ui.slowClickDetected',
          message: RAIL_CLICK,
          data: {
            url: 'https://app.x.dev/o/clinic/patients?q=Priya',
            node: { id: 7, tagName: 'button', attributes: { 'aria-label': PATIENT } },
          },
        },
      },
    };
    expect(scrubRecordingEvent(event)).toBe(event);
    expect(JSON.stringify(event)).not.toMatch(PATIENT_WORDS);
    expect(event.data.payload.data.url).toBe('https://app.x.dev/o/clinic/patients');
  });
});
