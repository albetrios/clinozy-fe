import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const {
  useMfaStatusMock,
  beginMutateAsync,
  confirmMutateAsync,
  disableMutateAsync,
  usePasskeysMock,
  registerMutateAsync,
  removePasskeyMutate,
  passkeysCardCrashes,
} = vi.hoisted(() => ({
  useMfaStatusMock: vi.fn(),
  beginMutateAsync: vi.fn(),
  confirmMutateAsync: vi.fn(),
  disableMutateAsync: vi.fn(),
  usePasskeysMock: vi.fn(),
  registerMutateAsync: vi.fn(),
  removePasskeyMutate: vi.fn(),
  /** Per-test switch: make the passkeys CARD throw (nothing else does). */
  passkeysCardCrashes: { value: false },
}));
vi.mock('@/shared/hooks/useMfa/index.ts', () => ({
  useMfaStatus: useMfaStatusMock,
  useBeginMfaEnrollment: () => ({ mutateAsync: beginMutateAsync, isPending: false }),
  useConfirmMfaEnrollment: () => ({ mutateAsync: confirmMutateAsync, isPending: false }),
  useDisableMfa: () => ({ mutateAsync: disableMutateAsync, isPending: false }),
}));
vi.mock('@/shared/hooks/usePasskeys/index.ts', async () => {
  const { useState } = await import('react');
  return {
    usePasskeys: usePasskeysMock,
    useRegisterPasskey: () => ({ mutateAsync: registerMutateAsync, isPending: false }),
    useRemovePasskey: () => {
      // Only the passkeys card calls this hook, so it is the one throw that
      // starts INSIDE that card and nowhere else.
      if (passkeysCardCrashes.value) throw new Error('passkeys card exploded');
      // One instance per ROW now, each with its own pending flag — a frozen
      // `isPending: false` could not tell the two rows apart (SET-24).
      const [isPending, setIsPending] = useState(false);
      return {
        isPending,
        mutateAsync: async (id: string) => {
          setIsPending(true);
          try {
            await removePasskeyMutate(id);
          } finally {
            setIsPending(false);
          }
        },
      };
    },
  };
});
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

import { AccountSecurityPanel } from './AccountSecurityPanel.tsx';

/**
 * Mounts the panel and waits for it. Two-factor setup and Add passkey are
 * drawers now, mounted closed with their cards, and a drawer's dirty guard
 * needs the router.
 */
async function renderPanel() {
  const view = renderWithProviders(<AccountSecurityPanel />);
  await screen.findByTestId('settings-section-security');
  return view;
}

/**
 * Query results shaped the way the panel now reads them. The old mocks returned
 * `{ data }` alone — which is exactly how SET-3 hid: `data ?? false` looks
 * identical whether the answer is "off", "still loading" or "the read failed".
 */
const refetchMfa = vi.fn();
const refetchPasskeys = vi.fn();
const querySuccess = (data: unknown) => ({
  data,
  isSuccess: true,
  isPending: false,
  isError: false,
  isFetching: false,
});
const queryPending = () => ({
  data: undefined,
  isSuccess: false,
  isPending: true,
  isError: false,
  isFetching: true,
});
const queryFailed = (refetch: () => void) => ({
  data: undefined,
  isSuccess: false,
  isPending: false,
  isError: true,
  isFetching: false,
  refetch,
});

beforeEach(() => {
  vi.resetAllMocks();
  useMfaStatusMock.mockReturnValue({ ...querySuccess(false), refetch: refetchMfa });
  beginMutateAsync.mockResolvedValue({
    secret: 'JBSWY3DPEHPK3PXP',
    otpauthUri: 'otpauth://totp/Core:you?secret=JBSWY3DPEHPK3PXP&issuer=Core',
  });
  confirmMutateAsync.mockResolvedValue({ recoveryCodes: ['AAAA-1111', 'BBBB-2222'] });
  disableMutateAsync.mockResolvedValue(undefined);
  usePasskeysMock.mockReturnValue({
    ...querySuccess(undefined),
    refetch: refetchPasskeys,
    data: [
      {
        id: 'pk_1',
        name: 'MacBook Touch ID',
        createdAt: '2026-02-10T10:00:00.000Z',
        lastUsedAt: null,
      },
    ],
  });
  registerMutateAsync.mockResolvedValue({ id: 'pk_2', name: 'YubiKey' });
  removePasskeyMutate.mockResolvedValue(undefined);
  passkeysCardCrashes.value = false;
});

