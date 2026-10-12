import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OfferRecord } from '@/shared/api/app/offerings-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { offerRecord, TEST_OFFERING_ID } from '@/tests/utils/offering-doubles.ts';

const { notifyMock, offersApi } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  offersApi: { createOffer: vi.fn(), updateOffer: vi.fn(), fetchOffer: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...offersApi,
}));

import { emptyOfferForm, offerFormOf, type OfferFormValues } from './offer-form.ts';
import { useOfferSave } from './use-offer-save.ts';

/** An offering the catalogue knows, and one it does not. */
const NAMES: Readonly<Record<string, string>> = { [TEST_OFFERING_ID]: 'Research Peel' };
const UNKNOWN_OFFERING_ID = 'off_zzzzzzzzzzzzzzzzzzzzz';

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, '/api/v1/app/offers', 'POST', { error });

/** clinozy-be's "not an active offering" refusal, naming the offering by its id. */
const inactive = (field: string, offeringId: string) =>
  refusal(400, {
    type: 'validation_error',
    detail: `${offeringId} is not an active offering of this organization`,
    errors: [
      { field, message: `${offeringId} is not an active offering of this organization` },
    ],
  });

/** A new 20% offer on Research Peel. */
const diwali = (patch: Partial<OfferFormValues> = {}): OfferFormValues => ({
  ...emptyOfferForm(),
  name: ' Diwali glow ',
  kind: 'percent',
  value: '20',
  offeringIds: [TEST_OFFERING_ID],
  ...patch,
});

