import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  consumeTurnstileToken,
  peekTurnstileToken,
  setTurnstileResetHandler,
  setTurnstileToken,
  subscribeTurnstileToken,
} from './turnstile-token-store.ts';

describe('turnstile-token-store', () => {
  afterEach(() => {
    setTurnstileToken(undefined);
    setTurnstileResetHandler(undefined);
  });

  it('stores and peeks the current token', () => {
    setTurnstileToken('abc');
    expect(peekTurnstileToken()).toBe('abc');
  });

  it('consume returns the token, clears it, and requests a reset', () => {
    const reset = vi.fn();
    setTurnstileResetHandler(reset);
    setTurnstileToken('one');

    expect(consumeTurnstileToken()).toBe('one');
    expect(peekTurnstileToken()).toBeUndefined();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('consume on an empty store returns undefined and does not request a reset', () => {
    const reset = vi.fn();
    setTurnstileResetHandler(reset);

    expect(consumeTurnstileToken()).toBeUndefined();
    expect(reset).not.toHaveBeenCalled();
  });

  it('notifies subscribers when the token changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTurnstileToken(listener);
    setTurnstileToken('fresh');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setTurnstileToken('next');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
