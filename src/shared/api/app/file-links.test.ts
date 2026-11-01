import { afterEach, describe, expect, it, vi } from 'vitest';

import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  FILE_LINK_LIFETIME_MS,
  FILE_LINK_REFRESH_MS,
  FILE_LINK_REUSE_MS,
  keptFileLinkCount,
  stableFileUrl,
} from './file-links.ts';

afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
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

  it('sweeps the links past their reuse, so the kept set holds what was seen lately (G-3)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T08:00:00Z'));
    useOrganizationStore.getState().clearOrganization();
    for (let index = 0; index < 50; index += 1) {
      stableFileUrl(`swept/${index}.jpg`, `https://s3.test/${index}.jpg?sig=one`);
    }
    const before = keptFileLinkCount();
    expect(before).toBeGreaterThanOrEqual(50);

    vi.setSystemTime(new Date(Date.now() + FILE_LINK_REUSE_MS + FILE_LINK_REFRESH_MS));
    stableFileUrl('swept/fresh.jpg', 'https://s3.test/fresh.jpg?sig=one');
    expect(keptFileLinkCount()).toBe(1);
  });

  it('forgets every kept link when the clinic changes (G-3)', () => {
    useOrganizationStore.setState({ organizationId: 'org_clinic_a' });
    stableFileUrl('switch/a.jpg', 'https://s3.test/a.jpg?sig=one');
    expect(keptFileLinkCount()).toBeGreaterThan(0);

    useOrganizationStore.setState({ organizationId: 'org_clinic_b' });
    expect(keptFileLinkCount()).toBe(0);
    expect(stableFileUrl('switch/a.jpg', 'https://s3.test/a.jpg?sig=two')).toBe(
      'https://s3.test/a.jpg?sig=two',
    );
  });

  it('never shows a link past its life: kept time plus one refresh stays inside it', () => {
    expect(FILE_LINK_REUSE_MS + FILE_LINK_REFRESH_MS).toBeLessThan(FILE_LINK_LIFETIME_MS);
  });
});
