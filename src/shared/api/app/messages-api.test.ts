import { describe, expect, it } from 'vitest';

import { MESSAGE_SIDE_EFFECT_KEYS, messageQueryKeys } from './messages-api.ts';
import { chatPersonKey } from './messages-contracts.ts';

describe('query keys', () => {
  it('keys every read per person, under the messaging domain', () => {
    const key = chatPersonKey({
      kind: 'contact',
      contactId: 'con_anaya0000000000000000',
    });
    expect(key).toBe('contact:con_anaya0000000000000000');
    expect(messageQueryKeys.thread(key)).toEqual(['app', 'messages', 'thread', key]);
    expect(messageQueryKeys.templateValues(key)).toEqual([
      'app',
      'messages',
      'template-values',
      key,
    ]);
    expect(messageQueryKeys.status()).toEqual(['app', 'messages', 'status']);
    expect(messageQueryKeys.liveStatus()).toEqual(['app', 'messages', 'status', 'live']);
  });

  it('names the rooms a send can change', () => {
    expect(MESSAGE_SIDE_EFFECT_KEYS).toEqual([
      ['app', 'leads'],
      ['app', 'tasks'],
      ['app', 'contact-threads'],
    ]);
  });
});
