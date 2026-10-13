import { useSyncExternalStore } from 'react';

import type { ComposerMode } from '@/shared/api/app/messages-contracts.ts';

/**
 * A message this client has sent but the server has not accepted: "Sending…"
 * while the request runs, "Not sent" + "Retry" when it failed (KICKOFF §3.5,
 * D22). Client state, so not the Query cache: a refetch of the thread must not
 * drop it, and it waits for its Retry while the user moves between people —
 * kept in memory per person, never across a reload.
 */
export interface OutboxMessage {
  /** The client's id for the attempt, kept across retries. */
  clientId: string;
  channel: ComposerMode;
  body: string;
  /** When it was sent from here (ISO instant). */
  at: string;
  state: 'sending' | 'failed';
}

const EMPTY: readonly OutboxMessage[] = [];
const outboxes = new Map<string, readonly OutboxMessage[]>();
const listeners = new Set<() => void>();

function commit(personKey: string, next: readonly OutboxMessage[]): void {
  if (next.length) outboxes.set(personKey, next);
  else outboxes.delete(personKey);
  for (const listener of [...listeners]) listener();
}

/** One person's unsent messages, oldest first — the same array until it changes. */
export function outboxOf(personKey: string): readonly OutboxMessage[] {
  return outboxes.get(personKey) ?? EMPTY;
}

/** Add a message as it is sent. */
export function putOutbox(personKey: string, message: OutboxMessage): void {
  commit(personKey, [...outboxOf(personKey), message]);
}

/** Mark a message sending again, or failed. */
export function markOutbox(
  personKey: string,
  clientId: string,
  state: OutboxMessage['state'],
): void {
  commit(
    personKey,
    outboxOf(personKey).map((message) =>
      message.clientId === clientId ? { ...message, state } : message,
    ),
  );
}

/** Drop a message the server has accepted. */
export function dropOutbox(personKey: string, clientId: string): void {
  commit(
    personKey,
    outboxOf(personKey).filter((message) => message.clientId !== clientId),
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A person's unsent messages, re-rendering when they change. */
export function useOutbox(personKey: string): readonly OutboxMessage[] {
  return useSyncExternalStore(
    subscribe,
    () => outboxOf(personKey),
    () => EMPTY,
  );
}

/** Forget every unsent message (tests). */
export function resetOutboxes(): void {
  outboxes.clear();
  for (const listener of [...listeners]) listener();
}
