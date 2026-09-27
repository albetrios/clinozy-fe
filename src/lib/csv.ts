/**
 * Minimal client-side CSV export helper. No dependencies — builds a CSV string
 * from rows and triggers a browser download via an object URL.
 */

/**
 * Neutralize CSV / formula injection (OWASP). A cell whose first character is
 * `= + - @`, a tab, or a carriage return is executed as a formula by Excel /
 * Google Sheets / LibreOffice when the file is opened — so user-controlled data
 * (a member's display name or email) could run `=HYPERLINK(...)` to exfiltrate
 * other cells, a DDE command, or a phishing link. Prefixing with an apostrophe
 * makes the spreadsheet read the cell as literal text.
 */
function neutralizeFormula(str: string): string {
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

/** Escape a single CSV field (formula triggers, then quotes/commas/newlines). */
function escapeField(value: unknown): string {
  let str: string;
  if (value == null) str = '';
  else if (typeof value === 'string') str = value;
  else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    str = String(value);
  else str = JSON.stringify(value) ?? '';
  str = neutralizeFormula(str);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from a header row and data rows.
 *
 * @param headers - Column header labels.
 * @param rows - Each row is an array of cell values aligned to `headers`.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeField).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeField).join(','));
  }
  return lines.join('\n');
}

/**
 * Trigger a browser download of CSV content.
 *
 * @param filename - Suggested file name (e.g. `members.csv`).
 * @param content - The CSV string (see {@link toCsv}).
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
