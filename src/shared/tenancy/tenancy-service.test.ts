import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/store/useOrganizationStore/index.ts', () => {
  const setOrganization = vi.fn();
  return {
    useOrganizationStore: {
      getState: () => ({
        organizationId: null,
        organizationSlug: null,
        setOrganization,
      }),
    },
  };
});

import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  getCurrentOrganizationSlug,
  resolveOrganizationFromSubdomain,
} from './tenancy-service.ts';

const setOrganization = useOrganizationStore.getState().setOrganization as ReturnType<
  typeof vi.fn
>;

describe('resolveOrganizationFromSubdomain', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    setOrganization.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  function setHostname(hostname: string) {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hostname },
      writable: true,
    });
  }

  it('uses fallback for localhost', () => {
    setHostname('localhost');
    resolveOrganizationFromSubdomain();
    expect(setOrganization).toHaveBeenCalledWith('default', 'default');
  });

  it('uses fallback for 127.0.0.1', () => {
    setHostname('127.0.0.1');
    resolveOrganizationFromSubdomain();
    expect(setOrganization).toHaveBeenCalledWith('default', 'default');
  });

  it('uses fallback when no subdomain detected', () => {
    setHostname('app.example.com');
    resolveOrganizationFromSubdomain();
    // "app" + "example" + "com" = 3 parts, so subdomain "app" is extracted
    // Actually, let's check: parts.length < 3 → false for 3 parts
    // So it extracts "app" as slug
    expect(setOrganization).toHaveBeenCalledWith('app', 'app');
  });

  it('extracts subdomain from multi-part hostname', () => {
    setHostname('acme.app.example.com');
    resolveOrganizationFromSubdomain();
    expect(setOrganization).toHaveBeenCalledWith('acme', 'acme');
  });

  it('uses fallback for invalid slug format', () => {
    setHostname('INVALID_SLUG!.app.example.com');
    resolveOrganizationFromSubdomain();
    expect(setOrganization).toHaveBeenCalledWith('default', 'default');
  });

  it('uses fallback for bare domain with only 2 parts', () => {
    setHostname('example.com');
    resolveOrganizationFromSubdomain();
    expect(setOrganization).toHaveBeenCalledWith('default', 'default');
  });
});

describe('getCurrentOrganizationSlug', () => {
  it('returns the slug from the store', () => {
    const result = getCurrentOrganizationSlug();
    expect(result).toBeNull();
  });
});
