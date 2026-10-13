import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { isListStale, listRefreshClass } from '@/lib/list-refresh.ts';
import type { ApiKey } from '@/shared/api/organization-contracts.ts';
import type { Webhook, WebhookTestResult } from '@/shared/api/webhook-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { FormattedDate } from '@/shared/components/FormattedDate/index.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  SettingsCard,
  SettingsList,
  SettingsListRow,
  settingsRowActionClass,
  SettingsRowTile,
} from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { useApiKeys, useRevokeApiKey } from '@/shared/hooks/useApiKeys/index.ts';
import { useAccessResolved, useCan } from '@/shared/hooks/useCan/index.ts';
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedValue/index.ts';
import {
  useDeleteWebhook,
  useTestWebhook,
  useWebhooks,
} from '@/shared/hooks/useWebhooks/index.ts';
import {
  Eye,
  LinkIcon,
  Lock,
  Plug,
  Plus,
  SlidersHorizontal,
  Trash,
  Zap,
} from '@/shared/icons/index.ts';

import { ApiKeyCreateDialog } from './ApiKeyCreateDialog.tsx';
import {
  DEFAULT_ORG_LIST_SORT,
  type OrgListSortPreset,
  orgListSortToParams,
} from './org-list-sort.ts';
import { OrgListControls } from './OrgListControls.tsx';
import { WebhookDeliveryAttemptsDialog } from './WebhookDeliveryAttemptsDialog.tsx';
import { WebhookFormDialog } from './WebhookFormDialog.tsx';

/**
 * Write access to API keys. Gated on the permission clinozy-be actually enforces on
 * `POST`/`DELETE /tenancy/organization/api-keys` — `api-key:manage`, not `role:manage`.
 * Deliberately NOT `teamOrganizationOnly`: those routes are organization-scope `both` and a
 * personal owner holds the api-key codes, so a personal workspace can manage its own keys.
 */
function useCanManageApiKeys(): boolean {
  return useCan({ permission: 'api-key:manage' });
}

/**
 * Write access to webhooks — `webhook:manage`, the permission clinozy-be enforces on
 * `POST`/`DELETE /notify/webhooks`. Webhooks are a team surface, so the org-type guard stays.
 */
function useCanManageWebhooks(): boolean {
  return useCan({ permission: 'webhook:manage', teamOrganizationOnly: true });
}

/**
 * The API-keys card's create action. Split out of `ApiKeysSection` only to keep
 * that function's branch count under the complexity ceiling — the section
 * already carries loading, error, empty, searching and list branches, and the
 * permission check would have been one too many.
 */
function ApiKeysCreate({ canManage }: { canManage: boolean }) {
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  // `useCan` is synchronous and the guard chain fills the permission set a beat after this
  // panel first renders, so a `false` can mean "not yet". A disabled placeholder of the same
  // size holds the slot rather than letting the control pop in (SET-23).
  const accessResolved = useAccessResolved();
  if (!accessResolved) {
    return (
      <Button size="sm" variant="outline" disabled data-testid="apikey-create-pending">
        <Plus className="size-4" />
        {tSettings(SETTINGS_KEYS.panels.integrations.createApiKey)}
      </Button>
    );
  }
  return canManage ? <ApiKeyCreateDialog /> : null;
}

/** One key: its tile, its name, the masked prefix and when it was added. */
function ApiKeyRow({
  apiKey,
  canManage,
  onRevoke,
}: {
  apiKey: ApiKey;
  canManage: boolean;
  onRevoke: (key: ApiKey) => void;
}) {
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  const integrations = SETTINGS_KEYS.panels.integrations;
  return (
    <SettingsListRow>
      <SettingsRowTile icon={Lock} />
      <div className="min-w-0 flex-1">
        <p dir="auto" className="text-body truncate font-medium">
          {apiKey.name}
        </p>
        <p className="text-muted-foreground text-caption truncate">
          <span dir="ltr" className="font-mono">
            {apiKey.prefix}••••••••
          </span>
          {' · '}
          <Trans
            ns={SETTINGS_NS}
            i18nKey={integrations.addedOn}
            components={{ 1: <FormattedDate value={apiKey.createdAt} /> }}
          />
        </p>
      </div>
      {canManage ? (
        <Button
          variant="outline"
          size="icon-sm"
          className={settingsRowActionClass(true)}
          aria-label={tSettings(integrations.revokeAria, { name: apiKey.name })}
          onClick={() => onRevoke(apiKey)}
          data-testid={`apikey-revoke-${apiKey.id}`}
        >
          <Trash className="size-3.5" />
        </Button>
      ) : null}
    </SettingsListRow>
  );
}