describe('useOfferSave — the Offer drawer’s write', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    offer = null,
    values,
  }: {
    offer?: OfferRecord | null;
    values: OfferFormValues;
  }) {
    const onField = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<OfferFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useOfferSave({
            form,
            offer,
            nameOf: (offeringId) => NAMES[offeringId],
            onField,
            onDone,
          }),
        };
      },
      { wrapper },
    );
    return { ...view, onField, onDone };
  }

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const fn of [...Object.values(notifyMock), ...Object.values(offersApi)]) {
      fn.mockReset();
    }
  });
  afterEach(() => client.clear());

  describe('its rules, before anything is sent', () => {
    it('asks for a value by the offer’s kind — a zero is no value', async () => {
      const cases: [OfferFormValues['kind'], string][] = [
        ['percent', 'Set the discount'],
        ['amount', 'Set the amount'],
        ['extra', 'Set the free sessions'],
      ];
      for (const [kind, message] of cases) {
        const { result, onField } = render({ values: diwali({ kind, value: '0' }) });
        await act(() => result.current.drawer.save());
        expect(onField).toHaveBeenCalledWith('value');
        expect(notifyMock.warning).toHaveBeenLastCalledWith(message);
      }
      const blank = render({ values: diwali({ value: '' }) });
      await act(() => blank.result.current.drawer.save());
      expect(notifyMock.warning).toHaveBeenLastCalledWith('Set the discount');
      expect(offersApi.createOffer).not.toHaveBeenCalled();
    });

    it('refuses an end before the start — the same day is fine', async () => {
      const backwards = render({
        values: diwali({ startsOn: '2026-10-20', endsOn: '2026-10-19' }),
      });
      await act(() => backwards.result.current.drawer.save());
      expect(backwards.onField).toHaveBeenCalledWith('endsOn');
      expect(notifyMock.warning).toHaveBeenCalledWith('Ends before it starts');
      expect(offersApi.createOffer).not.toHaveBeenCalled();

      offersApi.createOffer.mockResolvedValue(offerRecord());
      const oneDay = render({
        values: diwali({ startsOn: '2026-10-20', endsOn: '2026-10-20' }),
      });
      await act(() => oneDay.result.current.drawer.save());
      expect(offersApi.createOffer).toHaveBeenCalledOnce();
    });
  });

  describe('the write', () => {
    it('creates the offer — the name trimmed, an empty code and note as none — and closes', async () => {
      offersApi.createOffer.mockResolvedValue(offerRecord());
      const { result, onDone } = render({ values: diwali({ code: '', note: '  ' }) });

      await act(() => result.current.drawer.save());

      expect(offersApi.createOffer).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          name: 'Diwali glow',
          code: null,
          note: null,
          kind: 'percent',
          value: 20,
          offeringIds: [TEST_OFFERING_ID],
          isActive: true,
        }),
        idempotencyKey: expect.any(String),
      });
      expect(onDone).toHaveBeenCalledOnce();
    });

    it('saves an edit against the offer as read', async () => {
      const offer = offerRecord();
      offersApi.updateOffer.mockResolvedValue({ ...offer, name: 'Diwali glow+' });
      const { result } = render({
        offer,
        values: { ...offerFormOf(offer), name: 'Diwali glow+' },
      });

      await act(() => result.current.drawer.save());

      expect(offersApi.updateOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          record: offer,
          fields: expect.objectContaining({ name: 'Diwali glow+' }),
          idempotencyKey: expect.any(String),
        }),
      );
      expect(offersApi.createOffer).not.toHaveBeenCalled();
    });
  });

  describe('the server’s refusals', () => {
    it('outlines Code when another live offer uses it', async () => {
      offersApi.createOffer.mockRejectedValue(
        refusal(409, { reason: 'offer_code_in_use', detail: 'DIWALI25 is in use' }),
      );
      const { result, onField, onDone } = render({
        values: diwali({ code: 'DIWALI25' }),
      });

      await act(() => result.current.drawer.save());

      const message = result.current.form.getFieldState('code').error?.message;
      expect(message).toBeTruthy();
      expect(onField).toHaveBeenCalledWith('code');
      expect(notifyMock.error).toHaveBeenCalledWith(message, { id: 'offer-save-failed' });
      expect(onDone).not.toHaveBeenCalled();
    });

    it('names an offering no longer active by its name, on the picker', async () => {
      offersApi.createOffer.mockRejectedValue(inactive('offering_ids', TEST_OFFERING_ID));
      const { result, onField } = render({ values: diwali() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('offeringIds').error?.message).toBe(
        'Research Peel is no longer active — remove it or pick another',
      );
      expect(onField).toHaveBeenCalledWith('offeringIds');
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Research Peel is no longer active — remove it or pick another',
      );
    });

    it('keeps the server’s words for an offering the catalogue cannot name', async () => {
      offersApi.createOffer.mockRejectedValue(
        inactive('offering_ids', UNKNOWN_OFFERING_ID),
      );
      const { result } = render({ values: diwali() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('offeringIds').error?.message).toBe(
        `${UNKNOWN_OFFERING_ID} is not an active offering of this organization`,
      );
    });

    it('names an inactive offering on the picker when the server names its place in the list', async () => {
      offersApi.createOffer.mockRejectedValue(
        inactive('body.offering_ids/1', TEST_OFFERING_ID),
      );
      const { result, onField } = render({ values: diwali() });

      await act(() => result.current.drawer.save());

      expect(onField).toHaveBeenCalledWith('offeringIds');
      expect(result.current.form.getFieldState('offeringIds').error?.message).toBe(
        'Research Peel is no longer active — remove it or pick another',
      );
    });

    it('puts a refused Status on the Live switch — the API calls it is_active', async () => {
      offersApi.createOffer.mockRejectedValue(
        refusal(400, {
          type: 'validation_error',
          errors: [
            { field: 'body.is_active', message: 'Cannot go live without offerings' },
          ],
        }),
      );
      const { result, onField } = render({ values: diwali() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('live').error?.message).toBe(
        'Cannot go live without offerings',
      );
      expect(onField).toHaveBeenCalledWith('live');
    });

    it('reads a stale offer again on Reload and restarts the form on what was saved', async () => {
      const offer = offerRecord();
      const fresh = {
        ...offer,
        name: 'Renamed elsewhere',
        updatedAt: '2026-10-12T06:00:00.000Z',
      };
      offersApi.updateOffer.mockRejectedValue(
        refusal(409, { reason: 'record_changed', detail: 'Changed by usr_x' }),
      );
      offersApi.fetchOffer.mockResolvedValue(fresh);
      const { result } = render({
        offer,
        values: { ...offerFormOf(offer), name: 'Mine' },
      });

      await act(() => result.current.drawer.save());

      const [, options] = notifyMock.error.mock.lastCall as [
        string,
        { action: { label: string; onClick: () => void } },
      ];
      expect(options.action.label).toBe('Reload');
      await act(async () => options.action.onClick());
      await waitFor(() =>
        expect(result.current.form.getValues('name')).toBe('Renamed elsewhere'),
      );
      expect(offersApi.fetchOffer).toHaveBeenCalledWith(offer.id);

      // The next save is guarded by the fresh read.
      offersApi.updateOffer.mockResolvedValue(fresh);
      await act(() => result.current.drawer.save());
      expect(offersApi.updateOffer).toHaveBeenLastCalledWith(
        expect.objectContaining({ record: fresh }),
      );
    });

    it('offers no Reload for a new offer', async () => {
      offersApi.createOffer.mockRejectedValue(
        refusal(409, { reason: 'record_changed', detail: 'Changed by usr_x' }),
      );
      const { result } = render({ values: diwali() });

      await act(() => result.current.drawer.save());

      expect(notifyMock.error).toHaveBeenCalledWith(expect.any(String), {
        id: 'offer-save-failed',
      });
    });
  });
});
