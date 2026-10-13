import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));
import { apiClient } from '@/core/http/fetch-client.ts';

import { api, buildApiPath } from './api.ts';

describe('buildApiPath', () => {
  it('adds /api/v1 and fills each path parameter, encoded', () => {
    expect(
      buildApiPath('/app/leads/{lead_id}/claim', {
        lead_id: 'lead_k7x9m2pqr4w8n1v3a1b2c',
      }),
    ).toBe('/api/v1/app/leads/lead_k7x9m2pqr4w8n1v3a1b2c/claim');
    expect(buildApiPath('/tenancy/organizations/by-slug/{slug}', { slug: 'a b/c' })).toBe(
      '/api/v1/tenancy/organizations/by-slug/a%20b%2Fc',
    );
  });

  it('throws when a path parameter has no value', () => {
    expect(() => buildApiPath('/app/leads/{lead_id}', {})).toThrow(
      'no value for path parameter "lead_id"',
    );
    expect(() => buildApiPath('/app/leads/{lead_id}', { lead_id: '' })).toThrow();
  });

  it('writes the query: empty values dropped, lists comma-joined, flags and numbers as text', () => {
    expect(
      buildApiPath('/app/leads', undefined, {
        status: ['new', 'contacted'],
        q: '',
        owner_membership_id: undefined,
        branch_id: null,
        is_awaiting_reply: true,
        limit: 50,
        interests: [],
      }),
    ).toBe('/api/v1/app/leads?status=new%2Ccontacted&is_awaiting_reply=true&limit=50');
  });

  it('leaves the path bare when nothing is in the query', () => {
    expect(buildApiPath('/app/leads', undefined, { q: undefined })).toBe(
      '/api/v1/app/leads',
    );
  });
});

describe('api', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('get builds the path from params and query and answers what apiClient answers', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 'lead_x' }] });

    const answer = await api.get('/app/leads', { query: { status: 'new', limit: 50 } });

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/app/leads?status=new&limit=50');
    expect(answer).toEqual({ data: [{ id: 'lead_x' }] });
  });

  it('get takes no init when the route needs none', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    await api.get('/app/branches/my');

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/app/branches/my');
  });

  it("post sends the body and the action's idempotency key", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await api.post('/app/appointments/{appointment_id}/cancel', {
      params: { appointment_id: 'appt_x' },
      body: { cancel_reason: 'patient_asked' },
      idempotencyKey: 'action-key-0001',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/app/appointments/appt_x/cancel',
      { cancel_reason: 'patient_asked' },
      { idempotencyKey: 'action-key-0001' },
    );
  });

  it('patch and put send their bodies; without a key apiClient mints one', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });

    await api.patch('/app/leads/{lead_id}', {
      params: { lead_id: 'lead_x' },
      body: { notes: 'n' },
    });
    await api.put('/users/me/presence', { body: { presence: 'busy' } });

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/v1/app/leads/lead_x',
      { notes: 'n' },
      undefined,
    );
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/users/me/presence',
      { presence: 'busy' },
      undefined,
    );
  });

  it('delete sends the reason and the note on the query', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });

    await api.delete('/app/leads/{lead_id}', {
      params: { lead_id: 'lead_x' },
      reason: 'other',
      note: 'entered twice',
    });
    await api.delete('/app/leads/{lead_id}', {
      params: { lead_id: 'lead_y' },
      reason: 'duplicate',
    });

    expect(apiClient.delete).toHaveBeenNthCalledWith(
      1,
      '/api/v1/app/leads/lead_x?reason=other&note=entered+twice',
      undefined,
    );
    expect(apiClient.delete).toHaveBeenNthCalledWith(
      2,
      '/api/v1/app/leads/lead_y?reason=duplicate',
      undefined,
    );
  });
});