function ApiKeysSection() {
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  const integrations = SETTINGS_KEYS.panels.integrations;
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<OrgListSortPreset>(DEFAULT_ORG_LIST_SORT);
  const { debounced: debouncedSearch, isPending: isSearchPending } =
    useDebouncedSearch(search);
  const sortParams = orgListSortToParams(sort);
  const keys = useApiKeys({
    q: debouncedSearch || undefined,
    ...sortParams,
  });
  const canManage = useCanManageApiKeys();
  const revokeKey = useRevokeApiKey();
  const [toRevoke, setToRevoke] = useState<ApiKey | null>(null);
  const isSearching = debouncedSearch.length > 0;
  const isStale = isListStale(keys.isRefreshing, isSearchPending);

  return (
    <SettingsCard
      title={tSettings(integrations.apiKeysTitle)}
      action={<ApiKeysCreate canManage={canManage} />}
    >
      <OrgListControls
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        searchPlaceholder={tSettings(integrations.searchPlaceholder)}
        searchTestId="apikeys-search"
        sortTestId="apikeys-sort"
      />
      {keys.isPending ? <PanelSkeleton testId="apikeys-loading" /> : null}
      {keys.isError ? (
        // The webhooks list beside this one always offered a retry; the API-key
        // list answered the same failure with a dead sentence (SET-20).
        <div data-testid="apikeys-error">
          <RetryError
            message={tSettings(integrations.apiKeysLoadFailed)}
            onRetry={keys.refetch}
            isRetrying={keys.isFetching}
          />
        </div>
      ) : null}
      {!(keys.isPending || keys.isError) && keys.rows.length === 0 ? (
        <EmptyState
          tone="lav"
          className="pt-6 pb-7"
          icon={<Lock />}
          title={tSettings(
            isSearching ? integrations.apiKeysNoResults : integrations.apiKeysEmptyTitle,
          )}
          description={tSettings(
            isSearching
              ? integrations.apiKeysNoResultsDescription
              : integrations.apiKeysEmptyDescription,
          )}
        />
      ) : null}
      {!keys.isError && keys.rows.length > 0 ? (
        <SettingsList
          frameClassName={listRefreshClass(isStale)}
          aria-busy={isStale}
          data-testid="apikeys-list"
        >
          {keys.rows.map((key) => (
            <ApiKeyRow
              key={key.id}
              apiKey={key}
              canManage={canManage}
              onRevoke={setToRevoke}
            />
          ))}
        </SettingsList>
      ) : null}
      {!keys.isError && keys.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={keys.fetchNextPage}
            disabled={keys.isFetchingNextPage}
            data-testid="apikeys-load-more"
          >
            {tSettings(integrations.loadMore)}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setToRevoke(null);
        }}
        title={tSettings(integrations.revokeTitle, {
          name: toRevoke?.name ?? tSettings(integrations.apiKeyFallback),
        })}
        description={tSettings(integrations.revokeDescription)}
        confirmLabel={tSettings(integrations.revokeConfirm)}
        destructive
        onConfirm={async () => {
          if (toRevoke) await revokeKey.mutateAsync(toRevoke.id);
        }}
      />
    </SettingsCard>
  );
}

/**
 * Turn a test-delivery outcome into the line shown under the row.
 *
 * @remarks
 * Three outcomes, not two: delivered, refused with a status, and never reached at all
 * (`statusCode === null`, e.g. DNS or TLS failure). Collapsing the last two would tell an
 * operator the endpoint answered when nothing did.
 */
