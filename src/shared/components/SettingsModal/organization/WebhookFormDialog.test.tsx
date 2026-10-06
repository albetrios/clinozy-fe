import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { WebhookFormDialog, type WebhookFormDialogProps } from './WebhookFormDialog.tsx';

const { createMutate, updateMutate, useWebhookEventsMock } = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  useWebhookEventsMock: vi.fn(),
}));
vi.mock('@/shared/hooks/useWebhooks/index.ts', () => ({
  useCreateWebhook: () => ({ isPending: false, mutate: createMutate }),
  useUpdateWebhook: () => ({ isPending: false, mutate: updateMutate }),
}));
vi.mock('@/shared/hooks/useWebhookEvents/index.ts', () => ({
  useWebhookEvents: useWebhookEventsMock,
}));

const WEBHOOK = {
  id: 'whk_1',
  url: 'https://x.test/hook',
  events: ['membership.created'],
  active: true,
  createdAt: '2026-06-01T00:00:00.000Z',
};

function catalog(overrides: Record<string, unknown> = {}) {
  return {
    rows: [
      { event: 'membership.created', description: 'When a membership is created' },
      { event: 'subscription.updated', description: 'When a subscription is updated' },
    ],
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  useWebhookEventsMock.mockReturnValue(catalog());
});

/** Opens the drawer (its dirty guard needs the router) and waits for it to mount. */
async function renderForm(webhook: WebhookFormDialogProps['webhook']) {
  renderWithProviders(
    <WebhookFormDialog open onOpenChange={vi.fn()} webhook={webhook} />,
  );
  return screen.findByTestId('webhook-form-dialog');
}

describe('WebhookFormDialog — create', () => {
  it('is a child drawer stacked on Settings: named, Back returns, the URL focused', async () => {
    const drawer = await renderForm(null);

    expect(screen.getByRole('dialog', { name: 'Add a webhook' })).toBe(drawer);
    expect(screen.getByTestId('webhook-cancel')).toHaveTextContent('Back');
    expect(screen.getByTestId('webhook-save')).toHaveTextContent('Create webhook');
    await vi.waitFor(() => expect(screen.getByTestId('webhook-url')).toHaveFocus());
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('offers the catalog from the API, not a hardcoded list', async () => {
    await renderForm(null);
    expect(screen.getByTestId('webhook-event-membership.created')).toBeInTheDocument();
    expect(screen.getByTestId('webhook-event-subscription.updated')).toBeInTheDocument();
    // The name the old client-side list offered and clinozy-be never dispatches.
    expect(screen.queryByTestId('webhook-event-member.created')).not.toBeInTheDocument();
  });

  it('submits the chosen url and events', async () => {
    const user = userEvent.setup();
    await renderForm(null);

    await user.type(screen.getByTestId('webhook-url'), 'https://new.test/hook');
    await user.click(screen.getByTestId('webhook-event-membership.created'));
    await user.click(screen.getByTestId('webhook-save'));

    expect(createMutate).toHaveBeenCalledWith(
      { url: 'https://new.test/hook', events: ['membership.created'] },
      expect.anything(),
    );
  });

  // clinozy-be's `httpsUrl` rejects any other scheme. Catching it here turns a round-trip 400
  // into a message on the field.
  it('refuses a non-HTTPS URL before it reaches the API', async () => {
    const user = userEvent.setup();
    await renderForm(null);

    await user.type(screen.getByTestId('webhook-url'), 'http://insecure.test/hook');
    await user.click(screen.getByTestId('webhook-event-membership.created'));
    await user.click(screen.getByTestId('webhook-save'));

    expect(createMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('webhook-error')).toHaveTextContent(/https/i);
  });

  it('requires at least one event', async () => {
    const user = userEvent.setup();
    await renderForm(null);

    await user.type(screen.getByTestId('webhook-url'), 'https://new.test/hook');
    await user.click(screen.getByTestId('webhook-save'));

    expect(createMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('webhook-error')).toBeInTheDocument();
  });
});

describe('WebhookFormDialog — edit', () => {
  it('prefills from the webhook being edited', async () => {
    await renderForm(WEBHOOK);
    expect(screen.getByTestId('webhook-url')).toHaveValue('https://x.test/hook');
    expect(screen.getByTestId('webhook-event-membership.created')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('webhook-event-subscription.updated')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('updates through the id it was given', async () => {
    const user = userEvent.setup();
    await renderForm(WEBHOOK);

    await user.click(screen.getByTestId('webhook-event-subscription.updated'));
    await user.click(screen.getByTestId('webhook-save'));

    expect(updateMutate).toHaveBeenCalledWith(
      {
        id: 'whk_1',
        input: {
          url: 'https://x.test/hook',
          events: ['membership.created', 'subscription.updated'],
        },
      },
      expect.anything(),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });
});

describe('WebhookFormDialog — catalog states', () => {
  it('shows a skeleton while the catalog loads', async () => {
    useWebhookEventsMock.mockReturnValue(catalog({ isPending: true, rows: [] }));
    await renderForm(null);
    expect(screen.getByTestId('webhook-events-loading')).toBeInTheDocument();
  });

  // A failed catalog must never read as "no events exist" — that invites saving a webhook
  // subscribed to nothing, which is exactly the silent-no-op this work removes.
  it('offers a retry when the catalog fails, rather than an empty checklist', async () => {
    useWebhookEventsMock.mockReturnValue(catalog({ isError: true, rows: [] }));
    await renderForm(null);
    expect(screen.getByTestId('webhook-events-error')).toBeInTheDocument();
    expect(screen.queryByTestId('webhook-events-empty')).not.toBeInTheDocument();
  });

  it('says so plainly when the catalog is genuinely empty', async () => {
    useWebhookEventsMock.mockReturnValue(catalog({ rows: [] }));
    await renderForm(null);
    expect(screen.getByTestId('webhook-events-empty')).toBeInTheDocument();
  });
});
