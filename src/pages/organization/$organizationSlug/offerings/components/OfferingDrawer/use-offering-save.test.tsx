import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OfferingRecord } from '@/shared/api/app/offerings-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

const { notifyMock, offeringsApi } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  offeringsApi: { createOffering: vi.fn(), updateOffering: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...offeringsApi,
}));

import {
  emptyOfferingForm,
  offeringFormOf,
  type OfferingFormValues,
} from './offering-form.ts';
import { useOfferingSave } from './use-offering-save.ts';

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, '/api/v1/app/offerings', 'POST', { error });

/** A new offering, Hydrafacial, ₹4,500 billed at ₹4,000. */
const hydrafacial = (patch: Partial<OfferingFormValues> = {}): OfferingFormValues => ({
  ...emptyOfferingForm(),
  name: '  Hydrafacial ',
  price: '4500',
  offerPrice: '4000',
  ...patch,
});

describe('useOfferingSave — the Offering drawer’s write', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    record = null,
    values,
    canSeeFloor = false,
    onStale,
  }: {
    record?: OfferingRecord | null;
    values: OfferingFormValues;
    canSeeFloor?: boolean;
    onStale?: () => void;
  }) {
    const onField = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<OfferingFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useOfferingSave({
            form,
            record,
            canSeeFloor,
            onField,
            onStale,
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
    useOrganizationStore.setState({ permissions: [] });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const fn of [...Object.values(notifyMock), ...Object.values(offeringsApi)]) {
      fn.mockReset();
    }
  });
  afterEach(() => client.clear());

  describe('the price rules, before anything is sent', () => {
    it('refuses an offer price above the price on its own field', async () => {
      const { result, onField } = render({
        values: hydrafacial({ offerPrice: '5000' }),
      });
      await act(() => result.current.drawer.save());
      expect(result.current.form.getFieldState('offerPrice').error?.message).toBe(
        'Offer price can’t be above the price',
      );
      expect(onField).toHaveBeenCalledWith('offerPrice');
      expect(notifyMock.warning).toHaveBeenCalledWith(
        'Offer price can’t be above the price',
      );
      expect(offeringsApi.createOffering).not.toHaveBeenCalled();
    });

    it('refuses a lowest price above what is billed — the offer price, else the price', async () => {
      const aboveOffer = render({
        values: hydrafacial({ minPrice: '4200' }),
        canSeeFloor: true,
      });
      await act(() => aboveOffer.result.current.drawer.save());
      expect(aboveOffer.onField).toHaveBeenCalledWith('minPrice');
      expect(notifyMock.warning).toHaveBeenLastCalledWith(
        'Lowest price can’t be above the offer price',
      );

      const abovePrice = render({
        values: hydrafacial({ offerPrice: '', minPrice: '4600' }),
        canSeeFloor: true,
      });
      await act(() => abovePrice.result.current.drawer.save());
      expect(notifyMock.warning).toHaveBeenLastCalledWith(
        'Lowest price can’t be above the price',
      );
      expect(offeringsApi.createOffering).not.toHaveBeenCalled();
    });

    it('lets an offer price equal to the price through — it bills the list price', async () => {
      offeringsApi.createOffering.mockResolvedValue(offeringRecord());
      const { result } = render({ values: hydrafacial({ offerPrice: '4500' }) });
      await act(() => result.current.drawer.save());
      expect(notifyMock.warning).not.toHaveBeenCalled();
      const [vars] = offeringsApi.createOffering.mock.lastCall as [
        { fields: { offerPrice: number | null } },
      ];
      expect(vars.fields.offerPrice).toBeNull();
    });
  });

  describe('the write', () => {
    it('creates the offering — the name trimmed, money in rupees, no floor from a member who cannot see it', async () => {
      const created = offeringRecord({ name: 'Hydrafacial', offeringNumber: 8 });
      offeringsApi.createOffering.mockResolvedValue(created);
      const { result, onDone } = render({
        values: hydrafacial({ minPrice: '3000', searchTerms: 'glow, , hydra ' }),
      });

      await act(() => result.current.drawer.save());

      expect(offeringsApi.createOffering).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          name: 'Hydrafacial',
          price: 4500,
          offerPrice: 4000,
          minPrice: null,
          searchTerms: ['glow', 'hydra'],
        }),
        canSetLowestPrice: false,
        idempotencyKey: expect.any(String),
      });
      expect(onDone).toHaveBeenCalledWith({ kind: 'created', offering: created }, false);
      // The write's own toast: "Offering #8 created".
      const [toast] = notifyMock.success.mock.lastCall as [string];
      expect(withoutBidiMarks(toast)).toBe('Offering #8 created');
    });

    it('sends the floor from a member who may set it', async () => {
      useOrganizationStore.setState({ permissions: ['offering:lower_price:read'] });
      offeringsApi.createOffering.mockResolvedValue(offeringRecord());
      const { result } = render({
        values: hydrafacial({ minPrice: '3500' }),
        canSeeFloor: true,
      });

      await act(() => result.current.drawer.save());

      expect(offeringsApi.createOffering).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.objectContaining({ minPrice: 3500 }),
          canSetLowestPrice: true,
        }),
      );
    });

    it('saves an edit against the record as read', async () => {
      const record = offeringRecord();
      offeringsApi.updateOffering.mockResolvedValue({ ...record, price: 2200 });
      const { result, onDone } = render({
        record,
        values: { ...offeringFormOf(record), price: '2200' },
        canSeeFloor: true,
      });

      await act(() => result.current.drawer.save());

      expect(offeringsApi.updateOffering).toHaveBeenCalledWith(
        expect.objectContaining({
          record,
          fields: expect.objectContaining({ price: 2200 }),
          idempotencyKey: expect.any(String),
        }),
      );
      expect(offeringsApi.createOffering).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith(
        { kind: 'saved', offering: { ...record, price: 2200 } },
        false,
      );
    });
  });

  describe('the server’s refusals', () => {
    it('outlines Name for a name another offering has', async () => {
      offeringsApi.createOffering.mockRejectedValue(
        refusal(409, {
          reason: 'offering_name_taken',
          detail: 'An offering named Hydrafacial already exists',
        }),
      );
      const { result, onField, onDone } = render({ values: hydrafacial() });

      await act(() => result.current.drawer.save());

      const message = result.current.form.getFieldState('name').error?.message;
      expect(message).toBeTruthy();
      expect(onField).toHaveBeenCalledWith('name');
      expect(notifyMock.error).toHaveBeenCalledWith(message, {
        id: 'offering-save-failed',
      });
      expect(onDone).not.toHaveBeenCalled();
    });

    it('says a hidden floor’s refusal on the offer price, in the member’s words', async () => {
      offeringsApi.createOffering.mockRejectedValue(
        refusal(400, {
          type: 'validation_error',
          errors: [{ field: 'body.min_price', message: 'Must be at most offer_price' }],
        }),
      );
      const { result, onField } = render({ values: hydrafacial() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('offerPrice').error?.message).toBe(
        'Below this offering’s lowest price — ask an Owner or Admin',
      );
      expect(result.current.form.getFieldState('minPrice').error).toBeUndefined();
      expect(onField).toHaveBeenCalledWith('offerPrice');
    });

    it('says it on the price when nothing is billed below the price', async () => {
      offeringsApi.createOffering.mockRejectedValue(
        refusal(400, {
          type: 'validation_error',
          errors: [{ field: 'min_price', message: 'Must be at most price' }],
        }),
      );
      const { result, onField } = render({ values: hydrafacial({ offerPrice: '' }) });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('price').error?.message).toBe(
        'Below this offering’s lowest price — ask an Owner or Admin',
      );
      expect(onField).toHaveBeenCalledWith('price');
    });

    it('puts a role that lost the floor on Lowest price', async () => {
      offeringsApi.createOffering.mockRejectedValue(
        refusal(403, {
          reason: 'field_permission_required',
          detail: 'min_price needs a code',
        }),
      );
      const { result, onField } = render({
        values: hydrafacial({ minPrice: '3000' }),
        canSeeFloor: true,
      });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('minPrice').error?.message).toBe(
        'Your role can’t change the lowest price — ask an Owner or Admin',
      );
      expect(onField).toHaveBeenCalledWith('minPrice');
    });

    it('puts a refused search term on the one Search terms field', async () => {
      offeringsApi.createOffering.mockRejectedValue(
        refusal(400, {
          type: 'validation_error',
          errors: [{ field: 'body.search_terms/3', message: 'At most 40 characters' }],
        }),
      );
      const { result, onField } = render({ values: hydrafacial() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('searchTerms').error?.message).toBe(
        'At most 40 characters',
      );
      expect(onField).toHaveBeenCalledWith('searchTerms');
    });

    it('offers Reload for a stale save', async () => {
      const record = offeringRecord();
      const onStale = vi.fn();
      offeringsApi.updateOffering.mockRejectedValue(
        refusal(409, { reason: 'record_changed', detail: 'Changed by usr_x' }),
      );
      const { result } = render({
        record,
        values: { ...offeringFormOf(record), name: 'Peel' },
        onStale,
      });

      await act(() => result.current.drawer.save());

      const [, options] = notifyMock.error.mock.lastCall as [
        string,
        { action: { label: string; onClick: () => void } },
      ];
      expect(options.action.label).toBe('Reload');
      options.action.onClick();
      expect(onStale).toHaveBeenCalledOnce();
      expect(result.current.form.getFieldState('name').error).toBeUndefined();
    });
  });
});
