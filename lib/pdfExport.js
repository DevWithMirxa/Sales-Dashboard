// Shared PDF export helper used across list pages (Salesmen, Products,
// Sales, Regulations, Business Directory, etc). Mirrors the CSV helper
// (lib/csvExport.js) and the dashboard PDF approach so the Excel and PDF
// outputs always stay in sync with each other.
//
// columns: [{ label: "Column Header", key: "fieldName" }]
//   - or, when the value needs formatting/combining fields:
//          { label: "Quantity", value: (row) => `${row.quantity} ${row.unit}` }
//
// options: { title, subtitle, filename }

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToPDF(rows, columns, options = {}) {
  if (!rows || rows.length === 0) {
    alert("Nothing to export.");
    return;
  }

  const { title = "Export", subtitle = "", filename = "export" } = options;

  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setTextColor(0, 102, 204);
  doc.text(title, 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (subtitle) doc.text(subtitle, 14, 22);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, subtitle ? 27 : 22);

  autoTable(doc, {
    startY: subtitle ? 32 : 28,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) =>
      columns.map((c) => {
        const val = typeof c.value === "function" ? c.value(row) : row[c.key];
        return val === undefined || val === null || val === ""
          ? "-"
          : String(val);
      }),
    ),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
}