function describeTestResult(
  result: WebhookTestResult,
  translate: (key: string, options?: Record<string, unknown>) => string,
): string {
  const integrations = SETTINGS_KEYS.panels.integrations;
  if (result.success) {
    return translate(integrations.testSucceeded, { status: result.statusCode });
  }
  if (result.statusCode === null) {
    return translate(integrations.testNoStatus);
  }
  return translate(integrations.testFailed, { status: result.statusCode });
}

/** Webhooks — list, create/edit, test delivery, delivery history and delete. */
function WebhooksSection() {
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  const integrations = SETTINGS_KEYS.panels.integrations;
  const { data: hooks, isLoading, isError, isFetching, refetch } = useWebhooks();
  const canManage = useCanManageWebhooks();
  const remove = useDeleteWebhook();
  const test = useTestWebhook();
  const [toDelete, setToDelete] = useState<Webhook | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Webhook | null>(null);
  // Bumped on every open so WebhookFormDialog remounts and re-seeds from the row being
  // edited. Without it, reopening after a cancelled edit would show the abandoned values.
  const [formGeneration, setFormGeneration] = useState(0);
  const [historyFor, setHistoryFor] = useState<Webhook | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; text: string } | null>(null);

  function openForm(hook: Webhook | null) {
    setEditing(hook);
    setFormGeneration((generation) => generation + 1);
    setFormOpen(true);
  }

  // A refused delivery is NOT a failed request — clinozy-be resolves with `success: false` and
  // the status it got back. Reporting "sent" for a 500 would hide the very breakage this
  // button exists to reveal.
  function runTest(hook: Webhook) {
    setTestResult(null);
    test.mutate(hook.id, {
      onSuccess: (result) => {
        setTestResult({ id: hook.id, text: describeTestResult(result, tSettings) });
      },
    });
  }

  return (
    <SettingsCard
      title={tSettings(integrations.webhooksTitle)}
      action={
        canManage ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openForm(null)}
            data-testid="webhook-add"
          >
            <Plus className="size-4" />
            {tSettings(integrations.addWebhook)}
          </Button>
        ) : undefined
      }
    >
      {isLoading ? <PanelSkeleton testId="webhooks-loading" /> : null}

      {isError ? (
        <div data-testid="webhooks-error">
          <RetryError
            message={tSettings(integrations.webhooksLoadFailed)}
            onRetry={() => {
              void refetch();
            }}
            isRetrying={isFetching}
          />
        </div>
      ) : null}

      {!isError && hooks && hooks.length === 0 ? (
        <EmptyState
          tone="plum"
          className="pt-6 pb-7"
          icon={<Plug />}
          title={tSettings(integrations.webhooksEmptyTitle)}
          description={tSettings(integrations.webhooksEmptyDescription)}
        />
      ) : null}

      {!isError && hooks && hooks.length > 0 ? (
        <SettingsList data-testid="webhooks-list">
          {hooks.map((hook) => (
            <SettingsListRow key={hook.id} className="gap-2">
              <SettingsRowTile icon={LinkIcon} />
              <div className="ms-1 min-w-0 flex-1">
                <p
                  dir="ltr"
                  className="text-body truncate [text-align:match-parent] font-mono"
                >
                  {hook.url}
                </p>
                <p className="text-muted-foreground text-caption truncate">
                  {hook.events.join(', ')}
                </p>
                {testResult?.id === hook.id ? (
                  // `<output>` rather than `role="status"`: it carries the same
                  // implicit live region, and some assistive tech announces the
                  // native element where it ignores the ARIA role (S6819).
                  <output
                    className="text-muted-foreground-strong mt-1 block text-xs"
                    data-testid={`webhook-test-result-${hook.id}`}
                  >
                    {testResult.text}
                  </output>
                ) : null}
              </div>
              {/*
                  History is `webhook:read`, which every caller who can see this list already
                  holds. Edit, test and delete are `webhook:manage` — a reader gets the
                  diagnosis without the controls that change anything.
                */}
              <Button
                variant="outline"
                size="icon-sm"
                className={settingsRowActionClass()}
                aria-label={tSettings(integrations.deliveryAttemptsAria, {
                  url: hook.url,
                })}
                onClick={() => setHistoryFor(hook)}
                data-testid={`webhook-history-${hook.id}`}
              >
                <Eye className="size-3.5" />
              </Button>
              {canManage ? (
                <>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className={settingsRowActionClass()}
                    aria-label={tSettings(integrations.testWebhookAria, {
                      url: hook.url,
                    })}
                    onClick={() => runTest(hook)}
                    isLoading={test.isPending && test.variables === hook.id}
                    data-testid={`webhook-test-${hook.id}`}
                  >
                    <Zap className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className={settingsRowActionClass()}
                    aria-label={tSettings(integrations.editWebhookAria, {
                      url: hook.url,
                    })}
                    onClick={() => openForm(hook)}
                    data-testid={`webhook-edit-${hook.id}`}
                  >
                    <SlidersHorizontal className="size-3.5" />
                  </Button>
                  {/* The destructive action last, after the table's 1px divider. */}
                  <span aria-hidden="true" className="bg-border h-4.5 w-px flex-none" />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className={settingsRowActionClass(true)}
                    aria-label={tSettings(integrations.deleteWebhookAria, {
                      url: hook.url,
                    })}
                    onClick={() => setToDelete(hook)}
                    data-testid={`webhook-delete-${hook.id}`}
                  >
                    <Trash className="size-3.5" />
                  </Button>
                </>
              ) : null}
            </SettingsListRow>
          ))}
        </SettingsList>
      ) : null}

      <WebhookFormDialog
        key={formGeneration}
        open={formOpen}
        onOpenChange={setFormOpen}
        webhook={editing}
      />

      <WebhookDeliveryAttemptsDialog
        webhookId={historyFor?.id ?? null}
        webhookUrl={historyFor?.url ?? ''}
        onClose={() => setHistoryFor(null)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={tSettings(integrations.deleteWebhookTitle)}
        description={tSettings(integrations.deleteWebhookDescription)}
        confirmLabel={tSettings(integrations.deleteConfirm)}
        destructive
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
        }}
      />
    </SettingsCard>
  );
}

