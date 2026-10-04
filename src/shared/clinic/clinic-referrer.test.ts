import { describe, expect, it } from 'vitest';

import {
  isAllowedReferrer,
  PATIENT_FILE_REFERRER,
  referrerFromPath,
  safeReferrer,
} from './clinic-referrer.ts';
import { PATIENT_FILE_SECTIONS } from './patient-file-sections.ts';

const PATIENT = '0b6d2f0e-5c7a-4c1e-9b2a-3d4e5f6a7b8c';

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
  ])('rejects %j', (from) => {
    expect(isAllowedReferrer(from)).toBe(false);
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
  ])('sends %s as %j', (pathname, from) => {
    expect(referrerFromPath(pathname)).toBe(from);
  });

  it.each([
    '/organization/acme/users',
    '/organization/acme/leads/0b6d2f0e-5c7a-4c1e-9b2a-3d4e5f6a7b8c',
    '/organization/acme',
    '/dashboard',
    '/',
  ])('sends nothing from %s', (pathname) => {
    expect(referrerFromPath(pathname)).toBeNull();
  });
});
