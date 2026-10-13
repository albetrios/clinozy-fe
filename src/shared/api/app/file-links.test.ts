import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FILE_LINK_LIFETIME_MS,
  FILE_LINK_REFRESH_MS,
  FILE_LINK_REUSE_MS,
  stableFileUrl,
} from './file-links.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('stableFileUrl', () => {
  it('keeps the first link while it has life left, so the browser can answer from its cache', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T08:00:00Z'));
    expect(stableFileUrl('kept/a.jpg', 'https://s3.test/a.jpg?sig=one')).toBe(
      'https://s3.test/a.jpg?sig=one',
    );
    vi.setSystemTime(new Date(Date.now() + FILE_LINK_REUSE_MS - 1));
    expect(stableFileUrl('kept/a.jpg', 'https://s3.test/a.jpg?sig=two')).toBe(
      'https://s3.test/a.jpg?sig=one',
    );
  });

  it('takes the new link once the kept one has aged out', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T08:00:00Z'));
    stableFileUrl('aged/a.jpg', 'https://s3.test/a.jpg?sig=one');
    vi.setSystemTime(new Date(Date.now() + FILE_LINK_REUSE_MS));
    expect(stableFileUrl('aged/a.jpg', 'https://s3.test/a.jpg?sig=two')).toBe(
      'https://s3.test/a.jpg?sig=two',
    );
  });

  it('gives null, and forgets the kept link, when the upload is gone', () => {
    stableFileUrl('gone/a.jpg', 'https://s3.test/a.jpg?sig=one');
    expect(stableFileUrl('gone/a.jpg', null)).toBeNull();
    expect(stableFileUrl('gone/a.jpg', 'https://s3.test/a.jpg?sig=two')).toBe(
      'https://s3.test/a.jpg?sig=two',
    );
  });

  it('never shows a link past its life: kept time plus one refresh stays inside it', () => {
    expect(FILE_LINK_REUSE_MS + FILE_LINK_REFRESH_MS).toBeLessThan(FILE_LINK_LIFETIME_MS);
  });
});