describe('AccountSecurityPanel', () => {
  it('renders MFA status + setup + passkeys (sessions moved to their own panel)', async () => {
    await renderPanel();
    expect(screen.getByTestId('settings-section-security')).toBeInTheDocument();
    expect(screen.getByTestId('security-overview')).toBeInTheDocument();
    expect(screen.getByTestId('mfa-status')).toHaveTextContent('Disabled');
    expect(screen.getByTestId('mfa-setup')).toBeInTheDocument();
    expect(screen.getByTestId('add-passkey')).toBeInTheDocument();
    // the old duplicated sessions card is gone
    expect(screen.queryByTestId('session-s1')).not.toBeInTheDocument();
  });

  it('runs the enrollment flow: QR → code → recovery codes', async () => {
    const user = userEvent.setup();
    await renderPanel();
    await user.click(screen.getByTestId('mfa-setup'));
    expect(beginMutateAsync).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('mfa-secret')).toHaveTextContent('JBSWY3DPEHPK3PXP');
    expect(await screen.findByTestId('mfa-qr')).toBeInTheDocument();
    await user.type(screen.getByTestId('mfa-code'), '123456');
    await waitFor(() => expect(confirmMutateAsync).toHaveBeenCalledWith('123456'));
    expect(await screen.findByTestId('mfa-recovery-codes')).toBeInTheDocument();
    // The codes have their own Done: the drawer drops its footer for them.
    expect(
      screen.getByRole('dialog', { name: 'Save your recovery codes' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('mfa-verify')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('recovery-codes-panel-ack'));
    await user.click(screen.getByTestId('mfa-done'));
    await waitFor(() =>
      expect(screen.queryByTestId('mfa-setup-dialog')).not.toBeInTheDocument(),
    );
  });

  it('sets up two-factor in a child drawer stacked on Settings, whose Back returns', async () => {
    const user = userEvent.setup();
    await renderPanel();
    await user.click(screen.getByTestId('mfa-setup'));

    const drawer = await screen.findByTestId('mfa-setup-dialog');
    expect(screen.getByRole('dialog', { name: 'Set up two-factor authentication' })).toBe(
      drawer,
    );
    expect(screen.getByTestId('mfa-verify')).toHaveTextContent('Verify & enable');
    // Six digits first: Verify waits for them.
    expect(screen.getByTestId('mfa-verify')).toBeDisabled();
    const back = screen.getByTestId('mfa-setup-dialog-dismiss');
    expect(back).toHaveTextContent('Back');
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    await user.click(back);
    await waitFor(() =>
      expect(screen.queryByTestId('mfa-setup-dialog')).not.toBeInTheDocument(),
    );
    expect(confirmMutateAsync).not.toHaveBeenCalled();
  });

  it('shows Disable when enabled and confirms disabling', async () => {
    useMfaStatusMock.mockReturnValue({ ...querySuccess(true), refetch: refetchMfa });
    const user = userEvent.setup();
    await renderPanel();
    expect(screen.getByTestId('mfa-status')).toHaveTextContent('Enabled');
    await user.click(screen.getByTestId('mfa-disable'));
    await user.click(screen.getByTestId('confirm-accept'));
    await waitFor(() => expect(disableMutateAsync).toHaveBeenCalledTimes(1));
  });

  it('names a new passkey in a child drawer stacked on Settings, the name focused', async () => {
    const user = userEvent.setup();
    await renderPanel();
    await user.click(screen.getByTestId('add-passkey'));

    const drawer = await screen.findByTestId('passkey-add-dialog');
    expect(screen.getByRole('dialog', { name: 'Add a passkey' })).toBe(drawer);
    expect(screen.getByTestId('passkey-add-dialog-dismiss')).toHaveTextContent('Back');
    expect(screen.getByTestId('passkey-add-submit')).toHaveTextContent('Add passkey');
    await waitFor(() => expect(screen.getByTestId('passkey-name')).toHaveFocus());
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('registers a passkey via the add drawer (FE-32)', async () => {
    const user = userEvent.setup();
    await renderPanel();
    await user.click(screen.getByTestId('add-passkey'));
    await user.type(await screen.findByTestId('passkey-name'), 'YubiKey');
    await user.click(screen.getByTestId('passkey-add-submit'));
    await waitFor(() => expect(registerMutateAsync).toHaveBeenCalledWith('YubiKey'));
  });

  it('revokes a passkey (FE-32)', async () => {
    const user = userEvent.setup();
    await renderPanel();
    await user.click(screen.getByTestId('passkey-remove'));
    await waitFor(() => expect(removePasskeyMutate).toHaveBeenCalledWith('pk_1'));
  });

  it('has no accessibility violations', async () => {
    const { container } = await renderPanel();
    expect(await axe(container)).toHaveNoViolations();
  });

  // ── SET-3: a security state is never asserted before it is known ───────────

  it('shows a skeleton, never "Disabled", while the 2FA status is loading', async () => {
    // Regression: `data ?? false` rendered the Disabled badge and a Set-up
    // button on first paint, then flipped to Enabled a moment later.
    useMfaStatusMock.mockReturnValue(queryPending());
    usePasskeysMock.mockReturnValue(queryPending());
    await renderPanel();

    expect(screen.getByTestId('mfa-status-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('mfa-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mfa-setup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mfa-disable')).not.toBeInTheDocument();
    // The score is a claim too — it must not be computed from the defaults.
    expect(screen.queryByTestId('security-overview')).not.toBeInTheDocument();
    expect(screen.getByTestId('security-overview-loading')).toBeInTheDocument();
    // The loading card still names itself — its head is the real title.
    expect(
      within(screen.getByTestId('security-overview-loading')).getByRole('heading'),
    ).toHaveTextContent(/\S/);
  });

  it('reports a failed 2FA read as an error with a retry, not as "off"', async () => {
    const user = userEvent.setup();
    useMfaStatusMock.mockReturnValue(queryFailed(refetchMfa));
    await renderPanel();

    expect(screen.getByTestId('mfa-error')).toBeInTheDocument();
    // Never claim a security posture the app could not read.
    expect(screen.queryByTestId('mfa-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mfa-setup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('security-overview')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('retry-button'));
    expect(refetchMfa).toHaveBeenCalledTimes(1);
  });

  it('reports a failed passkeys read instead of an empty list', async () => {
    // "You have no passkeys" is a claim; a failed read is not evidence for it.
    usePasskeysMock.mockReturnValue(queryFailed(refetchPasskeys));
    await renderPanel();

    expect(screen.getByTestId('passkeys-error')).toBeInTheDocument();
    expect(screen.queryByTestId('passkeys-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('passkey-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('security-overview')).not.toBeInTheDocument();
  });

  it('shows the score only once both reads have landed', async () => {
    await renderPanel();
    expect(screen.getByTestId('security-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('security-overview-loading')).not.toBeInTheDocument();
  });

  // ── SET-24: the busy row is the row you pressed ──────────────────────────

  const NOW = '2026-02-10T10:00:00.000Z';

  it('spins only the passkey being removed', async () => {
    // Regression: `disabled={remove.isPending}` is one flag for the whole list,
    // so every row went grey and none of them said which one was going.
    let release: (() => void) | undefined;
    removePasskeyMutate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    // Two passkeys, so "only the pressed one" is observable.
    usePasskeysMock.mockReturnValue({
      ...querySuccess(undefined),
      refetch: refetchPasskeys,
      data: [
        { id: 'pk_1', name: 'MacBook Touch ID', createdAt: NOW, lastUsedAt: null },
        { id: 'pk_2', name: 'YubiKey 5C', createdAt: NOW, lastUsedAt: null },
      ],
    });
    const user = userEvent.setup();
    await renderPanel();

    const rows = await screen.findAllByTestId('passkey-remove');
    expect(rows).toHaveLength(2);
    await user.click(rows[0] as HTMLElement);

    const [first, second] = await screen.findAllByTestId('passkey-remove');
    expect(first).toHaveAttribute('aria-busy', 'true');
    expect(first?.querySelector('.animate-spin')).not.toBeNull();
    // The other row is untouched: removing one credential is not a reason to
    // take the rest of the list away (SET-24). Each row owns its own mutation,
    // so its own single-flight guard covers a double-click on ITS button.
    expect(second).toBeEnabled();
    expect(second).not.toHaveAttribute('aria-busy', 'true');
    expect(second?.querySelector('.animate-spin')).toBeNull();

    await act(async () => release?.());
  });

  it('contains a crash in the passkeys card to that card', async () => {
    // Two independent credential features share this panel: a throw in one must
    // leave the other usable.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    passkeysCardCrashes.value = true;
    await renderPanel();

    expect(await screen.findByTestId('passkeys-card-error')).toBeInTheDocument();
    // Two-factor management is untouched.
    expect(screen.getByTestId('settings-section-security')).toBeInTheDocument();
    expect(screen.queryByTestId('mfa-card-error')).not.toBeInTheDocument();
    passkeysCardCrashes.value = false;
    consoleError.mockRestore();
  });
});
