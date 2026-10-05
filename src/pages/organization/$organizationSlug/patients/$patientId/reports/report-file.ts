/** The formats a report's file can be (`S:447`), by the stored name's extension. */
const FILE_FORMATS: Readonly<Record<string, string>> = {
  pdf: 'PDF',
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
};

/**
 * "PDF" — a report's first file's format, the Report view's file line and the
 * Reports table's sub line; a report with none reads as drawn (H:4019).
 */
export function reportFileFormat(files: readonly string[]): string {
  const extension = files[0]?.split('.').pop()?.toLowerCase() ?? '';
  return FILE_FORMATS[extension] ?? 'PDF';
}
