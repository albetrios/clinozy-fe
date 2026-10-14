import { describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));
vi.mock('@/core/http/fetch-client.ts', () => ({ apiClient: { post: postMock } }));

import { createBugReport, currentPagePath } from './bug-report-api.ts';

const STORED = {
  id: 'bug_aaaaaaaaaaaaaaaaaaaaa',
  description: 'The total is wrong',
  input_method: 'voice',
  page_path: '/organization/acme/today',
  app_version: '1.13.0',
  user_id: 'usr_bbbbbbbbbbbbbbbbbbbbb',
  reporter_name: 'Asha Rao',
  organization_id: 'org_ccccccccccccccccccccc',
  created_at: '2026-10-13T10:00:00.000Z',
};

describe('bug-report-api', () => {
  it('posts the report — no name, email or user id — and parses the stored one', async () => {
    postMock.mockResolvedValue({ data: STORED });

    await expect(
      createBugReport({
        input: {
          description: '  The total is wrong ',
          input_method: 'voice',
          page_path: '/organization/acme/today',
          app_version: '1.13.0',
        },
        idempotencyKey: 'key-1',
      }),
    ).resolves.toEqual(STORED);

    expect(postMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/users\/me\/bug-reports$/),
      {
        description: 'The total is wrong',
        input_method: 'voice',
        page_path: '/organization/acme/today',
        app_version: '1.13.0',
      },
      { idempotencyKey: 'key-1' },
    );
  });

  it('refuses a blank description before any request', async () => {
    postMock.mockClear();
    await expect(
      createBugReport({
        input: {
          description: '   ',
          input_method: 'typed',
          page_path: null,
          app_version: null,
        },
      }),
    ).rejects.toThrow();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('rejects an answer that is not a stored report', async () => {
    postMock.mockResolvedValue({ data: { id: 1 } });
    await expect(
      createBugReport({
        input: {
          description: 'x',
          input_method: 'typed',
          page_path: null,
          app_version: null,
        },
      }),
    ).rejects.toThrow();
  });

  it('reports the pathname alone', () => {
    expect(currentPagePath({ pathname: '/organization/acme/patients' })).toBe(
      '/organization/acme/patients',
    );
    expect(currentPagePath({ pathname: '' })).toBe('/');
  });
});
