import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';

import {
  holidaySchema,
  INLINE_EDIT_ATTRIBUTE,
  isInlineEditEscape,
  placeNameSchema,
  reportRowWriteFailure,
  usePlaceDrafts,
} from './branch-places-form.ts';
import { placesSummary } from './branch-places-view.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { error: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

beforeEach(() => notifyMock.error.mockReset());

describe('the rows’ schemas', () => {
  it('trims a name, and refuses an empty or a long one', () => {
    expect(placeNameSchema.parse({ name: '  Room 1 ' })).toEqual({ name: 'Room 1' });
    expect(placeNameSchema.safeParse({ name: '   ' }).error?.issues[0]?.message).toBe(
      'drawer.places.nameMissing',
    );
    expect(
      placeNameSchema.safeParse({ name: 'x'.repeat(61) }).error?.issues[0]?.message,
    ).toBe('drawer.places.nameTooLong');
  });

  it('needs a holiday’s date and label', () => {
    const missing = holidaySchema.safeParse({ date: null, label: ' ' });
    expect(missing.error?.issues.map((issue) => issue.message)).toEqual([
      'drawer.places.dateMissing',
      'drawer.places.labelMissing',
    ]);
    expect(holidaySchema.parse({ date: '2026-11-08', label: ' Diwali ' })).toEqual({
      date: '2026-11-08',
      label: 'Diwali',
    });
  });
});

describe('reportRowWriteFailure', () => {
  const conflict = (reason?: string) =>
    new HttpError(
      'Conflict',
      409,
      '/app/branches',
      'POST',
      reason ? { error: { reason, detail: 'Changed' } } : {},
    );

  it('a reasonless 409 is a name the branch already has', () => {
    const onTaken = vi.fn();
    reportRowWriteFailure(conflict(), { onTaken });
    expect(onTaken).toHaveBeenCalledTimes(1);
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('someone else’s change first: a toast, and the list read again', () => {
    const onTaken = vi.fn();
    const onStale = vi.fn();
    reportRowWriteFailure(conflict('record_changed'), { onTaken, onStale });
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onTaken).not.toHaveBeenCalled();
    expect(notifyMock.error).toHaveBeenCalledTimes(1);
  });

  it('a 400 naming a field the row holds outlines it; any other is a toast', () => {
    const setFieldError = vi.fn();
    const invalid = new HttpError('Bad Request', 400, '/app/branches', 'POST', {
      error: {
        type: 'validation_error',
        errors: [{ field: 'body.holiday_date', message: 'Not a date' }],
      },
    });
    reportRowWriteFailure(invalid, {
      onTaken: vi.fn(),
      fields: { holidayDate: 'date' },
      setFieldError,
    });
    expect(setFieldError).toHaveBeenCalledWith('date', 'Not a date');
    expect(notifyMock.error).not.toHaveBeenCalled();

    reportRowWriteFailure(invalid, { onTaken: vi.fn(), fields: {}, setFieldError });
    expect(notifyMock.error).toHaveBeenCalledTimes(1);
  });
});

describe('usePlaceDrafts', () => {
  it('is dirty while any row editor holds unsaved text', () => {
    const { result } = renderHook(() => usePlaceDrafts());
    expect(result.current.dirty).toBe(false);
    act(() => result.current.report('room-add', true));
    act(() => result.current.report('holiday-add', true));
    act(() => result.current.report('room-add', false));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.report('holiday-add', false));
    expect(result.current.dirty).toBe(false);
  });
});

describe('isInlineEditEscape', () => {
  it('is an Esc that began inside an open rename row', () => {
    const row = document.createElement('form');
    row.setAttribute(INLINE_EDIT_ATTRIBUTE, '');
    const input = document.createElement('input');
    row.append(input);
    const inside = new KeyboardEvent('keydown', { key: 'Escape' });
    Object.defineProperty(inside, 'target', { value: input });
    const outside = new KeyboardEvent('keydown', { key: 'Escape' });
    Object.defineProperty(outside, 'target', { value: document.body });
    expect(isInlineEditEscape(inside)).toBe(true);
    expect(isInlineEditEscape(outside)).toBe(false);
  });
});

describe('placesSummary', () => {
  const t = ((key: string, options?: { count?: number }) =>
    options?.count === undefined ? key : `${key}:${options.count}`) as never;

  it('counts the lists that hold something, else says there is nothing yet', () => {
    const room = { id: 'brm_a' } as never;
    const holiday = { id: 'bhd_a' } as never;
    expect(
      placesSummary({ rooms: [room, room], machines: [], holidays: [holiday] }, t),
    ).toBe('drawer.places.counts.room:2 · drawer.places.counts.holiday:1');
    expect(placesSummary({ rooms: [], machines: [], holidays: [] }, t)).toBe(
      'drawer.places.nothingYet',
    );
  });
});
