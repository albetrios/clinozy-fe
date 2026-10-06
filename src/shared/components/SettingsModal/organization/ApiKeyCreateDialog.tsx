import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { copySensitiveText } from '@/lib/sensitive-clipboard.ts';
import { cn } from '@/lib/utils.ts';
import type { ApiKeyWithSecret } from '@/shared/api/organization-contracts.ts';
import { DrawerField, DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Checkbox } from '@/shared/components/ui/checkbox.tsx';
import { Label } from '@/shared/components/ui/label.tsx';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { FormError } from '@/shared/forms/FormError/index.ts';
import { useCreateApiKey } from '@/shared/hooks/useApiKeys/index.ts';
import { useAssignablePermissions } from '@/shared/hooks/useAssignablePermissions/index.ts';
import { Copy, Plus } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

/**
 * Lifetimes offered for a new key. clinozy-be caps `expires_in_days` at 365, so
 * `NEVER_EXPIRES` omits the field entirely rather than sending a larger number
 * the server would reject.
 */
const NEVER_EXPIRES = 'never';
const EXPIRY_CHOICES = [
  { value: 'thirty', days: 30 },
  { value: 'ninety', days: 90 },
  { value: 'year', days: 365 },
] as const;

type ExpiryChoice = (typeof EXPIRY_CHOICES)[number]['value'] | typeof NEVER_EXPIRES;

const DEFAULT_EXPIRY: ExpiryChoice = 'ninety';

/**
 * Three fields, the scopes a checklist of many: a heavy field, so the drawer
 * takes the everyday 680px (`_patterns.md:28`).
 */
const API_KEY_FORM_PROFILE = { fieldCount: 3, hasHeavyField: true } as const;

function daysFor(choice: ExpiryChoice): number | null {
  return EXPIRY_CHOICES.find((option) => option.value === choice)?.days ?? null;
}

interface SecretRevealProps {
  secret: string;
  acknowledged: boolean;
  onAcknowledge: (acknowledged: boolean) => void;
  onDone: () => void;
}

/**
 * The one and only sight of a new key's secret. clinozy-be stores a hash, so this
 * screen is the whole of the user's chance to keep it — hence the copy action,
 * the explicit acknowledgement, and a Done that stays disabled until then. Done
 * closes the body, as the recovery codes' does: the drawer shows no footer here,
 * because there is nothing to go back to.
 */
function SecretReveal({
  secret,
  acknowledged,
  onAcknowledge,
  onDone,
}: SecretRevealProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const integrations = SETTINGS_KEYS.panels.integrations;

  async function copy() {
    const copied = await copySensitiveText(secret);
    if (copied) notify.success(t(integrations.apiKeyCopySuccess));
    else notify.error(t(integrations.apiKeyCopyFailed));
  }

  return (
    <div className="flex flex-col gap-3">
      <code
        dir="ltr"
        className="bg-canvas block rounded-lg border px-3 py-2.5 font-mono text-xs break-all"
        data-testid="apikey-secret"
      >
        {secret}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void copy()}
        data-testid="apikey-secret-copy"
        className="self-start"
      >
        <Copy className="size-4" />
        {t(integrations.apiKeyCopy)}
      </Button>
      <div className="flex items-start gap-2">
        <Checkbox
          id="apikey-secret-ack"
          checked={acknowledged}
          onCheckedChange={(value) => onAcknowledge(value === true)}
          data-testid="apikey-secret-ack"
        />
        <Label
          htmlFor="apikey-secret-ack"
          className="text-muted-foreground text-xs font-normal"
        >
          {t(integrations.apiKeySecretAck)}
        </Label>
      </div>
      <Button
        type="button"
        disabled={!acknowledged}
        onClick={onDone}
        data-testid="apikey-secret-done"
      >
        {t(integrations.apiKeySecretDone)}
      </Button>
    </div>
  );
}

/**
 * Create an organization API key, then reveal its secret exactly once — a child
 * drawer stacked on Settings (L-65), whose Back returns to the Integrations
 * section.
 *
 * The integrations panel listed and revoked keys but offered no way to make
 * one, so the section opened on an empty state with no next action — the API
 * key that would fill it could only be created by calling the endpoint by hand.
 *
 * Two phases in one drawer, because they are one task: the form, then the
 * secret. The secret phase cannot be dismissed by the ×, Esc or the backdrop
 * and its Done button stays disabled until the acknowledgement is ticked —
 * clinozy-be stores only a hash, so a secret dismissed by a stray keypress is
 * gone for good and the key has to be rotated. Same shape as the recovery-code
 * reveal. While the create runs, the drawer holds every exit.
 *
 * Scopes are permission codes. clinozy-be refuses any the caller does not hold
 * themselves, so the picker offers the same assignable set the role editor uses
 * and requires at least one — an empty `scopes` array is a 400.
 */
