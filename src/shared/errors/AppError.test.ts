import { describe, expect, it } from 'vitest';

import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './AppError.ts';

describe('AppError', () => {
  it('creates error with message, statusCode, and code', () => {
    const err = new AppError('Something broke', 500, 'INTERNAL');
    expect(err.message).toBe('Something broke');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL');
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('UnauthorizedError', () => {
  it('defaults to 401 and UNAUTHORIZED', () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe('Unauthorized');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.name).toBe('UnauthorizedError');
  });

  it('accepts a custom message', () => {
    const err = new UnauthorizedError('Token expired');
    expect(err.message).toBe('Token expired');
  });
});

describe('ForbiddenError', () => {
  it('defaults to 403 and FORBIDDEN', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.name).toBe('ForbiddenError');
  });
});

describe('NotFoundError', () => {
  it('defaults to 404 and NOT_FOUND', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('NotFoundError');
  });
});

describe('ValidationError', () => {
  it('defaults to 422 with empty field errors', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fieldErrors).toEqual({});
    expect(err.name).toBe('ValidationError');
  });

  it('accepts custom message and field errors', () => {
    const fields = { email: ['Invalid email'] };
    const err = new ValidationError('Bad input', fields);
    expect(err.message).toBe('Bad input');
    expect(err.fieldErrors).toEqual(fields);
  });
});
