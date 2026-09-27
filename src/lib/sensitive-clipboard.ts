/** Default time before clipboard is wiped after copying sensitive text. */
export const SENSITIVE_CLIPBOARD_CLEAR_MS = 60_000;

let clearTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Copy text to the clipboard and schedule a wipe after {@link clearAfterMs}.
 * Intended for recovery codes, TOTP secrets, and other one-time credentials.
 */
export async function copySensitiveText(
  text: string,
  options?: { clearAfterMs?: number },
): Promise<boolean> {
  const clearAfterMs = options?.clearAfterMs ?? SENSITIVE_CLIPBOARD_CLEAR_MS;

  if (!text || typeof navigator?.clipboard?.writeText !== 'function') {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return false;
  }

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