export function ApiKeyCreateDialog() {
  const { t } = useTranslation(SETTINGS_NS);
  const integrations = SETTINGS_KEYS.panels.integrations;
  const create = useCreateApiKey();
  // Same catalog the role builder uses: what clinozy-be knows, narrowed to what this caller may
  // actually delegate. An API key cannot carry a scope its creator does not hold.
  const assignable = useAssignablePermissions();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<ExpiryChoice>(DEFAULT_EXPIRY);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ApiKeyWithSecret | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  // The name takes focus on open, as it did when this was a dialog.
  const nameRef = useRef<HTMLInputElement>(null);

  function reset() {
    setName('');
    setScopes([]);
    setExpiry(DEFAULT_EXPIRY);
    setError(null);
    setCreated(null);
    setAcknowledged(false);
  }

  function toggleScope(scope: string) {
    setScopes((previous) =>
      previous.includes(scope)
        ? previous.filter((held) => held !== scope)
        : [...previous, scope],
    );
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t(integrations.apiKeyNameRequired));
      return;
    }
    if (scopes.length === 0) {
      setError(t(integrations.apiKeyScopesRequired));
      return;
    }
    setError(null);
    create.mutate(
      { name: trimmed, scopes, expiresInDays: daysFor(expiry) },
      {
        onSuccess: (key) => setCreated(key),
        // The dialog stays open on failure, so the reason belongs IN it —
        // beside the form the server rejected, not only in a toast that fades.
        onError: (cause) => setError(mapApiError(cause)),
      },
    );
  }

  // Never while an unacknowledged secret is on screen: the ×, Back, Esc and the
  // backdrop all come through here. (The drawer never calls it mid-create.)
  function close() {
    if (created && !acknowledged) return;
    setOpen(false);
    reset();
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        data-testid="apikey-create-open"
      >
        <Plus className="size-4" />
        {t(integrations.createApiKey)}
      </Button>

      <RecordDrawer
        open={open}
        onClose={close}
        title={t(
          created ? integrations.apiKeySecretTitle : integrations.createApiKeyTitle,
        )}
        sub={t(
          created
            ? integrations.apiKeySecretDescription
            : integrations.createApiKeyDescription,
        )}
        content={API_KEY_FORM_PROFILE}
        stacked
        initialFocusRef={nameRef}
        saveLabel={t(integrations.createApiKey)}
        savingLabel={t(integrations.creating)}
        onSave={submit}
        saveState={create.isPending ? 'saving' : 'idle'}
        saveTestId="apikey-create"
        dismissTestId="apikey-cancel"
        hideFooter={created !== null}
        testId="apikey-create-dialog"
      >
        {created ? (
          <SecretReveal
            secret={created.secret}
            acknowledged={acknowledged}
            onAcknowledge={setAcknowledged}
            onDone={() => {
              setOpen(false);
              reset();
            }}
          />
        ) : (
          <>
            <DrawerField label={t(integrations.apiKeyNameLabel)} htmlFor="apikey-name">
              <DrawerInput
                ref={nameRef}
                id="apikey-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t(integrations.apiKeyNamePlaceholder)}
                data-testid="apikey-name"
              />
            </DrawerField>

            <DrawerField
              label={t(integrations.apiKeyExpiryLabel)}
              htmlFor="apikey-expiry"
            >
              <Picker
                id="apikey-expiry"
                label={t(integrations.apiKeyExpiryLabel)}
                value={expiry}
                options={[
                  ...EXPIRY_CHOICES.map((option) => ({
                    key: option.value,
                    label: t(integrations.apiKeyExpiryDays, { count: option.days }),
                  })),
                  { key: NEVER_EXPIRES, label: t(integrations.apiKeyExpiryNever) },
                ]}
                plain
                onChange={(key) => {
                  if (key) setExpiry(key as ExpiryChoice);
                }}
                testId="apikey-expiry"
                className="w-full"
              />
            </DrawerField>

            <DrawerField label={t(integrations.apiKeyScopesLabel)}>
              <p className="text-muted-foreground text-xs">
                {t(integrations.apiKeyScopesHint)}
              </p>
              {assignable.isPending ? (
                <p className="text-muted-foreground text-xs">
                  {t(SETTINGS_KEYS.panels.roles.permissionsLoading)}
                </p>
              ) : null}
              {assignable.isError ? (
                <p className="text-destructive text-xs" role="alert">
                  {t(SETTINGS_KEYS.panels.roles.permissionsLoadFailed)}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {assignable.rows.map((entry) => (
                  <div key={entry.code} className="flex items-center gap-2">
                    <Checkbox
                      id={`apikey-scope-${entry.code}`}
                      checked={scopes.includes(entry.code)}
                      onCheckedChange={() => toggleScope(entry.code)}
                      data-testid={`apikey-scope-${entry.code}`}
                    />
                    <Label
                      htmlFor={`apikey-scope-${entry.code}`}
                      className={cn('text-muted-foreground text-xs font-normal')}
                      title={entry.code}
                    >
                      {entry.name}
                    </Label>
                  </div>
                ))}
              </div>
            </DrawerField>

            <FormError message={error} data-testid="apikey-error" />
          </>
        )}
      </RecordDrawer>
    </>
  );
}
