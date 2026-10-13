import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import {
  createWebhookSchema,
  updateWebhookSchema,
  type Webhook,
} from '@/shared/api/webhook-contracts.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerInput,
} from '@/shared/components/DrawerField/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { FormError } from '@/shared/forms/FormError/index.ts';
import { useWebhookEvents } from '@/shared/hooks/useWebhookEvents/index.ts';
import { useCreateWebhook, useUpdateWebhook } from '@/shared/hooks/useWebhooks/index.ts';

/**
 * Two fields, the events a chip group of many: a heavy field, so the drawer
 * takes the everyday 680px (`_patterns.md:28`).
 */
const WEBHOOK_FORM_PROFILE = { fieldCount: 2, hasHeavyField: true } as const;

/** Props for {@link WebhookFormDialog}. */
export interface WebhookFormDialogProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** Called when the drawer wants to open or close. */
  onOpenChange: (open: boolean) => void;
  /** The webhook being edited, or `null` to create a new one. */
  webhook: Webhook | null;
}

/**
 * Create or edit a webhook — one form for both, because the fields are identical:
 * a child drawer stacked on Settings (L-65), whose Back returns to Integrations.
 *
 * @remarks
 * The event checklist comes from `GET /notify/webhook-events`, never a client-side list.
 * That is load-bearing rather than tidy: clinozy-be's `CreateWebhookDto` validates `events`
 * only as an array of strings, so a stale client list produces webhooks the API accepts and
 * then never delivers. The checklist is disabled while the catalog is loading and renders a
 * retry when it fails, so a webhook can never be saved against an empty guess.
 *
 * Editing sends only `url` and `events`. Omitting `secret` tells clinozy-be to keep the existing
 * signing key, so an edit never silently breaks a receiver's signature verification.
 *
 * @param props - Open state, the close handler, and the webhook to edit (or `null`).
 *
 * @example
 * <WebhookFormDialog open={open} onOpenChange={setOpen} webhook={editing} />
 */
export function WebhookFormDialog({
  open,
  onOpenChange,
  webhook,
}: WebhookFormDialogProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const integrations = SETTINGS_KEYS.panels.integrations;
  const catalog = useWebhookEvents();
  const create = useCreateWebhook();
  const update = useUpdateWebhook();

  const isEdit = webhook !== null;
  // Seeded once, at mount. The panel gives this drawer a fresh `key` every time it opens, so
  // editing a second row never shows the first row's values and a cancelled edit never leaks
  // into the next open — without an effect that writes state during render.
  const [url, setUrl] = useState(() => webhook?.url ?? '');
  const [events, setEvents] = useState<string[]>(() =>
    webhook ? [...webhook.events] : [],
  );
  const [error, setError] = useState<string | null>(null);
  // The URL takes focus on open, as it did when this was a dialog.
  const urlRef = useRef<HTMLInputElement>(null);

  const isPending = isEdit ? update.isPending : create.isPending;

  function close() {
    onOpenChange(false);
  }

  function submit() {
    const schema = isEdit ? updateWebhookSchema : createWebhookSchema;
    const parsed = schema.safeParse({ url, events });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ??
          i18n.t(ERRORS_KEYS.frontend.organization.formCheck, { ns: ERRORS_NS }),
      );
      return;
    }
    setError(null);
    const onError = (cause: unknown) => setError(mapApiError(cause));

    if (isEdit && webhook) {
      update.mutate(
        { id: webhook.id, input: parsed.data },
        { onSuccess: close, onError },
      );
      return;
    }
    create.mutate(parsed.data, { onSuccess: close, onError });
  }

  // A running write holds every exit (the drawer never closes mid-save), so the
  // ×, Back, Esc and the backdrop cannot abandon it.
  return (
    <RecordDrawer
      open={open}
      onClose={close}
      title={t(isEdit ? integrations.editWebhookTitle : integrations.addWebhookTitle)}
      sub={t(
        isEdit ? integrations.editWebhookDescription : integrations.addWebhookDescription,
      )}
      content={WEBHOOK_FORM_PROFILE}
      stacked
      initialFocusRef={urlRef}
      saveLabel={t(submitLabelKey({ isEdit, isPending: false }))}
      savingLabel={t(submitLabelKey({ isEdit, isPending: true }))}
      onSave={submit}
      saveState={isPending ? 'saving' : 'idle'}
      saveTestId="webhook-save"
      dismissTestId="webhook-cancel"
      testId="webhook-form-dialog"
    >
      <DrawerField label={t(integrations.payloadUrlLabel)} htmlFor="webhook-url">
        <DrawerInput
          ref={urlRef}
          id="webhook-url"
          inputMode="url"
          capitalize={false}
          autoComplete="url"
          spellCheck={false}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t(integrations.webhookUrlPlaceholder)}
          data-testid="webhook-url"
        />
      </DrawerField>
      <DrawerField label={t(integrations.eventsLabel)}>
        <WebhookEventChecklist catalog={catalog} selected={events} onChange={setEvents} />
      </DrawerField>
      {/*
        The same error card the sign-in form and the step-up drawer use — a bare red
        line under the events reads as a caption, not as the thing that went wrong.
      */}
      <FormError message={error} data-testid="webhook-error" />
    </RecordDrawer>
  );
}

/** Which of the four footer labels the submit button shows. */
function submitLabelKey({ isEdit, isPending }: { isEdit: boolean; isPending: boolean }) {
  const integrations = SETTINGS_KEYS.panels.integrations;
  if (isEdit) {
    return isPending ? integrations.savingWebhook : integrations.saveWebhook;
  }
  return isPending ? integrations.creating : integrations.createWebhook;
}

/**
 * The subscribe checklist — a drawer's chip field (pick any; a picked chip
 * carries its boxed check, picks kept in the order they were made) — with its
 * own loading / error / empty states.
 */
function WebhookEventChecklist({
  catalog,
  selected,
  onChange,
}: {
  catalog: ReturnType<typeof useWebhookEvents>;
  selected: string[];
  onChange: (events: string[]) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const integrations = SETTINGS_KEYS.panels.integrations;

  if (catalog.isPending) {
    return (
      <span data-testid="webhook-events-loading" className="flex">
        <SkeletonBar shape="field" className="h-16" />
      </span>
    );
  }

  // A failed catalog must not read as "there are no events" — that would invite saving a
  // webhook subscribed to nothing.
  if (catalog.isError) {
    return (
      <div data-testid="webhook-events-error">
        <RetryError
          message={t(integrations.eventsLoadFailed)}
          onRetry={catalog.refetch}
          isRetrying={catalog.isFetching}
        />
      </div>
    );
  }

  if (catalog.rows.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title={t(integrations.eventsEmpty)}
        testId="webhook-events-empty"
        className="text-body"
      />
    );
  }

  return (
    <DrawerChips
      multiple
      ordered
      label={t(integrations.eventsLabel)}
      options={catalog.rows.map((entry) => ({
        value: entry.event,
        label: entry.event,
        hint: entry.description,
      }))}
      value={selected}
      onChange={onChange}
      testId="webhook-event"
    />
  );
}
