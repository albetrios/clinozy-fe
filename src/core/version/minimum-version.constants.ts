/**
 * The oldest release a browser tab may keep running — the floor of the
 * critical-update flow (`docs/reference/frontend-platform.md` → Critical updates).
 *
 * `null`: no release is critical, and every new deploy reaches open tabs through
 * the ordinary "Update available" path. Set to a release version when one must
 * not stay in use (a security fix, a clinozy-be change old tabs would break on):
 * every tab running an older version then counts down from a notice and reloads,
 * whatever the user is doing.
 *
 * To mark a release critical, set this in the PR that carries the fix to the
 * version AFTER the current release — the patch bump of
 * `.github/release-please/manifest.json` (`1.12.0` → `1.12.1`). Whatever bump
 * release-please then picks (patch, minor or major) is at least that, so the
 * release meets its own floor; until it ships, trunk builds still carry the old
 * version and advertise nothing (`advertisedMinimumVersion`). Raise it, never
 * lower it — a rollback rebuilds an older tag together with that tag's floor.
 *
 * Read only by the version-json build plugin, which writes it into
 * `version.json`; the running app reads the deployed `version.json`, never this.
 * Pinned by `tests/ci/minimum-version.policy.test.ts`.
 */
export const MINIMUM_SUPPORTED_VERSION: string | null = null;
