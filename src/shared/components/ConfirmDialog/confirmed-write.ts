/** How many confirms are running their write right now. */
let running = 0;

/**
 * Run a confirm's write — its `onConfirm`, and whatever that starts on the
 * way, such as a drawer closing because its record was just deleted,
 * cancelled or voided. That exit is the answer the user already gave, so the
 * unsaved-changes guard lets it through rather than ask "Discard changes?"
 * after it (L-64: one confirm, never two).
 */
export async function runConfirmedWrite<T>(write: () => T | Promise<T>): Promise<T> {
  running += 1;
  try {
    return await write();
  } finally {
    running -= 1;
  }
}

/** Whether a confirm is running its write — an exit it starts is not asked about again. */
export function isConfirmedWriteRunning(): boolean {
  return running > 0;
}
