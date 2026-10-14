/** The slice of `navigator` read here — injectable for tests. */
export interface PlatformNavigator {
  userAgent: string;
  userAgentData?: { platform?: string };
}

/**
 * Whether the device is a Mac, iPhone, iPad or iPod — the keyboards whose modifier is ⌘, not Ctrl.
 * Reads User-Agent Client Hints' platform where the browser offers it, the user agent otherwise;
 * true without a `navigator` (a server render draws the Mac keys, as the shortcuts list always did).
 *
 * @param navigatorLike - The navigator to read; the browser's own by default, `null` for none.
 * @returns True on an Apple device.
 */
export function isApplePlatform(
  navigatorLike: PlatformNavigator | null = globalThis.navigator ?? null,
): boolean {
  if (!navigatorLike) return true;
  return /Mac|iPhone|iPad|iPod/i.test(
    navigatorLike.userAgentData?.platform ?? navigatorLike.userAgent,
  );
}
