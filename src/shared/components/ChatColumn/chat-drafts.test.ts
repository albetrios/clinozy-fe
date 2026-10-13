import { afterEach, describe, expect, it } from 'vitest';

import { clearDrafts, readDraft, writeDraft } from './chat-drafts.ts';

afterEach(() => clearDrafts());

describe('composer drafts', () => {
  it('keeps each thread’s unsent text apart', () => {
    writeDraft('lead:a', 'Hi Anaya');
    writeDraft('lead:b', 'Hi Kabir');
    expect(readDraft('lead:a')).toBe('Hi Anaya');
    expect(readDraft('lead:b')).toBe('Hi Kabir');
    expect(readDraft('patient:c')).toBe('');
  });

  it('forgets a thread’s draft when its text is cleared', () => {
    writeDraft('lead:a', 'Hi');
    writeDraft('lead:a', '');
    expect(readDraft('lead:a')).toBe('');
  });

  it('forgets everything on clear', () => {
    writeDraft('lead:a', 'Hi');
    clearDrafts();
    expect(readDraft('lead:a')).toBe('');
  });
});
