import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  fetchContactMessagingStatus,
  fetchContactTemplateValues,
  fetchContactThread,
  resendContactActivity,
  sendContactActivity,
} from '@/shared/api/app/contact-activities-api.ts';
import { ensureContactThread } from '@/shared/api/app/contact-threads-api.ts';
import { contactQueryKeys } from '@/shared/api/app/contacts-api.ts';
import {
  chatThreadOf,
  fetchContactHistory,
  fetchMessagingStatus,
  fetchTemplateValues,
  fetchThread,
  MESSAGE_SIDE_EFFECT_KEYS,
  messageQueryKeys,
  resendMessage,
  sendMessage,
} from '@/shared/api/app/messages-api.ts';
import {
  type ChatMessage,
  type ChatPerson,
  chatPersonKey,
  type ChatThread,
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
 * A person's thread — a fixture lead's or patient's, or a contact's stream on clinozy-be
 * (`/app/contacts/:contact_id/activities`) — with its messages oldest first and their
 * authors (`getLead`, `S:1589`). A patient without a thread, and a contact, read as
 * `thread: null`.
 */
export function useThread(person: ChatPerson) {
  return useAppQuery({
    queryKey: messageQueryKeys.thread(chatPersonKey(person)),
    queryFn: () =>
      person.kind === 'contact'
        ? fetchContactThread(person.contactId)
        : fetchThread(person),
    // The chat column shows this failure in place (RetryError), not in a toast.
    notifyOnError: false,
  });
}

/**
 * A fixture person's contact history, oldest first — merged into the thread as system chips. A
 * contact's history is in its stream already (the server's `system` entries): none here.
 */
export function useContactHistory(person: ChatPerson) {
  return useAppQuery({
    queryKey: messageQueryKeys.history(chatPersonKey(person)),
    queryFn: () => fetchContactHistory(person),
    enabled: person.kind !== 'contact',
  });
}

/**
 * Whether WhatsApp is down (Q-L10) and whether a messaging service delivers the thread — for a
 * contact, not yet (backend D87: no request, every message waits `queued`); the fixture's switch
 * otherwise. Fresh for a minute, then read again on the next mount or focus.
 */
export function useMessagingStatus(person: ChatPerson) {
  const live = person.kind === 'contact';
  return useAppQuery({
    queryKey: live ? messageQueryKeys.liveStatus() : messageQueryKeys.status(),
    queryFn: live ? fetchContactMessagingStatus : fetchMessagingStatus,
    staleTime: 60_000,
    // An unknown status shows no outage line — the composer still sends.
    notifyOnError: false,
  });
}

/** The clinic's name, branch address and links and the free slots the composer fills in. */
export function useTemplateValues(person: ChatPerson) {
  return useAppQuery({
    queryKey: messageQueryKeys.templateValues(chatPersonKey(person)),
    queryFn: () =>
      person.kind === 'contact'
        ? fetchContactTemplateValues()
        : fetchTemplateValues(person),
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

interface Sent {
  thread: ChatThread | null;
  message: ChatMessage;
}

/** Who a first message is for: the name and mobile `ensureContactThread` needs. */
export interface ChatRecipient {
  name: string;
  phone: string | null;
}

/**
 * Send on a person's thread (`sendMessage`, `S:1595`, optimistic): the message
 * shows at once as "Sending…", joins the thread when the server accepts it,
 * and turns "Not sent" with a Retry when it fails — never a toast. A patient's
 * first message opens their thread (`ensureContactThread`, D32 — the same
 * lookup-or-create the task drawer binds with). The send finishes even if the
 * column moves to another person meanwhile; `onSent` runs once the server has
 * taken it (the task drawer reads its task again after the rules run, D81 T7).
 */
export function useSendMessage(
  person: ChatPerson,
  recipient: ChatRecipient,
  { onSent }: { onSent?: () => void } = {},
) {
  const queryClient = useQueryClient();
  const personKey = chatPersonKey(person);
  const { name, phone } = recipient;
  const { mutate } = useAppMutation<Sent, SendVars>({
    mutationFn: async ({ channel, body }, action) => {
      if (person.kind === 'contact') {
        const message = await sendContactActivity({
          contactId: person.contactId,
          channel,
          body,
          ...action,
        });
        return { thread: null, message };
      }
      const known = queryClient.getQueryData<ChatThreadRead>(
        messageQueryKeys.thread(personKey),
      )?.thread;
      const thread =
        known ??
        chatThreadOf(
          (
            await ensureContactThread({
              name,
              phone,
              leadId: person.kind === 'lead' ? person.leadId : null,
              patientId: person.kind === 'patient' ? person.patientId : null,
            })
          ).lead,
        );
      return {
        thread,
        message: await sendMessage({ leadId: thread.leadId, channel, body }),
      };
    },
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
              thread: read?.thread ?? sent.thread,
              messages: [...(read?.messages ?? []), sent.message],
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
 * message): a contact's on clinozy-be (`…/resend`), a fixture thread's on the
 * fixture. The thread refetches when it is queued again.
 */
export function useResendMessage(person: ChatPerson) {
  return useAppMutation<ChatMessage, string>({
    mutationFn: (messageId, action) =>
      person.kind === 'contact'
        ? resendContactActivity({
            contactId: person.contactId,
            activityId: messageId,
            ...action,
          })
        : resendMessage(messageId),
    invalidateKeys: [messageQueryKeys.thread(chatPersonKey(person))],
  });
}
