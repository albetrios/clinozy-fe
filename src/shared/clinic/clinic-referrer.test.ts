import { defaultParseSearch, defaultStringifySearch } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import {
  CROSS_ROOM_PARAM,
  CROSS_ROOM_ROUTES,
  crossRoomDialogOf,
  type CrossRoomLocationInput,
  crossRoomNavigation,
  isAllowedReferrer,
  PATIENT_FILE_REFERRER,
  referrerFromPath,
  safeReferrer,
  visitFlowReferrer,
  withoutCrossRoomDialog,
} from './clinic-referrer.ts';
import { PATIENT_FILE_SECTIONS } from './patient-file-sections.ts';

const PATIENT = '0b6d2f0e-5c7a-4c1e-9b2a-3d4e5f6a7b8c';
/** A lead and a booking are clinozy-be public ids; the fixture rooms' records stay UUIDs. */
const LEAD = 'lead_riya00000000000000000';
const BOOKING = 'appt_riya00000000000000000';
const INVOICE = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const ORG = '/organization/acme';

/** A location as the router parses `path` (org-relative) with `search`. */
function at(path: string, search: Record<string, unknown> = {}): CrossRoomLocationInput {
  const pathname = `${ORG}/${path}`;
  const searchStr = defaultStringifySearch(search);
  return { pathname, search, searchStr, href: `${pathname}${searchStr}` };
}

/** The search of an href, as the router parses it. */
const searchOf = (href: string) => defaultParseSearch(href.slice(href.indexOf('?')));

describe('the drawer referrer allow-list', () => {
  it.each([
    'today',
    'patients',
    `patients/${PATIENT}/invoices`,
    `patients/${PATIENT}/timeline`,
    'medical/sales',
    'payments',
    'payments/pending',
    'leads',
    `leads/${LEAD}`,
    'appointments',
    'tasks',
  ])('allows %s', (from) => {
    expect(isAllowedReferrer(from)).toBe(true);
  });

  it.each([
    '',
    '/today',
    '//evil.example',
    'https://evil.example',
    'today/../users',
    'users',
    `patients/${PATIENT}/secret`,
    `patients/${PATIENT}`,
    'patients/not-a-uuid/invoices',
    'medical',
    'today?x=1',
    'TODAY',
    `patients/${PATIENT}/timeline?visit=closed`,
    `patients/${PATIENT}/timeline?visit=open&from=leads`,
    `patients/${PATIENT}/invoices?visit=open`,
    `patients/${PATIENT}/timeline?visit=open&x=//evil.example`,
    'leads/not-a-lead',
    'leads/7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
    `leads/${LEAD}/edit`,
  ])('rejects %j', (from) => {
    expect(isAllowedReferrer(from)).toBe(false);
  });
});

describe('visitFlowReferrer (L-64)', () => {
  it('is the patient’s visit flow, Today kept as its way back — and allowed', () => {
    expect(visitFlowReferrer(PATIENT, true)).toBe(
      `patients/${PATIENT}/timeline?visit=open&from=today`,
    );
    expect(visitFlowReferrer(PATIENT, false)).toBe(
      `patients/${PATIENT}/timeline?visit=open`,
    );
    expect(isAllowedReferrer(visitFlowReferrer(PATIENT, true))).toBe(true);
    expect(isAllowedReferrer(visitFlowReferrer(PATIENT, false))).toBe(true);
  });
});

describe('PATIENT_FILE_REFERRER', () => {
  it('names exactly the patient-file sections', () => {
    const sections = /\(\?:([a-z|]+)\)/
      .exec(PATIENT_FILE_REFERRER.source)?.[1]
      ?.split('|');
    expect(sections).toEqual([...PATIENT_FILE_SECTIONS]);
  });
});

describe('safeReferrer', () => {
  it('keeps an allowed room and falls back otherwise', () => {
    expect(safeReferrer('today', 'payments')).toBe('today');
    expect(safeReferrer('//evil.example', 'payments')).toBe('payments');
    expect(safeReferrer(undefined, 'payments')).toBe('payments');
    expect(safeReferrer(42, 'payments')).toBe('payments');
  });
});

