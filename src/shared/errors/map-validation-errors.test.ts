import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { ValidationError } from '@/shared/errors/AppError.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

import { formFieldOf, mapValidationErrors } from './map-validation-errors.ts';

describe('mapValidationErrors', () => {
  it('maps ValidationError fieldErrors onto RHF setError', () => {
    const setError = vi.fn();
    const applied = mapValidationErrors(
      new ValidationError('Invalid', { email: ['Taken'], name: ['Required'] }),
      setError as UseFormSetError<FieldValues>,
    );
    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'Taken',
    });
    expect(setError).toHaveBeenCalledWith('name', {
      type: 'server',
      message: 'Required',
    });
  });

  it('maps HttpError 422 envelope fields', () => {
    const setError = vi.fn();
    const err = new HttpError('HTTP 422', 422, '/x', 'POST', {
      error: { fields: { slug: ['Already in use'] } },
    });
    expect(mapValidationErrors(err, setError as UseFormSetError<FieldValues>)).toBe(true);
    expect(setError).toHaveBeenCalledWith('slug' as Path<FieldValues>, {
      type: 'server',
      message: 'Already in use',
    });
  });

  it("maps clinozy-be's 400 errors[] onto the form's fields", () => {
    const setError = vi.fn();
    const err = new HttpError('HTTP 400', 400, '/x', 'POST', {
      error: {
        type: 'validation_error',
        code: 'invalid_field',
        detail: 'Check the highlighted fields',
        errors: [
          { field: 'first_name', message: 'Required' },
          { field: 'body.items/0/discount_percent', message: 'At most 100' },
          { field: 'querystring.limit', message: 'At most 100' },
          { field: 'first_name', message: 'Too long' },
        ],
      },
    });

    expect(mapValidationErrors(err, setError as UseFormSetError<FieldValues>)).toBe(true);
    expect(setError).toHaveBeenCalledTimes(3);
    expect(setError).toHaveBeenCalledWith('firstName', {
      type: 'server',
      message: 'Required',
    });
    expect(setError).toHaveBeenCalledWith('items.0.discountPercent', {
      type: 'server',
      message: 'At most 100',
    });
    expect(setError).toHaveBeenCalledWith('limit', {
      type: 'server',
      message: 'At most 100',
    });
  });

  it('a 400 with no field list maps nothing', () => {
    const setError = vi.fn();
    const err = new HttpError('HTTP 400', 400, '/x', 'POST', {
      error: {
        type: 'request_error',
        code: 'below_lowest_price',
        detail: 'Below the floor',
      },
    });

    expect(mapValidationErrors(err, setError as UseFormSetError<FieldValues>)).toBe(
      false,
    );
    expect(setError).not.toHaveBeenCalled();
  });

  it('skips list entries with no field or message', () => {
    const setError = vi.fn();
    const err = new HttpError('HTTP 400', 400, '/x', 'POST', {
      error: {
        errors: [
          { field: '', message: 'x' },
          { field: 'q' },
          null,
          { field: 'q', message: 'Type 3 letters' },
        ],
      },
    });

    expect(mapValidationErrors(err, setError as UseFormSetError<FieldValues>)).toBe(true);
    expect(setError).toHaveBeenCalledOnce();
    expect(setError).toHaveBeenCalledWith('q', {
      type: 'server',
      message: 'Type 3 letters',
    });
  });

  it('returns false for non-validation errors', () => {
    const setError = vi.fn();
    expect(
      mapValidationErrors(new Error('boom'), setError as UseFormSetError<FieldValues>),
    ).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});

describe('formFieldOf', () => {
  it('drops the request part, turns path steps into dots and snake_case into camelCase', () => {
    expect(formFieldOf('first_name')).toBe('firstName');
    expect(formFieldOf('body.contact.phones/0/is_on_whatsapp')).toBe(
      'contact.phones.0.isOnWhatsapp',
    );
    expect(formFieldOf('querystring.date_to')).toBe('dateTo');
    expect(formFieldOf('params.lead_id')).toBe('leadId');
    expect(formFieldOf('q')).toBe('q');
  });
});
