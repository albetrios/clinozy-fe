/*
 * The messaging domain's query keys. Every chat column reads a contact's
 * stream on clinozy-be (`contact-activities-api.ts`); the fixture world's
 * lead and patient threads are test support only
 * (`fixtures/chat.fixtures.ts`), never imported by shipped code —
 * `pnpm build:check` fails a build that carries a fixture chunk.
 */

/** TanStack Query keys for the messaging domain, per person (`chatPersonKey`). */
export const messageQueryKeys = {
  all: ['app', 'messages'] as const,
  thread: (personKey: string) => [...messageQueryKeys.all, 'thread', personKey] as const,
  templateValues: (personKey: string) =>
    [...messageQueryKeys.all, 'template-values', personKey] as const,
  status: () => [...messageQueryKeys.all, 'status'] as const,
  /** clinozy-be's messaging status — a contact's chat (`contact-activities-api.ts`). */
  liveStatus: () => [...messageQueryKeys.status(), 'live'] as const,
};

/**
 * The reads a send can change besides the thread, by the `['app', <domain>]`
 * prefix each room keeps its queries under: the lead (status, last touch,
 * involved people, unread — the Leads room and drawer), the rule tasks a reply
 * closes (Tasks, Today) and a patient's new contact thread.
 */
export const MESSAGE_SIDE_EFFECT_KEYS = [
  ['app', 'leads'],
  ['app', 'tasks'],
  ['app', 'contact-threads'],
] as const;