describe('referrerFromPath', () => {
  it.each([
    ['/organization/acme/today', 'today'],
    ['/organization/acme/payments/pending', 'payments/pending'],
    ['/organization/acme/medical/sales/', 'medical/sales'],
    [`/organization/acme/patients/${PATIENT}/invoices`, `patients/${PATIENT}/invoices`],
    // The lead drawer: a booking from its contact card keeps it behind (A-P1).
    [`/organization/acme/leads/${LEAD}`, `leads/${LEAD}`],
  ])('sends %s as %j', (pathname, from) => {
    expect(referrerFromPath(pathname)).toBe(from);
  });

  it.each([
    '/organization/acme/users',
    `/organization/acme/leads/${LEAD}/edit`,
    '/organization/acme',
    '/dashboard',
    '/',
  ])('sends nothing from %s', (pathname) => {
    expect(referrerFromPath(pathname)).toBeNull();
  });
});

describe('crossRoomNavigation (A-P1)', () => {
  it('leaves a drawer that is not another room’s, or names no other room, as it is', () => {
    expect(crossRoomNavigation(at('leads/create', { from: 'today' }))).toBeNull();
    expect(crossRoomNavigation(at('invoices/create', { type: 'clinic' }))).toBeNull();
    expect(crossRoomNavigation(at('invoices/create', { from: 'users' }))).toBeNull();
    expect(
      crossRoomNavigation(at('invoices/create', { from: '//evil.example' })),
    ).toBeNull();
    // Its own room already stands behind it.
    expect(crossRoomNavigation(at('invoices/create', { from: 'payments' }))).toBeNull();
    expect(crossRoomNavigation(at('payments/receive', { from: 'payments' }))).toBeNull();
    expect(
      crossRoomNavigation(at('appointments/create', { from: 'appointments' })),
    ).toBeNull();
    expect(
      crossRoomNavigation(at('medical/sales/create', { from: 'medical/sales' })),
    ).toBeNull();
    expect(crossRoomNavigation({ ...at('x'), pathname: '/dashboard' })).toBeNull();
  });

  it('opens the drawer over the page the member is on, its search and hash kept, the URL bar on the drawer', () => {
    const file = `patients/${PATIENT}/timeline`;
    const target = at('invoices/create', {
      type: 'clinic',
      patient: PATIENT,
      from: file,
    });
    const over = crossRoomNavigation(target, {
      pathname: `${ORG}/${file}`,
      search: { visit: 'open', activity: 'open' },
      hash: 'settings/account/profile',
    });
    expect(over?.mask).toEqual({ href: target.href });
    expect(over?.href.startsWith(`${ORG}/${file}?`)).toBe(true);
    expect(over?.href.endsWith('#settings/account/profile')).toBe(true);
    const search = searchOf((over?.href ?? '').split('#')[0] ?? '');
    expect(search).toEqual({
      visit: 'open',
      activity: 'open',
      [CROSS_ROOM_PARAM]: `invoices/create${target.searchStr}`,
    });
  });

  it('opens over the page `from` names, fresh, when the member is elsewhere — a deep link, a drawer of that page, another organization', () => {
    const target = at('medical/sales/create', {
      prescription: PATIENT,
      from: `patients/${PATIENT}/prescriptions`,
    });
    const fresh = `${ORG}/patients/${PATIENT}/prescriptions?${CROSS_ROOM_PARAM}=`;
    for (const current of [
      undefined,
      {
        pathname: `${ORG}/patients/${PATIENT}/prescriptions/${INVOICE}`,
        search: { q: 'x' },
      },
      { pathname: `/organization/other/patients/${PATIENT}/prescriptions`, search: {} },
    ]) {
      expect(crossRoomNavigation(target, current)?.href.startsWith(fresh)).toBe(true);
    }
  });

  it('opens a drawer the visit flow opened over the flow, which it returns into', () => {
    const flow = visitFlowReferrer(PATIENT, true);
    const target = at('medical/sales/create', { prescription: INVOICE, from: flow });
    const drawer = `medical/sales/create${target.searchStr}`;
    // From the Rx drawer: the flow, fresh.
    const fresh = crossRoomNavigation(target, {
      pathname: `${ORG}/patients/${PATIENT}/prescriptions/create`,
      search: {},
    });
    expect(fresh?.href.startsWith(`${ORG}/patients/${PATIENT}/timeline?`)).toBe(true);
    expect(searchOf(fresh?.href ?? '')).toEqual({
      visit: 'open',
      from: 'today',
      [CROSS_ROOM_PARAM]: drawer,
    });
    // On the flow itself: the page as it stands.
    const here = crossRoomNavigation(target, {
      pathname: `${ORG}/patients/${PATIENT}/timeline`,
      search: { visit: 'open', from: 'today', activity: 'open' },
    });
    expect(searchOf(here?.href ?? '')).toEqual({
      visit: 'open',
      from: 'today',
      activity: 'open',
      [CROSS_ROOM_PARAM]: drawer,
    });
  });

  it('names one drawer at a time: a new one takes the old one’s place', () => {
    const target = at(`invoices/${INVOICE}/edit`, { from: 'today' });
    const over = crossRoomNavigation(target, {
      pathname: `${ORG}/today`,
      search: { lane: 'checkout', [CROSS_ROOM_PARAM]: `invoices/${INVOICE}?from=today` },
    });
    expect(searchOf(over?.href ?? '')).toEqual({
      lane: 'checkout',
      [CROSS_ROOM_PARAM]: `invoices/${INVOICE}/edit${target.searchStr}`,
    });
  });
});

