import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  fetchContactMessagingStatus,
  fetchContactTemplateValues,
  fetchContactThread,
  resendContactActivity,
  sendContactActivity,
} from '@/shared/api/app/contact-activities-api.ts';
import { contactQueryKeys } from '@/shared/api/app/contacts-api.ts';
import {
  MESSAGE_SIDE_EFFECT_KEYS,
  messageQueryKeys,
} from '@/shared/api/app/messages-api.ts';
import {
  type ChatMessage,
  type ChatPerson,
  chatPersonKey,
  type ChatThreadRead,
  type ComposerMode,
} from '@/shared/api/app/messages-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';

import {
  dropOutbox,
  markOutbox,
  type OutboxMessage,
  outboxOf,
  putOutbox,
  useOutbox,
} from './thread-outbox.ts';

/**
 * A contact's stream on clinozy-be (`/app/contacts/:contact_id/activities`) — its messages
 * oldest first and their authors (`getLead`, `S:1589`). The stream has no thread record of its
 * own (`thread: null`): the host passes the lead it shows the chat for.
 */
export function useThread(person: ChatPerson) {
  return useAppQuery({
    queryKey: messageQueryKeys.thread(chatPersonKey(person)),
    queryFn: () => fetchContactThread(person.contactId),
    // The chat column shows this failure in place (RetryError), not in a toast.
    notifyOnError: false,
  });
}

/**
 * Whether WhatsApp is down (Q-L10) and whether a messaging service delivers the thread — not yet
 * (backend D87: no request, every message waits `queued`). Fresh for a minute, then read again on
 * the next mount or focus.
 */
export function useMessagingStatus() {
  return useAppQuery({
    queryKey: messageQueryKeys.liveStatus(),
    queryFn: fetchContactMessagingStatus,
    staleTime: 60_000,
    // An unknown status shows no outage line — the composer still sends.
    notifyOnError: false,
  });
}

/**
 * Queue one message on a contact's stream from outside the chat — the Payment received view's
 * review ask (`feat-payment-celebration` D12): the same `send-message` the composer posts, so it
 * joins their thread (read again) and their stream; clinozy-be queues it in its outbox. A
 * failure is the caller's to show (no toast).
 */
export function useQueueContactMessage(contactId: string) {
  const threadKey = messageQueryKeys.thread(
    chatPersonKey({ kind: 'contact', contactId }),
  );
  return useAppMutation<ChatMessage, { channel: ComposerMode; body: string }>({
    mutationFn: ({ channel, body }, action) =>
      sendContactActivity({ contactId, channel, body, ...action }),
    invalidateKeys: [threadKey, ...MESSAGE_SIDE_EFFECT_KEYS, contactQueryKeys.all],
    notifyOnError: false,
  });
}

/** The clinic's name, branch address and links and the free slots the composer fills in. */
export function useTemplateValues(person: ChatPerson) {
  return useAppQuery({
    queryKey: messageQueryKeys.templateValues(chatPersonKey(person)),
    queryFn: fetchContactTemplateValues,
  });
}

/** A person's messages sent from here and not accepted yet: "Sending…" or "Not sent". */
export function useThreadOutbox(person: ChatPerson): readonly OutboxMessage[] {
  return useOutbox(chatPersonKey(person));
}

interface SendVars {
  clientId: string;
  channel: ComposerMode;
  body: string;
}

/**
 * Send on a contact's stream (`sendMessage`, `S:1595`, optimistic): the message
 * shows at once as "Sending…", joins the thread when the server accepts it,
 * and turns "Not sent" with a Retry when it fails — never a toast. The send
 * finishes even if the column moves to another person meanwhile; `onSent` runs
 * once the server has taken it (the task drawer reads its task again after the
 * rules run, D81 T7).
 */
export function useSendMessage(
  person: ChatPerson,
  { onSent }: { onSent?: () => void } = {},
) {
  const queryClient = useQueryClient();
  const personKey = chatPersonKey(person);
  const { mutate } = useAppMutation<ChatMessage, SendVars>({
    mutationFn: ({ channel, body }, action) =>
      sendContactActivity({ contactId: person.contactId, channel, body, ...action }),
    // A failed send is told on its bubble ("Not sent" + "Retry"), not in a toast.
    notifyOnError: false,
  });

  const deliver = useCallback(
    (message: OutboxMessage) => {
      const threadKey = messageQueryKeys.thread(personKey);
      mutate(
        { clientId: message.clientId, channel: message.channel, body: message.body },
        {
          onSuccess: (sent) => {
            // Into the thread first, then out of the outbox — no frame without it.
            queryClient.setQueryData<ChatThreadRead>(threadKey, (read) => ({
              thread: read?.thread ?? null,
              messages: [...(read?.messages ?? []), sent],
              authors: read?.authors ?? {},
            }));
            dropOutbox(personKey, message.clientId);
            void queryClient.invalidateQueries({ queryKey: threadKey });
            for (const queryKey of [...MESSAGE_SIDE_EFFECT_KEYS, contactQueryKeys.all]) {
              void queryClient.invalidateQueries({ queryKey });
            }
            onSent?.();
          },
          onError: () => markOutbox(personKey, message.clientId, 'failed'),
        },
      );
    },
    [mutate, personKey, queryClient, onSent],
  );

  /** Send a message; blank text sends nothing. */
  const send = useCallback(
    (channel: ComposerMode, body: string) => {
      const text = body.trim();
      if (!text) return;
      const message: OutboxMessage = {
        clientId: crypto.randomUUID(),
        channel,
        body: text,
        at: new Date().toISOString(),
        state: 'sending',
      };
      putOutbox(personKey, message);
      deliver(message);
    },
    [deliver, personKey],
  );

  /** Send a "Not sent" message again. */
  const retry = useCallback(
    (clientId: string) => {
      const message = outboxOf(personKey).find(
        (candidate) => candidate.clientId === clientId,
      );
      if (message?.state !== 'failed') return;
      markOutbox(personKey, clientId, 'sending');
      deliver(message);
    },
    [deliver, personKey],
  );

  return { send, retry };
}

/**
 * Resend a message its provider could not deliver ("Not sent" on a stored
 * message) on clinozy-be (`…/resend`). The thread refetches when it is queued
 * again.
 */
export function useResendMessage(person: ChatPerson) {
  return useAppMutation<ChatMessage, string>({
    mutationFn: (messageId, action) =>
      resendContactActivity({
        contactId: person.contactId,
        activityId: messageId,
        ...action,
      }),
    invalidateKeys: [messageQueryKeys.thread(chatPersonKey(person))],
  });
}
