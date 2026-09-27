import type { ReactNode } from 'react';

import { type AccessCheck, useCan } from '@/shared/hooks/useCan/index.ts';

export interface GateProps extends AccessCheck {
  /** Rendered when the check passes. */
  children: ReactNode;
  /** Rendered when the check fails (default: nothing). */
  fallback?: ReactNode;
}

/**
 * Conditionally render `children` when the access check passes, else `fallback`.
 * UI gating is defense-in-depth — the route gates + API stay authoritative.
 */
export function Gate({ children, fallback = null, ...check }: GateProps) {
  return useCan(check) ? children : fallback;
}
