const Recovery = require("../models/Recovery");
const Salesman = require("../models/Salesman");
const FeedMill = require("../models/FeedMill");
const Region = require("../models/Region");
const XLSX = require("xlsx");

// Dedupe a list of { name, ... } objects by name (case/whitespace-insensitive),
// keeping the first occurrence. Same helper as salesController.js.
const dedupeByName = (items) => {
  const seen = new Map();
  items.forEach((item) => {
    const key = String(item.name || "")
      .trim()
      .toLowerCase();
    if (!key) return;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  });
  return Array.from(seen.values()).sort((a, b) =>
    String(a.name).localeCompare(String(b.name)),
  );
};

// Balance / Days Overdue / Status are computed fresh on every read rather
// than stored, since the latter two depend on today's date - see the note
// in models/Recovery.js.
const computeDerivedFields = (record) => {
  const invoiceAmount = Number(record.invoiceAmount || 0);
  const amountRecovered = Number(record.amountRecovered || 0);
  const balance = Math.max(0, invoiceAmount - amountRecovered);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let dueDate = record.dueDate ? new Date(record.dueDate) : null;
  if (dueDate) dueDate.setHours(0, 0, 0, 0);

  const isPastDue = balance > 0 && dueDate && today > dueDate;
  const daysOverdue = isPastDue
    ? Math.round((today - dueDate) / (1000 * 60 * 60 * 24))
    : 0;

  let status;
  if (balance === 0) {
    status = "Paid";
  } else if (amountRecovered > 0) {
    status = "Partial";
  } else if (isPastDue) {
    status = "Overdue";
  } else {
    status = "Pending";
  }

  return { balance, daysOverdue, status };
};

const withDerivedFields = (doc) => {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return { ...plain, ...computeDerivedFields(plain) };
};

const createRecovery = async (req, res) => {
  try {
    const recovery = new Recovery({
      ...req.body,
      createdBy: req.user ? req.user._id : undefined,
    });
    const saved = await recovery.save();
    res.status(201).json(withDerivedFields(saved));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: `A recovery record with invoice number "${req.body.invoiceNumber}" already exists.`,
      });
    }
    res.status(500).json({ message: error.message });
  }
};

const getRecoveries = async (req, res) => {
  try {
    const recoveries = await Recovery.find().sort({ invoiceDate: -1 });
    res.json(recoveries.map(withDerivedFields));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateRecovery = async (req, res) => {
  try {
    const updated = await Recovery.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ message: "Recovery record not found." });
    }
    res.json(withDerivedFields(updated));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: `A recovery record with invoice number "${req.body.invoiceNumber}" already exists.`,
      });
    }
    res.status(500).json({ message: error.message });
  }
};

