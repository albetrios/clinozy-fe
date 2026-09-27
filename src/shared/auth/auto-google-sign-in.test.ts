import { afterEach, describe, expect, it } from 'vitest';

import {
  clearAutoGoogleSignInSkip,
  shouldAttemptAutoGoogleSignIn,
  skipAutoGoogleSignIn,
} from './auto-google-sign-in.ts';

afterEach(() => {
  sessionStorage.clear();
});

describe('auto-google-sign-in', () => {
  it('allows auto sign-in by default', () => {
    expect(shouldAttemptAutoGoogleSignIn()).toBe(true);
  });

  it('skips after skipAutoGoogleSignIn', () => {
    skipAutoGoogleSignIn();
    expect(shouldAttemptAutoGoogleSignIn()).toBe(false);
  });

  it('clears skip flag', () => {
    skipAutoGoogleSignIn();
    clearAutoGoogleSignInSkip();
    expect(shouldAttemptAutoGoogleSignIn()).toBe(true);
  });
});
