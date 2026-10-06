import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { WebhookDeliveryAttemptsDialog } from './WebhookDeliveryAttemptsDialog.tsx';

const { useDeliveryAttemptsMock } = vi.hoisted(() => ({
  useDeliveryAttemptsMock: vi.fn(),
}));
vi.mock('@/shared/hooks/useWebhooks/index.ts', () => ({
  useWebhookDeliveryAttempts: useDeliveryAttemptsMock,
}));

const SENT = {
  eventType: 'membership.created',
  eventKey: 'mem_1',
  status: 'SENT',
  httpStatusCode: 200,
  sentAt: '2026-06-01T10:00:00.000Z',
  attemptCount: 1,
  nextRetryAt: null,
  createdAt: '2026-06-01T10:00:00.000Z',
};

const FAILED = {
  ...SENT,
  eventType: 'subscription.updated',
  status: 'FAILED',
  httpStatusCode: 500,
  attemptCount: 3,
  nextRetryAt: '2026-06-01T10:05:00.000Z',
};

function attempts(overrides: Record<string, unknown> = {}) {
  return {
    data: { rows: [SENT, FAILED], next: null, hasMore: false },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  useDeliveryAttemptsMock.mockReturnValue(attempts());
});

/** Opens the history for one webhook (the drawer needs the router) and waits for it. */
async function renderHistory(onClose = vi.fn()) {
  renderWithProviders(
    <WebhookDeliveryAttemptsDialog
      webhookId="whk_1"
      webhookUrl="https://x.test/hook"
      onClose={onClose}
    />,
  );
  return screen.findByTestId('webhook-attempts-dialog');
}

describe('WebhookDeliveryAttemptsDialog', () => {
  it('lists each attempt with its event, status and code', async () => {
    await renderHistory();

    const list = screen.getByTestId('webhook-attempts-list');
    expect(list).toHaveTextContent('membership.created');
    expect(list).toHaveTextContent('SENT');
    expect(list).toHaveTextContent('200');
    expect(list).toHaveTextContent('subscription.updated');
    expect(list).toHaveTextContent('FAILED');
    expect(list).toHaveTextContent('500');
  });

  it('names the endpoint the history belongs to', async () => {
    await renderHistory();
    expect(screen.getByText('https://x.test/hook')).toBeInTheDocument();
  });

  // The list projection returns no row id (sec-r4-D6 / sec-T #17), so two attempts of the
  // same event must still render as two rows rather than collapsing on a duplicate key.
  it('renders repeated attempts of the same event as separate rows', async () => {
    useDeliveryAttemptsMock.mockReturnValue(
      attempts({
        data: {
          rows: [SENT, { ...SENT, attemptCount: 2 }, { ...SENT, attemptCount: 3 }],
          next: null,
          hasMore: false,
        },
      }),
    );
    await renderHistory();
    expect(screen.getByTestId('webhook-attempts-list').children).toHaveLength(3);
  });

  it('shows a skeleton while loading', async () => {
    useDeliveryAttemptsMock.mockReturnValue(
      attempts({ isLoading: true, data: undefined }),
    );
    await renderHistory();
    expect(screen.getByTestId('webhook-attempts-loading')).toBeInTheDocument();
  });

  // A failed fetch must not read as "this webhook has never delivered" — the empty state
  // would point the operator at the wrong problem entirely.
  it('offers a retry on failure instead of the empty state', async () => {
    useDeliveryAttemptsMock.mockReturnValue(attempts({ isError: true, data: undefined }));
    await renderHistory();
    expect(screen.getByTestId('webhook-attempts-error')).toBeInTheDocument();
    expect(screen.queryByTestId('webhook-attempts-list')).not.toBeInTheDocument();
  });

  it('shows an empty state when the webhook has never delivered', async () => {
    useDeliveryAttemptsMock.mockReturnValue(
      attempts({ data: { rows: [], next: null, hasMore: false } }),
    );
    await renderHistory();
    expect(screen.queryByTestId('webhook-attempts-list')).not.toBeInTheDocument();
    expect(screen.getByTestId('webhook-attempts-close')).toBeInTheDocument();
  });

  it('stays closed when no webhook is selected', async () => {
    renderWithProviders(
      <>
        <p>Integrations</p>
        <WebhookDeliveryAttemptsDialog webhookId={null} webhookUrl="" onClose={vi.fn()} />
      </>,
    );
    await screen.findByText('Integrations');
    expect(screen.queryByTestId('webhook-attempts-dialog')).not.toBeInTheDocument();
  });

  it('is a read-only child drawer stacked on Settings whose Back closes it', async () => {
    const onClose = vi.fn();
    const drawer = await renderHistory(onClose);

    expect(screen.getByRole('dialog', { name: 'Delivery history' })).toBe(drawer);
    // Nothing to save: the footer is Back alone, on the id the specs know.
    const back = screen.getByTestId('webhook-attempts-close');
    expect(back).toHaveTextContent('Back');
    expect(screen.queryByTestId('webhook-attempts-dialog-save')).not.toBeInTheDocument();
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    back.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('draws the loading list as the design’s flat bars, announced by name', async () => {
    useDeliveryAttemptsMock.mockReturnValue(
      attempts({ isLoading: true, data: undefined }),
    );
    await renderHistory();
    const loading = screen.getByTestId('webhook-attempts-loading');
    expect(loading.querySelector('[data-testid="skeleton-rows"]')).not.toBeNull();
    expect(loading.querySelector('.animate-pulse')).toBeNull();
    expect(loading).toHaveTextContent('Delivery history');
  });
});
