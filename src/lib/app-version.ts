/**
 * Release versions: the stable `major.minor.patch` that release-please tags
 * (`vX.Y.Z` — prereleases never reach production) and every deploy bakes in as
 * `VITE_APP_VERSION`. Pure, so the version-json build plugin and the runtime
 * version check compare them the same way.
 */
const RELEASE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

function parseRelease(version: string): readonly [number, number, number] | null {
  const match = RELEASE_VERSION.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Orders two release versions: negative when `left` is older than `right`, `0`
 * when they are equal, positive when it is newer — `null` when either one is not
 * a release version, so an unknown order is never mistaken for an old one.
 */
export function compareReleaseVersions(left: string, right: string): number | null {
  const a = parseRelease(left);
  const b = parseRelease(right);
  if (!(a && b)) return null;
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * The `minimumVersion` a build advertises in `version.json`: the floor, but only
 * from a build that meets it. A floor committed with a critical fix is ahead of
 * the version the trunk still carries until its release (a development deploy
 * of `1.12.0` with a floor of `1.12.1`), and advertising it there would ask every
 * tab to update to a build that is itself too old. Unknown build version (a
 * local build) → nothing advertised.
 *
 * @throws When `minimum` is set but is not a release version: a typo must fail
 * the build, never quietly switch a critical update off.
 */
export function advertisedMinimumVersion(
  buildVersion: string | undefined,
  minimum: string | null,
): string | undefined {
  if (minimum === null) return undefined;
  if (!parseRelease(minimum)) {
    throw new Error(
      `MINIMUM_SUPPORTED_VERSION "${minimum}" is not a release version (major.minor.patch, e.g. 1.12.1).`,
    );
  }
  if (buildVersion === undefined) return undefined;
  const order = compareReleaseVersions(buildVersion, minimum);
  return order !== null && order >= 0 ? minimum : undefined;
}
