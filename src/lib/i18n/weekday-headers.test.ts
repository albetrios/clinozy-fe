import { describe, expect, it } from 'vitest';

import { weekdayHeaders } from './weekday-headers.ts';

describe('weekdayHeaders — two letters (the month grids)', () => {
  it('cuts English to the design’s "Su Mo Tu We Th Fr Sa", Sunday first', () => {
    expect(weekdayHeaders('en-GB')).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
    expect(weekdayHeaders('en-US')).toEqual(weekdayHeaders('en-IN'));
  });

  it('keeps German’s own two letters, without the period', () => {
    expect(weekdayHeaders('de-DE')).toEqual(['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']);
  });

  it('cuts Latin and Cyrillic in the locale’s own case', () => {
    expect(weekdayHeaders('fr-FR')).toEqual(['di', 'lu', 'ma', 'me', 'je', 've', 'sa']);
    expect(weekdayHeaders('ru-RU')).toEqual(['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']);
  });

  it('keeps a third letter where two would read two days alike (Portuguese)', () => {
    const headers = weekdayHeaders('pt-BR');
    expect(headers).toEqual(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']);
    expect(new Set(headers).size).toBe(7);
  });

  it('takes the narrow form where the short one repeats a prefix (Vietnamese)', () => {
    expect(weekdayHeaders('vi-VN')).toEqual(['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);
  });

  it('keeps Arabic’s narrow letters — its short names are whole words', () => {
    expect(weekdayHeaders('ar-SA')).toEqual(['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']);
  });

  it('keeps Japanese, Korean and Chinese single characters', () => {
    expect(weekdayHeaders('ja-JP')).toEqual(['日', '月', '火', '水', '木', '金', '土']);
    expect(weekdayHeaders('ko-KR')).toEqual(['일', '월', '화', '수', '목', '금', '토']);
    // The short "周一" repeats 周 in every column; the narrow form drops it.
    expect(weekdayHeaders('zh-CN')).toEqual(['日', '一', '二', '三', '四', '五', '六']);
  });

  it('keeps Devanagari’s narrow syllables', () => {
    expect(weekdayHeaders('hi-IN')).toEqual(['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श']);
  });

  it('indexes by Date#getDay, so a Monday-first grid reads Monday first', () => {
    const headers = weekdayHeaders('en-GB');
    const monday = new Date(2026, 9, 5);
    expect(headers[monday.getDay()]).toBe('Mo');
  });

  it('falls back to English for a tag Intl rejects', () => {
    expect(weekdayHeaders('not a locale')).toEqual([
      'Su',
      'Mo',
      'Tu',
      'We',
      'Th',
      'Fr',
      'Sa',
    ]);
  });
});

describe('weekdayHeaders — short (the appointments boards)', () => {
  it('reads the locale’s short names', () => {
    expect(weekdayHeaders('en-GB', 'short')).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]);
    expect(weekdayHeaders('de-DE', 'short')[1]).toBe('Mo');
  });
});
