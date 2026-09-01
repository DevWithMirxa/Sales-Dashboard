const Salesman = require("../models/Salesman");
const XLSX = require("xlsx");

const createSalesman = async (req, res) => {
  try {
    const salesman = new Salesman({
      ...req.body,
      createdBy: req.user ? req.user._id : undefined,
    });
    const savedSalesman = await salesman.save();
    res.status(201).json(savedSalesman);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSalesmen = async (req, res) => {
  try {
    const salesmen = await Salesman.find().sort({ createdAt: -1 });
    res.json(salesmen);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSalesman = async (req, res) => {
  try {
    const updatedSalesman = await Salesman.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    res.json(updatedSalesman);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSalesman = async (req, res) => {
  try {
    await Salesman.findByIdAndDelete(req.params.id);
    res.json({ message: "Salesman deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Excel upload — same approach as Trend's uploadTrends: tolerant header
// detection, fuzzy column matching, upsert on a natural key.
// ---------------------------------------------------------------------------

const normalizeHeader = (h) =>
  String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Scans the first few rows for whichever one actually contains "Name" and
// "Contact" as column headers (tolerates a title row above the real headers).
const findHeaderRow = (matrix) => {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = matrix[i] || [];
    const hasName = row.some((cell) => normalizeHeader(cell) === "name");
    const hasContact = row.some((cell) =>
      normalizeHeader(cell).includes("contact"),
    );
    if (hasName && hasContact) {
      return { headerRowIndex: i, headers: row };
    }
  }
  return null;
};

// Matches a logical field to whichever column header contains all of the
// given keywords, regardless of word order.
const findColumnIndex = (headers, keywords, excludeKeywords = []) =>
  headers.findIndex((h) => {
    const norm = normalizeHeader(h);
    return (
      keywords.every((k) => norm.includes(k)) &&
      !excludeKeywords.some((k) => norm.includes(k))
    );
  });

// POST /salesmen/upload - accepts an .xlsx/.xls file with Name, Designation,
// Area (Region), Contact Numbers, Email columns (order-independent, optional
// title row tolerated). Upserts on Name so re-uploading updates existing
// salesmen instead of duplicating them.
const uploadSalesmen = async (req, res) => {
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
          'Could not find a header row with "Name" and "Contact" columns in any sheet.',
      });
    }

    const { headerRowIndex, headers } = headerInfo;
    const col = {
      name: findColumnIndex(headers, ["name"]),
      designation: findColumnIndex(headers, ["designation"]),
      area:
        findColumnIndex(headers, ["area"]) !== -1
          ? findColumnIndex(headers, ["area"])
          : findColumnIndex(headers, ["region"]),
      contactNumber: findColumnIndex(headers, ["contact"]),
      email: findColumnIndex(headers, ["email"]),
    };

    if (col.name === -1 || col.contactNumber === -1) {
      return res.status(400).json({
        message:
          "Could not find Name and Contact Numbers columns in the sheet headers.",
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

      const name = row[col.name] ? String(row[col.name]).trim() : "";
      const contactNumber =
        col.contactNumber !== -1 && row[col.contactNumber]
          ? String(row[col.contactNumber]).trim()
          : "";

      if (!name) {
        errors.push(`Row ${rowNum}: missing Name`);
        return;
      }
      if (!contactNumber) {
        errors.push(`Row ${rowNum}: missing Contact Number`);
        return;
      }

      const doc = {
        name,
        contactNumber,
        designation:
          col.designation !== -1 && row[col.designation]
            ? String(row[col.designation]).trim()
            : "",
        area:
          col.area !== -1 && row[col.area] ? String(row[col.area]).trim() : "",
        email:
          col.email !== -1 && row[col.email]
            ? String(row[col.email]).trim()
            : "",
      };

      // Upsert on Name so re-uploading the same salesman updates their record
      // instead of creating a duplicate.
      operations.push({
        updateOne: {
          filter: { name: doc.name },
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

    const result = await Salesman.bulkWrite(operations, { ordered: false });

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

// GET /salesmen/upload-template - generates an .xlsx with the exact column
// headers the parser above expects, plus one real row from the database
// (falling back to a placeholder row if the collection is empty), so users
// have a working reference instead of guessing column names.
const downloadSalesmenTemplate = async (req, res) => {
  try {
    const sample = await Salesman.findOne().sort({ createdAt: -1 }).lean();

    // Headers are deliberately worded to match what findColumnIndex() above
    // looks for - "Contact Number" contains "contact", "Region" matches the
    // area/region fallback, etc. - so a round-trip download -> fill -> upload
    // always parses correctly.
    const headers = [
      "Name",
      "Designation",
      "Region",
      "Contact Number",
      "Email",
    ];

    const sampleRow = sample
      ? [
          sample.name || "",
          sample.designation || "",
          sample.area || "",
          sample.contactNumber || "",
          sample.email || "",
        ]
      : [
          "Dr. Imran",
          "Regional Sales Manager",
          "Multan",
          "0300-1234567",
          "imran@example.com",
        ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    worksheet["!cols"] = headers.map(() => ({ wch: 24 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Salesmen");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="salesmen-upload-template.xlsx"',
    );
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSalesman,
  getSalesmen,
  updateSalesman,
  deleteSalesman,
  uploadSalesmen,
  downloadSalesmenTemplate,
};
