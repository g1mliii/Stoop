// Phase 6.5: a tiny RFC-4180 CSV serializer for the client-side subscribers export. The seller is
// downloading their own already-loaded rows, so there's no server round-trip and no new PII surface.
// Quote a field only when it contains a comma, double-quote, or newline, and double any interior
// quotes — the minimal escaping that keeps Excel/Sheets/Numbers happy.

export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => string;
};

function neutralizeFormula(value: string): string {
  // Spreadsheet apps can ignore leading whitespace before interpreting a formula. Prefix an
  // apostrophe before RFC-4180 escaping so exported subscriber data always opens as text.
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeField(value: string): string {
  const safeValue = neutralizeFormula(value);
  if (/[",\r\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function toCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const lines = [
    columns.map((c) => escapeField(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => escapeField(c.value(row))).join(","))
  ];
  return lines.join("\r\n");
}
