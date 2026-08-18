// Shared CSV export helper used across list pages (Salesmen, Products,
// Sales, Business Directory, etc). Keeps the escaping/blob/download
// boilerplate in one place instead of duplicating it on every page.

function csvEscape(value) {
  const str = String(value ?? "");
  // Wrap in quotes (and escape internal quotes) if the value contains a
  // comma, quote, or newline - otherwise a plain field is fine as-is.
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * columns: [{ label: "Column Header", key: "fieldName" }]
 *   - or, when the value needs formatting/combining fields:
 *          { label: "Quantity", value: (row) => `${row.quantity} ${row.unit}` }
 */
export function exportToCSV(rows, columns, filename = "export") {
  if (!rows || rows.length === 0) {
    alert("Nothing to export.");
    return;
  }

  const headers = columns.map((c) => c.label);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      columns
        .map((c) =>
          csvEscape(typeof c.value === "function" ? c.value(row) : row[c.key]),
        )
        .join(","),
    ),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
