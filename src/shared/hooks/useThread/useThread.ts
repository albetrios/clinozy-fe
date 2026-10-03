import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { LeadMessage } from '@/shared/api/clinic/clinic-schema.ts';
import { ensureContactThread } from '@/shared/api/clinic/contact-threads-api.ts';
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
} from '@/shared/api/clinic/messages-api.ts';
import {
  type ChatPerson,
  chatPersonKey,
  type ChatThread,
  type ChatThreadRead,
  type ComposerMode,
} from '@/shared/api/clinic/messages-contracts.ts';
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
 * A person's thread — the lead's, or a patient's — with its messages oldest
 * first and their authors (`getLead`, `S:1589`). A patient without a thread
 * reads as `thread: null` until their first message opens one.
 */
export function useThread(person: ChatPerson) {
  return useAppQuery({
    queryKey: messageQueryKeys.thread(chatPersonKey(person)),
    queryFn: () => fetchThread(person),
    // The chat column shows this failure in place (RetryError), not in a toast.
    notifyOnError: false,
  });
}

/** A person's contact history, oldest first — merged into the thread as system chips. */
export function useContactHistory(person: ChatPerson) {
  return useAppQuery({
    queryKey: messageQueryKeys.history(chatPersonKey(person)),
    queryFn: () => fetchContactHistory(person),
  });
}

/** Whether WhatsApp is down (Q-L10) — fresh for a minute, then read again on the next mount or focus. */
export function useMessagingStatus() {
  return useAppQuery({
    queryKey: messageQueryKeys.status(),
    queryFn: fetchMessagingStatus,
    staleTime: 60_000,
    // An unknown status shows no outage line — the composer still sends.
    notifyOnError: false,
  });
}

/** The clinic's name, branch address and links and the free slots the composer fills in. */
export function useTemplateValues(person: ChatPerson) {
  return useAppQuery({
    queryKey: messageQueryKeys.templateValues(chatPersonKey(person)),
    queryFn: () => fetchTemplateValues(person),
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
  thread: ChatThread;
  message: LeadMessage;
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
 * column moves to another person meanwhile.
 */
export function useSendMessage(person: ChatPerson, recipient: ChatRecipient) {
  const queryClient = useQueryClient();
  const personKey = chatPersonKey(person);
  const { name, phone } = recipient;
  const { mutate } = useAppMutation<Sent, SendVars>({
    mutationFn: async ({ channel, body }) => {
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
            for (const queryKey of MESSAGE_SIDE_EFFECT_KEYS) {
              void queryClient.invalidateQueries({ queryKey });
            }
          },
          onError: () => markOutbox(personKey, message.clientId, 'failed'),
        },
      );
    },
    [mutate, personKey, queryClient],
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
 * message; Appendix F). The thread refetches when it is queued again.
 */
export function useResendMessage(person: ChatPerson) {
  return useAppMutation<LeadMessage, string>({
    mutationFn: resendMessage,
    invalidateKeys: [messageQueryKeys.thread(chatPersonKey(person))],
  });
}