describe('crossRoomDialogOf (A-P1)', () => {
  it('reads back the drawer route the referring page names', () => {
    const target = at(`invoices/${INVOICE}/edit`, { from: `leads/${LEAD}` });
    const over = crossRoomNavigation(target, {
      pathname: `${ORG}/leads/${LEAD}`,
      search: {},
    });
    const dialog = crossRoomDialogOf(searchOf(over?.href ?? ''), 'acme');
    expect(dialog).toMatchObject({
      pathname: target.pathname,
      search: target.search,
      params: { organizationSlug: 'acme', invoiceId: INVOICE },
      href: target.href,
    });
    expect(dialog?.route.name).toBe('invoiceEdit');
  });

  const ROUTES = [
    ['appointments/create', 'appointmentCreate'],
    [`appointments/${BOOKING}`, 'appointment'],
    ['payments/receive', 'paymentReceive'],
    ['invoices/create', 'invoiceCreate'],
    [`invoices/${INVOICE}`, 'invoice'],
    [`invoices/${INVOICE}/edit`, 'invoiceEdit'],
    ['medical/sales/create', 'saleCreate'],
  ] as const;

  it('knows no booking drawer by a UUID — a booking is a public id', () => {
    expect(
      crossRoomDialogOf({ [CROSS_ROOM_PARAM]: `appointments/${INVOICE}` }, 'acme'),
    ).toBeNull();
  });

  it.each(ROUTES)('knows %s as %s', (path, name) => {
    expect(crossRoomDialogOf({ [CROSS_ROOM_PARAM]: path }, 'acme')?.route.name).toBe(
      name,
    );
  });

  it('covers every cross-room drawer route', () => {
    expect(ROUTES.map(([, name]) => name)).toEqual(
      CROSS_ROOM_ROUTES.map((route) => route.name),
    );
  });

  it('opens nothing for anything else', () => {
    for (const value of [
      undefined,
      42,
      '',
      'users/create',
      'invoices/not-an-id',
      '../today',
    ]) {
      expect(crossRoomDialogOf({ [CROSS_ROOM_PARAM]: value }, 'acme')).toBeNull();
    }
    expect(crossRoomDialogOf({ [CROSS_ROOM_PARAM]: 'payments/receive' }, '')).toBeNull();
  });

  it('drops the drawer from a page’s search, the page’s own params kept', () => {
    expect(
      withoutCrossRoomDialog({
        lane: 'checkout',
        [CROSS_ROOM_PARAM]: 'payments/receive',
      }),
    ).toEqual({ lane: 'checkout' });
  });
});
