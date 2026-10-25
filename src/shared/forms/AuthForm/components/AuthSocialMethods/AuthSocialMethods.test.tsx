import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { preconnectOAuthProvider } from '../../oauth-preconnect.ts';
import { AuthSocialMethods } from './AuthSocialMethods.tsx';

vi.mock('../../oauth-preconnect.ts', () => ({ preconnectOAuthProvider: vi.fn() }));

function renderMethods(overrides: Partial<Parameters<typeof AuthSocialMethods>[0]> = {}) {
  const onProvider = vi.fn();
  const onPasskey = vi.fn();
  const utils = render(
    <AuthSocialMethods
      providers={['google', 'github']}
      showPasskey
      pending={null}
      onProvider={onProvider}
      onPasskey={onPasskey}
      providerTestId={(p) => `auth-continue-${p}`}
      passkeyTestId="auth-continue-passkey"
      {...overrides}
    />,
  );
  return { ...utils, onProvider, onPasskey };
}

describe('AuthSocialMethods', () => {
  it('renders one button per configured provider', () => {
    renderMethods();
    expect(screen.getByTestId('auth-continue-google')).toBeInTheDocument();
    expect(screen.getByTestId('auth-continue-github')).toBeInTheDocument();
  });

  it('hides passkey when it is not available', () => {
    renderMethods({ showPasskey: false });
    expect(screen.queryByTestId('auth-continue-passkey')).not.toBeInTheDocument();
  });

  it('reports the chosen provider to the parent', async () => {
    const user = userEvent.setup();
    const { onProvider } = renderMethods();
    await user.click(screen.getByTestId('auth-continue-github'));
    expect(onProvider).toHaveBeenCalledWith('github');
  });

  it('connects to a provider’s sign-in page on the press, before the click lands', async () => {
    const user = userEvent.setup();
    renderMethods();
    await user.pointer({
      keys: '[MouseLeft>]',
      target: screen.getByTestId('auth-continue-google'),
    });

    expect(preconnectOAuthProvider).toHaveBeenCalledWith('google');
  });

  it('disables every method while one is in flight', () => {
    renderMethods({ pending: { method: 'oauth', provider: 'google' } });
    expect(screen.getByTestId('auth-continue-google')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByTestId('auth-continue-github')).toBeDisabled();
    expect(screen.getByTestId('auth-continue-passkey')).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderMethods();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