/**
 * Integrations panel — API keys (create/revoke) + outbound webhooks (create/delete).
 *
 * Each resource is gated on the permission clinozy-be enforces for it: `api-key:manage` and
 * `webhook:manage` respectively. One shared `role:manage` flag used to gate both, which failed
 * in each direction — it showed controls to a caller the API answers with 403, and hid them
 * from a caller who held the right code but not `role:manage`. Both combinations are reachable,
 * since the role builder grants those codes independently.
 */
export function OrganizationIntegrationsPanel() {
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  // Webhooks are only shown when the caller can actually read them; API keys are
  // the always-available part of this section (see settings-permissions.ts).
  // `useAccessResolved` distinguishes "not allowed" from "not resolved yet" — without it a
  // corrected gate renders hidden on first paint and pops in a beat later (SET-23).
  const canReadWebhooks = useCan({
    permission: 'webhook:read',
    teamOrganizationOnly: true,
  });
  return (
    <section
      className="flex flex-col gap-4"
      data-testid="settings-organization-integrations"
    >
      <SectionHeader
        title={tSettings(SETTINGS_KEYS.panels.integrations.title)}
        // Describe what is on screen. This panel is an Account section, so a personal
        // workspace reaches it too — and there the webhooks half stays hidden, which made
        // "API keys and webhooks." a promise the panel could not keep.
        description={tSettings(
          canReadWebhooks
            ? SETTINGS_KEYS.panels.integrations.description
            : SETTINGS_KEYS.panels.integrations.descriptionApiKeysOnly,
        )}
      />
      <ApiKeysSection />
      {canReadWebhooks ? <WebhooksSection /> : null}
    </section>
  );
}
