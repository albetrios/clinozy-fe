import { describe, expect, it } from 'vitest';

import type { PageManifest } from './page-manifest.ts';

describe('PageManifest', () => {
  it('accepts a minimal leaf manifest', () => {
    const manifest: PageManifest = {
      segment: 'dashboard',
      path: '/',
      title: 'Dashboard',
      testId: 'dashboard-page',
      permission: null,
      kind: 'leaf',
      children: [],
    };
    expect(manifest.children).toHaveLength(0);
  });

  it('accepts a layout manifest with child segments', () => {
    const manifest: PageManifest = {
      segment: 'organization',
      path: '/organization',
      title: 'Choose organization',
      testId: 'organization-page',
      permission: 'organization:read',
      kind: 'layout',
      children: ['members', 'billing'],
    };
    expect(manifest.children).toContain('members');
  });
});
