import { z } from 'zod';

/**
 * A registered WebAuthn passkey (FE-32). The credential itself never leaves the
 * authenticator; this is the server-side record the account can list and revoke.
 *
 * clinozy-be stores no user-chosen label for a passkey, so there is no `name`
 * here: a row is told apart by what the server does keep — whether the
 * credential syncs across devices, and when it was added.
 */
export const passkeySchema = z.object({
  /** Opaque `wac_`-prefixed public id — the one `DELETE …/credentials/{id}` accepts. */
  id: z.string(),
  /**
   * `true` when the authenticator reports a multi-device (synced) credential —
   * a password-manager or platform passkey rather than one bound to a single key.
   */
  synced: z.boolean(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export type Passkey = z.infer<typeof passkeySchema>;
