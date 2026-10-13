import { describe, expect, it, vi } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';

import { formatFileSize } from './format-file-size.ts';
import { UPLOAD_TRAY_NS } from './upload-tray.constants.ts';

const t = i18n.getFixedT('en', UPLOAD_TRAY_NS);
const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat('en-IN', options).format(value);
const size = (bytes: number) => formatFileSize(bytes, { t, formatNumber });

const KILOBYTE = 1024;
const MEGABYTE = 1024 * 1024;

describe('formatFileSize — a size as the upload tray writes it', () => {
  it('writes whole kilobytes up to a megabyte', () => {
    expect(size(84 * KILOBYTE)).toBe('84 KB');
    expect(size(84.4 * KILOBYTE)).toBe('84 KB');
    expect(size(84.5 * KILOBYTE)).toBe('85 KB');
  });

  it('never writes less than 1 KB — an empty file included', () => {
    expect(size(0)).toBe('1 KB');
    expect(size(1)).toBe('1 KB');
    expect(size(600)).toBe('1 KB');
  });

  it('keeps exactly one megabyte in kilobytes, and turns to megabytes above it', () => {
    expect(size(MEGABYTE)).toBe('1,024 KB');
    expect(size(MEGABYTE + 1)).toBe('1 MB');
    expect(size(1.25 * MEGABYTE)).toBe('1.3 MB');
    expect(size(25 * MEGABYTE)).toBe('25 MB');
  });

  it('formats the number through the locale formatter, the unit as copy', () => {
    const spy = vi.fn((value: number) => `<${value}>`);
    expect(formatFileSize(1.5 * MEGABYTE, { t, formatNumber: spy })).toBe('<1.5> MB');
    expect(spy).toHaveBeenCalledWith(1.5, { maximumFractionDigits: 1 });
    expect(formatFileSize(2048, { t, formatNumber: spy })).toBe('<2> KB');
    expect(spy).toHaveBeenLastCalledWith(2, { maximumFractionDigits: 0 });
  });
});
