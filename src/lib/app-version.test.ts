import { advertisedMinimumVersion, compareReleaseVersions } from './app-version.ts';

describe('compareReleaseVersions', () => {
  it.each([
    ['1.12.0', '1.12.1'],
    ['1.12.9', '1.13.0'],
    ['1.99.99', '2.0.0'],
    ['1.9.0', '1.10.0'], // numeric, not lexical: 9 < 10
  ])('%s is older than %s', (older, newer) => {
    expect(compareReleaseVersions(older, newer)).toBeLessThan(0);
    expect(compareReleaseVersions(newer, older)).toBeGreaterThan(0);
  });

  it('is 0 for the same release', () => {
    expect(compareReleaseVersions('1.12.1', '1.12.1')).toBe(0);
  });

  it.each([
    ['', '1.0.0'],
    ['v1.12.0', '1.12.0'],
    ['1.12', '1.12.0'],
    ['1.12.0-rc.1', '1.12.0'],
    ['1.12.0', 'latest'],
  ])('has no order for a non-release version (%s vs %s)', (left, right) => {
    expect(compareReleaseVersions(left, right)).toBeNull();
  });
});

describe('advertisedMinimumVersion', () => {
  it('advertises nothing when no release is critical', () => {
    expect(advertisedMinimumVersion('1.12.0', null)).toBeUndefined();
  });

  it('advertises the floor from a build that meets it', () => {
    expect(advertisedMinimumVersion('1.12.1', '1.12.1')).toBe('1.12.1');
    expect(advertisedMinimumVersion('1.13.0', '1.12.1')).toBe('1.12.1');
  });

  it('holds the floor back on a build below it (the trunk before its release)', () => {
    expect(advertisedMinimumVersion('1.12.0', '1.12.1')).toBeUndefined();
  });

  it('holds the floor back when the build version is unknown (a local build)', () => {
    expect(advertisedMinimumVersion(undefined, '1.12.1')).toBeUndefined();
    expect(advertisedMinimumVersion('0.0.0-local', '1.12.1')).toBeUndefined();
  });

  it('fails the build on a floor that is not a release version', () => {
    expect(() => advertisedMinimumVersion('1.12.1', 'v1.12.1')).toThrow(
      /not a release version/,
    );
    expect(() => advertisedMinimumVersion(undefined, '1.12')).toThrow(
      /not a release version/,
    );
  });
});
