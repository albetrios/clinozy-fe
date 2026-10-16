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

/** A shortcut's keys as a key hint draws them ("⌘ ↵") and as `aria-keyshortcuts` names them. */
export interface ShortcutKeys {
  label: string;
  aria: string;
}

/**
 * One shortcut's keys for this device: the Apple keyboard's on a Mac, iPhone or iPad
 * ({@link isApplePlatform}), the other keyboards' elsewhere.
 *
 * @param keys.apple - The keys with ⌘ ("⌘ ↵", `Meta+Enter`).
 * @param keys.other - The keys with Ctrl ("Ctrl ↵", `Control+Enter`).
 * @returns The pair for this device.
 */
export function platformShortcutKeys({
  apple,
  other,
}: {
  apple: ShortcutKeys;
  other: ShortcutKeys;
}): ShortcutKeys {
  return isApplePlatform() ? apple : other;
}
