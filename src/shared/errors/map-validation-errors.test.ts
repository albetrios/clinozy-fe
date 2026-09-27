import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { ValidationError } from '@/shared/errors/AppError.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

import { mapValidationErrors } from './map-validation-errors.ts';

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

  it('returns false for non-validation errors', () => {
    const setError = vi.fn();
    expect(
      mapValidationErrors(new Error('boom'), setError as UseFormSetError<FieldValues>),
    ).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
