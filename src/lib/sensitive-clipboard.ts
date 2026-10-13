/** Default time before clipboard is wiped after copying sensitive text. */
export const SENSITIVE_CLIPBOARD_CLEAR_MS = 60_000;

let clearTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Copy text to the clipboard, leaving it there — an id, a number, a message.
 * Resolves `true` once it is copied and `false` when the clipboard is missing
 * or refuses (an insecure context, a denied permission); never throws, so the
 * caller only picks its toast. One-time credentials use {@link copySensitiveText}.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator?.clipboard?.writeText !== 'function') return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy text to the clipboard and schedule a wipe after {@link clearAfterMs}.
 * Intended for recovery codes, TOTP secrets, and other one-time credentials.
 */
export async function copySensitiveText(
  text: string,
  options?: { clearAfterMs?: number },
): Promise<boolean> {
  const clearAfterMs = options?.clearAfterMs ?? SENSITIVE_CLIPBOARD_CLEAR_MS;

  if (!text) return false;
  if (!(await copyText(text))) return false;

  if (clearTimer) {
    clearTimeout(clearTimer);
  }

  clearTimer = setTimeout(() => {
    navigator.clipboard.writeText('').catch(() => {
      /* clipboard may be denied after tab blur — best effort only */
    });
    clearTimer = null;
  }, clearAfterMs);

  return true;
}

/** Test-only: cancel any pending clipboard wipe. */
export function cancelSensitiveClipboardClear(): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
}
