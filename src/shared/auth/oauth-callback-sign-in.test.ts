import { vi } from 'vitest';

const {
  oauthCallbackMock,
  establishSessionMock,
  bootstrapWithSignInMock,
  isRevokePendingMock,
} = vi.hoisted(() => ({
  oauthCallbackMock: vi.fn(),
  establishSessionMock: vi.fn(),
  bootstrapWithSignInMock: vi.fn(),
  isRevokePendingMock: vi.fn(),
}));

vi.mock('@/shared/api/auth-api.ts', () => ({
  authApi: { oauthCallback: oauthCallbackMock },
}));
vi.mock('@/shared/auth/service.ts', () => ({
  establishSession: establishSessionMock,
  bootstrapWithSignIn: bootstrapWithSignInMock,
  isRevokePending: isRevokePendingMock,
}));

const STATE = 'a'.repeat(64);
const CODE = '4/0AfJohXk-code';
const SEARCH = `?code=${encodeURIComponent(CODE)}&state=${STATE}`;

/** A fresh module: the boot sign-in is module state, one per page load. */
async function freshModule() {
  vi.resetModules();
  return import('./oauth-callback-sign-in.ts');
}

const at = (pathname: string, search = SEARCH) => ({ pathname, search });

describe('readOAuthCallbackParams', () => {
  it('keeps the inputs that are well-formed, and only those', async () => {
    const { readOAuthCallbackParams } = await freshModule();

    expect(readOAuthCallbackParams('google', SEARCH)).toEqual({
      code: CODE,
      state: STATE,
      provider: 'google',
    });
    expect(readOAuthCallbackParams('Google!', '?code=&state=not-ours')).toEqual({
      code: null,
      state: null,
      provider: null,
    });
  });
});

describe('startOAuthCallbackSignIn', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isRevokePendingMock.mockReturnValue(false);
    oauthCallbackMock.mockResolvedValue({ accessToken: 'token-1' });
    establishSessionMock.mockResolvedValue(undefined);
  });

  it('exchanges the code at boot and hands the sign-in to the bootstrap', async () => {
    const { startOAuthCallbackSignIn, takeOAuthCallbackSignIn } = await freshModule();

    expect(startOAuthCallbackSignIn(at('/callback/google'))).toBe(true);
    const signIn = takeOAuthCallbackSignIn('google', STATE);
    await signIn;

    expect(oauthCallbackMock).toHaveBeenCalledTimes(1);
    expect(oauthCallbackMock).toHaveBeenCalledWith('google', {
      code: CODE,
      state: STATE,
    });
    expect(establishSessionMock).toHaveBeenCalledWith('token-1');
    expect(bootstrapWithSignInMock).toHaveBeenCalledWith(signIn);
  });

  it('hands the sign-in over once, and only for the inputs it started with', async () => {
    const { startOAuthCallbackSignIn, takeOAuthCallbackSignIn } = await freshModule();
    startOAuthCallbackSignIn(at('/callback/google'));

    expect(takeOAuthCallbackSignIn('github', STATE)).toBeNull();
    expect(takeOAuthCallbackSignIn('google', 'b'.repeat(64))).toBeNull();
    expect(takeOAuthCallbackSignIn('google', STATE)).not.toBeNull();
    // The code is single-use: a second taker exchanges nothing it could reuse.
    expect(takeOAuthCallbackSignIn('google', STATE)).toBeNull();
  });

  it.each([
    ['the login screen', at('/login')],
    ['a redirect with no code', at('/callback/google', `?state=${STATE}`)],
    [
      'a state clinozy-be did not mint',
      at('/callback/google', `?code=${CODE}&state=xyz`),
    ],
    ['a provider that is not a slug', at('/callback/Google%20Inc')],
    ['a deeper path', at('/callback/google/extra')],
  ])('starts nothing on %s', async (_case, location) => {
    const { startOAuthCallbackSignIn } = await freshModule();

    expect(startOAuthCallbackSignIn(location)).toBe(false);
    expect(oauthCallbackMock).not.toHaveBeenCalled();
    expect(bootstrapWithSignInMock).not.toHaveBeenCalled();
  });

  it('leaves the exchange to the callback page while a sign-out is still pending', async () => {
    isRevokePendingMock.mockReturnValue(true);
    const { startOAuthCallbackSignIn } = await freshModule();

    expect(startOAuthCallbackSignIn(at('/callback/google'))).toBe(false);
    expect(oauthCallbackMock).not.toHaveBeenCalled();
  });

  it('keeps a failed exchange for the callback page to report', async () => {
    oauthCallbackMock.mockRejectedValue(new Error('spent code'));
    const { startOAuthCallbackSignIn, takeOAuthCallbackSignIn } = await freshModule();
    startOAuthCallbackSignIn(at('/callback/google'));
    // Settles before anyone takes it — and is no unhandled rejection meanwhile.
    await new Promise((resolve) => setTimeout(resolve, 0));

    await expect(takeOAuthCallbackSignIn('google', STATE)).rejects.toThrow('spent code');
    expect(establishSessionMock).not.toHaveBeenCalled();
  });
});
