import { formatCountdown, secondsUntil } from './countdown.ts';

describe('secondsUntil', () => {
  it('rounds a part-second up, so the last second still reads 0:01', () => {
    expect(secondsUntil(10_001, 10_000)).toBe(1);
    expect(secondsUntil(10_999, 10_000)).toBe(1);
    expect(secondsUntil(70_000, 10_000)).toBe(60);
  });

  it('never goes below zero once the deadline has passed', () => {
    expect(secondsUntil(10_000, 10_000)).toBe(0);
    expect(secondsUntil(5_000, 10_000)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [60, '1:00'],
    [90, '1:30'],
    [605, '10:05'],
  ])('%i seconds reads %s', (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text);
  });
});
