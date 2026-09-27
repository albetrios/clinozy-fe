import { type AuthMethods, resolveAuthMethods } from '@/core/config/auth-methods.ts';

/** Resolved auth-method toggles for the unified `/login` surface. */
export function useAuthMethods(): AuthMethods {
  return resolveAuthMethods();
}
