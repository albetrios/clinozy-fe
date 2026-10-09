import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as LeadsApiModule from '@/shared/api/clinic/leads-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import { notify } from '@/shared/notify/index.ts';

import { leadRecord } from '../../__tests__/integration/leads-test-data.ts';
import { leadDraftFields, useLeadDraft } from './useLeadDraft.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

vi.mock('@/shared/api/clinic/leads-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof LeadsApiModule>()),
  updateLead: vi.fn(),
}));

const { updateLead } = LeadsApiModule;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The hook over `lead`, re-rendered with another record by `rerender({ lead })`. */
function renderDraft(lead: LeadRecord) {
  return renderHook(({ lead: current }) => useLeadDraft(current), {
    wrapper,
    initialProps: { lead },
  });
}

beforeEach(() => {
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  vi.mocked(updateLead).mockReset();
  vi.mocked(updateLead).mockImplementation(async ({ leadId, fields }) =>
    leadRecord({ id: leadId, ...fields, updatedAt: '2026-10-03T05:00:00.000Z' }),
  );
});

describe('leadDraftFields', () => {
  it('names nothing for an untouched draft, the interests compared by value', () => {
    const lead = leadRecord({ interests: ['clinical', 'peel'] });
    expect(
      leadDraftFields(lead, {
        source: lead.source,
        interests: ['clinical', 'peel'],
        status: lead.status,
      }),
    ).toEqual({});
  });

  it('names only what changed', () => {
    const lead = leadRecord();
    expect(
      leadDraftFields(lead, {
        source: null,
        interests: ['clinical', 'others'],
        status: 'follow_up',
      }),
    ).toEqual({ source: null, interests: ['clinical', 'others'], status: 'follow_up' });
    expect(
      leadDraftFields(lead, { source: lead.source, interests: ['peel'], status: 'new' }),
    ).toEqual({ interests: ['peel'] });
  });
});

describe('useLeadDraft', () => {
  it('is dirty once a field moves, clean when it moves back, and Discard starts again', () => {
    const lead = leadRecord();
    const { result } = renderDraft(lead);
    expect(result.current.dirty).toBe(false);
    act(() => result.current.update({ status: 'contacted' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.update({ status: 'new' }));
    expect(result.current.dirty).toBe(false);

    act(() => result.current.update({ source: 'google', interests: ['lhr'] }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.discard());
    expect(result.current.dirty).toBe(false);
    expect(result.current.draft).toEqual({
      source: 'whatsapp',
      interests: ['clinical'],
      status: 'new',
    });
  });

  it('starts from the new record when another lead opens', () => {
    const { result, rerender } = renderDraft(leadRecord());
    act(() => result.current.update({ status: 'lost' }));
    rerender({
      lead: leadRecord({ id: 'lead_rhea0000000000000000', status: 'contacted' }),
    });
    expect(result.current.dirty).toBe(false);
    expect(result.current.draft.status).toBe('contacted');
  });

  it('saves the changes with the read’s updated_at, then is clean on the saved record', async () => {
    const lead = leadRecord();
    const { result, rerender } = renderDraft(lead);
    act(() =>
      result.current.update({ status: 'contacted', interests: ['clinical', 'prp'] }),
    );
    act(() => result.current.save());
    expect(result.current.saveState).toBe('saving');

    await waitFor(() => expect(result.current.saveState).toBe('idle'));
    expect(updateLead).toHaveBeenCalledTimes(1);
    expect(updateLead).toHaveBeenCalledWith({
      leadId: lead.id,
      fields: { status: 'contacted', interests: ['clinical', 'prp'] },
      expectedUpdatedAt: lead.updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).toHaveBeenCalledWith('Anaya Desai → Contacted');

    const saved = await vi.mocked(updateLead).mock.results[0]?.value;
    rerender({ lead: saved });
    expect(result.current.dirty).toBe(false);
    expect(result.current.draft.status).toBe('contacted');
  });

  it('is clean at once after a save, and the next save carries the saved updated_at', async () => {
    const lead = leadRecord();
    const { result } = renderDraft(lead);
    act(() => result.current.update({ status: 'contacted' }));
    act(() => result.current.save());
    await waitFor(() => expect(result.current.saveState).toBe('idle'));
    const saved = await vi.mocked(updateLead).mock.results[0]?.value;

    // The list's refetch has not brought the saved lead back yet: the save's answer stands for it.
    expect(result.current.dirty).toBe(false);
    act(() => result.current.update({ status: 'follow_up' }));
    act(() => result.current.save());
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(2));
    expect(vi.mocked(updateLead).mock.lastCall?.[0]).toMatchObject({
      fields: { status: 'follow_up' },
      expectedUpdatedAt: saved.updatedAt,
    });
  });

  it('keeps the draft when the save fails, and saves nothing when clean', async () => {
    vi.mocked(updateLead).mockRejectedValueOnce(new Error('connection dropped'));
    const { result } = renderDraft(leadRecord());
    act(() => result.current.save());
    expect(updateLead).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe('idle');

    act(() => result.current.update({ source: 'referral' }));
    act(() => result.current.save());
    await waitFor(() => expect(result.current.saveState).toBe('failed'));
    expect(result.current.dirty).toBe(true);
    expect(result.current.draft.source).toBe('referral');

    act(() => result.current.discard());
    expect(result.current.saveState).toBe('idle');
    expect(result.current.draft.source).toBe('whatsapp');
  });
});
