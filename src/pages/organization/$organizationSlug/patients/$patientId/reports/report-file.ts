/** The formats a report's file can be (`S:447`), by the stored key's extension. */
const FILE_FORMATS: Readonly<Record<string, string>> = {
  pdf: 'PDF',
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
};

/**
 * "PDF" or "PDF, JPG" — the formats of a report's files, in the order first attached, read
 * off each stored key's extension (`file_keys`); empty when it has none, or none the File
 * field takes. The Report view's File line and the Reports table's sub line.
 */
export function reportFileFormats(fileKeys: readonly string[]): string {
  const formats = fileKeys.flatMap((key) => {
    const format = FILE_FORMATS[key.split('.').pop()?.toLowerCase() ?? ''];
    return format ? [format] : [];
  });
  return [...new Set(formats)].join(', ');
}
