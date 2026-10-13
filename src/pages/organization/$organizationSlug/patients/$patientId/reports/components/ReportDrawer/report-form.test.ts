import { describe, expect, it } from 'vitest';

import { newReportForm, reportInputOf, takesReportFile } from './report-form.ts';

describe('the Upload report form', () => {
  it('starts a new report as Lab, dated today, nothing else', () => {
    expect(newReportForm('2026-10-12')).toEqual({
      type: 'lab',
      name: '',
      date: '2026-10-12',
      files: [],
      note: '',
    });
  });

  it('sends the name trimmed and a blank note as none', () => {
    expect(
      reportInputOf({
        type: 'scan',
        name: '  Ultrasound abdomen ',
        date: '2026-10-01',
        files: [],
        note: '   ',
      }),
    ).toEqual({
      type: 'scan',
      name: 'Ultrasound abdomen',
      date: '2026-10-01',
      notes: null,
    });
  });

  it('keeps a note’s words, trimmed', () => {
    expect(
      reportInputOf({ ...newReportForm('2026-10-12'), name: 'CBC', note: ' Fasting ' }),
    ).toMatchObject({ name: 'CBC', notes: 'Fasting' });
  });

  it('takes a PDF, a JPG or a PNG — nothing else', () => {
    const file = (type: string) => new File(['x'], 'report', { type });
    expect(takesReportFile(file('application/pdf'))).toBe(true);
    expect(takesReportFile(file('image/jpeg'))).toBe(true);
    expect(takesReportFile(file('image/png'))).toBe(true);
    expect(takesReportFile(file('image/heic'))).toBe(false);
    expect(takesReportFile(file('video/mp4'))).toBe(false);
    expect(takesReportFile(file(''))).toBe(false);
  });
});
