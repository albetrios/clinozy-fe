/**
 * Whether the browser runs on an Apple platform — the key caps then read ⌘
 * where others read Ctrl (the shortcuts list, the Rx Pad's "⌘ ↵"). Without a
 * `navigator` (a test's server render) it answers true, as the design draws ⌘.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return true;
  const uaData = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  return /Mac|iPhone|iPad|iPod/i.test(uaData?.platform ?? navigator.userAgent);
}

/** The command key's cap on this platform: ⌘ on Apple, Ctrl elsewhere. */
export function commandKeyLabel(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}
