import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatPerson } from '@/shared/api/app/messages-contracts.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

const { liveApi, offeringsApi } = vi.hoisted(() => ({
  liveApi: { fetchContactTemplateValues: vi.fn() },
  offeringsApi: { fetchAllOfferings: vi.fn() },
}));
vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...liveApi,
}));
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...offeringsApi,
}));

import type { ChatContact } from './chat-composer.ts';
import { useChatFormat, useMessageContext } from './chat-format.ts';

/** A contact's stream on clinozy-be: its template values are the live read's. */
const STREAM: ChatPerson = { kind: 'contact', contactId: 'con_anaya0000000000000000' };

const ANAYA: ChatContact = { name: 'Anaya Desai', phone: null, isPatient: false };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

function renderContext(contact: ChatContact = ANAYA) {
  return renderHook(
    () => {
      const format = useChatFormat(false);
      return useMessageContext({
        person: STREAM,
        contact,
        clock: format.clock,
        upcoming: null,
      });
    },
    { wrapper },
  );
}

const signInAs = (user: Partial<AuthUser> | null) =>
  useAuthStore.setState({
    user: user
      ? ({
          id: 'usr_x',
          email: 'riya.shah@cresence.skin',
          role: 'user',
          ...user,
        } as AuthUser)
      : null,
  });

beforeEach(() => {
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  liveApi.fetchContactTemplateValues.mockReset();
  offeringsApi.fetchAllOfferings.mockReset();
  offeringsApi.fetchAllOfferings.mockResolvedValue([]);
});
afterEach(() => {
  client.clear();
  useAuthStore.setState({ user: null });
});

describe('useChatFormat', () => {
  it('carries the privacy switch and keeps one format while nothing changes', () => {
    const { result, rerender } = renderHook(({ mask }) => useChatFormat(mask), {
      wrapper,
      initialProps: { mask: true },
    });
    const first = result.current;
    expect(first.maskMoney).toBe(true);
    rerender({ mask: true });
    expect(result.current).toBe(first);
    rerender({ mask: false });
    expect(result.current.maskMoney).toBe(false);
  });
});

describe('useMessageContext — what a message is filled with', () => {
  it('names the signed-in member: their first name, and "Riya S." in a signature', () => {
    signInAs({ name: 'Riya Shah' });
    liveApi.fetchContactTemplateValues.mockReturnValue(new Promise(() => undefined));
    const { result } = renderContext();
    expect(result.current.ctx.me).toEqual({ first: 'Riya', short: 'Riya S.' });
  });

  it('falls back to the email’s name for a member with a blank name', () => {
    signInAs({ name: '   ' });
    liveApi.fetchContactTemplateValues.mockReturnValue(new Promise(() => undefined));
    const { result } = renderContext();
    expect(result.current.ctx.me).toEqual({ first: 'riya.shah', short: 'riya.shah' });
  });

  it('names nobody when no one is signed in', () => {
    signInAs(null);
    liveApi.fetchContactTemplateValues.mockReturnValue(new Promise(() => undefined));
    const { result } = renderContext();
    expect(result.current.ctx.me).toEqual({ first: '', short: '' });
  });

  it('writes to the person by first name — "there" when the record has none', () => {
    liveApi.fetchContactTemplateValues.mockReturnValue(new Promise(() => undefined));
    expect(renderContext().result.current.ctx.first).toBe('Anaya');
    expect(renderContext({ ...ANAYA, name: '  ' }).result.current.ctx.first).toBe(
      'there',
    );
  });

  it('leaves the clinic’s values blank until they are read — never undefined in a message', () => {
    liveApi.fetchContactTemplateValues.mockReturnValue(new Promise(() => undefined));
    const { result } = renderContext();
    expect(result.current.ctx).toMatchObject({
      clinic: '',
      mapsLink: '',
      freeSlots: [],
      offering: null,
    });
    expect(
      Object.values(result.current.fill).every((value) => typeof value === 'string'),
    ).toBe(true);
  });

  it('fills the clinic’s name, links and address from the live read', async () => {
    liveApi.fetchContactTemplateValues.mockResolvedValue({
      clinicName: 'Cresence Skin',
      address: 'Adajan, Surat',
      mapsLink: 'maps.app.goo.gl/cresence',
      reviewLink: 'g.page/r/cresence',
      freeSlots: [{ date: '2026-10-04', time: '11:00' }],
    });
    const { result } = renderContext();
    await waitFor(() => expect(result.current.ctx.clinic).toBe('Cresence Skin'));
    expect(result.current.ctx.mapsLink).toBe('maps.app.goo.gl/cresence');
    expect(result.current.ctx.freeSlots).toEqual([{ date: '2026-10-04', time: '11:00' }]);
    expect(result.current.fill).toMatchObject({
      address: 'Adajan, Surat',
      'maps link': 'maps.app.goo.gl/cresence',
    });
  });

  it('names the offering their interest points to, at what it bills before any offer', async () => {
    liveApi.fetchContactTemplateValues.mockReturnValue(new Promise(() => undefined));
    offeringsApi.fetchAllOfferings.mockResolvedValue([
      offeringRecord({
        id: 'off_peel',
        name: 'Research Peel',
        price: 2000,
        offerPrice: null,
      }),
      offeringRecord({
        id: 'off_hydra',
        name: 'Hydrafacial Glow',
        price: 4500,
        offerPrice: 4000,
        sessions: 6,
      }),
    ]);
    const { result } = renderContext({ ...ANAYA, interests: ['others', 'hydrafacial'] });
    await waitFor(() => expect(result.current.ctx.offering).not.toBeNull());
    expect(result.current.ctx.offering).toMatchObject({
      name: 'Hydrafacial Glow',
      sessions: 6,
    });
    expect(result.current.ctx.offering?.price).toMatch(/4,000/);
    expect(result.current.ctx.interest).toBe('Hydrafacial');
  });
});