const deleteRecovery = async (req, res) => {
  try {
    await Recovery.findByIdAndDelete(req.params.id);
    res.json({ message: "Recovery record deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /recovery/form-options
// Feeds the Recovery form's dropdowns: salesmen (Salesman page only - the
// legacy Business Directory Sales Team is intentionally no longer merged so
// stale/duplicate names can't appear), customers (Business Directory Feed
// Mills), and regions (Region page).
const getRecoveryFormOptions = async (req, res) => {
  try {
    const [salesmen, feedMills, regions] = await Promise.all([
      Salesman.find().select("name area"),
      FeedMill.find().select("feedMillName districtRegion"),
      Region.find({ activeStatus: true }).select("region"),
    ]);

    const salesmenCombined = dedupeByName(
      salesmen.map((s) => ({ name: s.name, region: s.area || "" })),
    );

    const customersCombined = dedupeByName(
      feedMills.map((f) => ({
        name: f.feedMillName,
        region: f.districtRegion || "",
      })),
    );

    const regionsCombined = dedupeByName(
      regions.map((r) => ({ name: r.region })),
    );

    res.json({
      salesmen: salesmenCombined,
      customers: customersCombined,
      regions: regionsCombined,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Excel upload / template download
// ---------------------------------------------------------------------------

const normalizeHeader = (h) =>
  String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Handles a real Date cell, an Excel date serial, or a plain date string.
const parseDateCell = (raw) => {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date && !isNaN(raw)) return raw;

  const str = String(raw).trim();
  if (/^\d+(\.\d+)?$/.test(str)) {
    const parsed = XLSX.SSF.parse_date_code(Number(str));
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d || 1);
  }

  const parsed = new Date(str);
  return isNaN(parsed) ? null : parsed;
};

const findColumnIndex = (headers, keywords, excludeKeywords = []) =>
  headers.findIndex((h) => {
    const norm = normalizeHeader(h);
    return (
      keywords.every((k) => norm.includes(k)) &&
      !excludeKeywords.some((k) => norm.includes(k))
    );
  });

// Scans the first few rows for whichever one actually contains "Salesperson"
// and an "Invoice #" column (tolerates a title row above the real headers).
const findHeaderRow = (matrix) => {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = matrix[i] || [];
    const hasSalesperson = row.some((cell) =>
      normalizeHeader(cell).includes("salesperson"),
    );
    const hasInvoiceNumber = row.some(
      (cell) => normalizeHeader(cell) === "invoice",
    );
    if (hasSalesperson && hasInvoiceNumber) {
      return { headerRowIndex: i, headers: row };
    }
  }
  return null;
};

// POST /recovery/upload - accepts an .xlsx/.xls file with Invoice Date, Due
// Date, Salesperson, Customer, Region, Invoice #, Invoice Amount (Rs),
// Amount Recovered (Rs), Recovery Date columns (order-independent, optional
// title row tolerated). Balance/Days Overdue/Status columns, if present in
// the file, are ignored - those are always computed server-side, never
// taken from the sheet. Upserts on Invoice # so re-uploading updates the
// existing record instead of duplicating it.
const uploadRecoveries = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });

    let matrix = null;
    let headerInfo = null;
    for (const name of workbook.SheetNames) {
      const candidate = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: null,
      });
      const found = findHeaderRow(candidate);
      if (found) {
        matrix = candidate;
        headerInfo = found;
        break;
      }
    }

    if (!headerInfo) {
      return res.status(400).json({
        message:
          'Could not find a header row with "Salesperson" and "Invoice #" columns in any sheet.',
      });
    }

    const { headerRowIndex, headers } = headerInfo;
    const col = {
      invoiceDate: findColumnIndex(headers, ["invoice", "date"]),
      dueDate: findColumnIndex(headers, ["due", "date"]),
      salesperson: findColumnIndex(headers, ["salesperson"]),
      customer: findColumnIndex(headers, ["customer"]),
      region: findColumnIndex(headers, ["region"]),
      invoiceNumber: findColumnIndex(headers, ["invoice"], ["date", "amount"]),
      invoiceAmount: findColumnIndex(headers, ["invoice", "amount"]),
      amountRecovered: findColumnIndex(headers, ["recovered"]),
      recoveryDate: findColumnIndex(headers, ["recovery", "date"]),
    };

    const required = [
      "invoiceDate",
      "dueDate",
      "salesperson",
      "customer",
      "region",
      "invoiceNumber",
      "invoiceAmount",
    ];
    const missing = required.filter((key) => col[key] === -1);
    if (missing.length) {
      return res.status(400).json({
        message: `Could not find these columns in the sheet headers: ${missing.join(", ")}`,
      });
    }

    const dataRows = matrix
      .slice(headerRowIndex + 1)
      .filter((row) => row && row.some((cell) => cell !== null && cell !== ""));

    if (!dataRows.length) {
      return res
        .status(400)
        .json({ message: "The uploaded sheet has no data rows." });
    }

    const errors = [];
    const operations = [];

    dataRows.forEach((row, idx) => {
      const rowNum = headerRowIndex + idx + 2; // 1-indexed, after the header row

      const invoiceDate = parseDateCell(row[col.invoiceDate]);
      const dueDate = parseDateCell(row[col.dueDate]);
      const salesperson = row[col.salesperson]
        ? String(row[col.salesperson]).trim()
        : "";
      const customer = row[col.customer]
        ? String(row[col.customer]).trim()
        : "";
      const region = row[col.region] ? String(row[col.region]).trim() : "";
      const invoiceNumber = row[col.invoiceNumber]
        ? String(row[col.invoiceNumber]).trim()
        : "";

      if (!invoiceDate || !dueDate) {
        errors.push(
          `Row ${rowNum}: missing or unrecognized Invoice Date/Due Date`,
        );
        return;
      }
      if (!salesperson || !customer || !region || !invoiceNumber) {
        errors.push(
          `Row ${rowNum}: missing Salesperson, Customer, Region, or Invoice #`,
        );
        return;
      }

      const doc = {
        invoiceDate,
        dueDate,
        salesperson,
        customer,
        region,
        invoiceNumber,
        invoiceAmount: toNumber(row[col.invoiceAmount]),
        amountRecovered: toNumber(
          col.amountRecovered !== -1 ? row[col.amountRecovered] : 0,
        ),
        recoveryDate:
          col.recoveryDate !== -1 ? parseDateCell(row[col.recoveryDate]) : null,
      };

      operations.push({
        updateOne: {
          filter: { invoiceNumber: doc.invoiceNumber },
          update: { $set: doc },
          upsert: true,
        },
      });
    });

    if (!operations.length) {
      return res.status(400).json({
        message: "No valid rows found in the uploaded file.",
        errors,
      });
    }

    const result = await Recovery.bulkWrite(operations, { ordered: false });

    res.json({
      message: "Upload complete.",
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      totalRows: dataRows.length,
      skipped: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /recovery/upload-template - generates an .xlsx with the exact column
// headers the parser above expects, plus one real row from the database
// (falling back to a placeholder row if the collection is empty).
const downloadRecoveryTemplate = async (req, res) => {
  try {
    const sample = await Recovery.findOne().sort({ createdAt: -1 }).lean();

    const headers = [
      "Invoice Date",
      "Due Date",
      "Salesperson",
      "Customer",
      "Region",
      "Invoice #",
      "Invoice Amount (Rs)",
      "Amount Recovered (Rs)",
      "Recovery Date",
    ];

    const toExcelDate = (d) => (d ? new Date(d) : "");

    const sampleRow = sample
      ? [
          toExcelDate(sample.invoiceDate),
          toExcelDate(sample.dueDate),
          sample.salesperson || "",
          sample.customer || "",
          sample.region || "",
          sample.invoiceNumber || "",
          sample.invoiceAmount ?? "",
          sample.amountRecovered ?? "",
          sample.recoveryDate ? toExcelDate(sample.recoveryDate) : "",
        ]
      : [
          new Date(2026, 6, 1),
          new Date(2026, 6, 16),
          "Ahmed Raza",
          "Al-Barkat Feeds",
          "Punjab - Central",
          "INV-2026-0451",
          285000,
          150000,
          "",
        ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    worksheet["!cols"] = headers.map(() => ({ wch: 20 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recovery Record");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      cellDates: true,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="recovery-upload-template.xlsx"',
    );
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createRecovery,
  getRecoveries,
  updateRecovery,
  deleteRecovery,
  getRecoveryFormOptions,
  uploadRecoveries,
  downloadRecoveryTemplate,
};
