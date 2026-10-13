import { describe, expect, it } from 'vitest';

import { reportFileFormats } from './report-file.ts';

describe('reportFileFormats — the formats of a report’s files', () => {
  it('reads nothing for a report with no files', () => {
    expect(reportFileFormats([])).toBe('');
  });

  it('names each format once, in the order first attached', () => {
    expect(
      reportFileFormats([
        'org/reports/cbc.pdf',
        'org/reports/scan.png',
        'org/reports/notes.pdf',
        'org/reports/photo.jpg',
      ]),
    ).toBe('PDF, PNG, JPG');
  });

  it('reads JPEG as JPG, whatever the extension’s case', () => {
    expect(reportFileFormats(['a.JPEG', 'b.Jpg', 'c.PDF'])).toBe('JPG, PDF');
  });

  it('leaves out a file the File field never takes, and a key with no extension', () => {
    expect(reportFileFormats(['a.docx', 'b', 'c.heic'])).toBe('');
    expect(reportFileFormats(['a.docx', 'b.png'])).toBe('PNG');
  });

  it('reads the last extension of a key with dots in its name', () => {
    expect(reportFileFormats(['blood.report.v2.pdf', 'archive.pdf.zip'])).toBe('PDF');
  });
});
