import { z } from 'zod';

/**
 * A registered WebAuthn passkey (FE-32). The credential itself never leaves the
 * authenticator; this is the server-side record the account can list and revoke.
 */
export const passkeySchema = z.object({
  id: z.string(),
  /** Human label — device/authenticator name, e.g. "MacBook Touch ID". */
  name: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export type Passkey = z.infer<typeof passkeySchema>;
