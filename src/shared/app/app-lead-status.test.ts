import { describe, expect, it } from 'vitest';

import en from '@/locales/en/app.json';
import { LEAD_STATUS_VALUES } from '@/shared/api/app/app-schema.ts';

import { appLeadStatusKey } from './app-lead-status.ts';

const label = (key: string | null) =>
  key === null
    ? null
    : key
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], en);

describe('appLeadStatusKey (leads.md:398)', () => {
  it.each([
    ['new', 'New'],
    ['contacted', 'Contacted'],
    ['follow_up', 'Follow-up'],
    ['clinic_visited', 'Clinic visited'],
    ['no_response', 'No response'],
    ['not_interested', 'Not interested'],
    ['invalid', 'Invalid'],
    ['lost', 'Lost'],
  ] as const)('labels %s "%s"', (status, expected) => {
    expect(label(appLeadStatusKey({ status, kind: 'enquiry' }))).toBe(expected);
  });

  it('labels every stored status', () => {
    for (const status of LEAD_STATUS_VALUES) {
      expect(typeof label(appLeadStatusKey({ status, kind: 'enquiry' }))).toBe('string');
    }
  });

  it('shows a re-target lead still New as "Re-targeted", and a moved one by its status', () => {
    expect(label(appLeadStatusKey({ status: 'new', kind: 'retarget' }))).toBe(
      'Re-targeted',
    );
    expect(label(appLeadStatusKey({ status: 'contacted', kind: 'retarget' }))).toBe(
      'Contacted',
    );
  });

  it('has no label for a lead without a status (a contact thread)', () => {
    expect(appLeadStatusKey({ status: null, kind: 'contact_thread' })).toBeNull();
  });
});
