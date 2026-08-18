const Product = require("../models/Product");
const Trend = require("../models/Trend");
const XLSX = require("xlsx");

const createProduct = async (req, res) => {
  try {
    const product = new Product({
      ...req.body,
      createdBy: req.user ? req.user._id : undefined,
    });
    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
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

const toNullableNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

// Scans the first few rows for whichever one actually contains "Name" and
// "Price" as column headers (tolerates a title row above the real headers).
const findHeaderRow = (matrix) => {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = matrix[i] || [];
    const hasName = row.some((cell) => normalizeHeader(cell).includes("name"));
    const hasPrice = row.some((cell) =>
      normalizeHeader(cell).includes("price"),
    );
    if (hasName && hasPrice) {
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

// POST /products/upload - accepts an .xlsx/.xls file with Product Name,
// Price (Rs/Kg), Packing (Kg) columns (order-independent, optional title row
// tolerated). Upserts on Product Name so re-uploading updates existing
// products instead of duplicating them.
const uploadProducts = async (req, res) => {
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
          'Could not find a header row with "Product Name" and "Price" columns in any sheet.',
      });
    }

    const { headerRowIndex, headers } = headerInfo;
    const col = {
      name: findColumnIndex(headers, ["name"]),
      pricePerKg: findColumnIndex(headers, ["price"]),
      packingKg: findColumnIndex(headers, ["pack"]),
    };

    if (col.name === -1) {
      return res.status(400).json({
        message: "Could not find a Product Name column in the sheet headers.",
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

      if (!name) {
        errors.push(`Row ${rowNum}: missing Product Name`);
        return;
      }

      const doc = {
        name,
        pricePerKg: toNullableNumber(
          col.pricePerKg !== -1 ? row[col.pricePerKg] : null,
        ),
        packingKg: toNullableNumber(
          col.packingKg !== -1 ? row[col.packingKg] : null,
        ),
      };

      // Upsert on Product Name so re-uploading the same product updates its
      // record instead of creating a duplicate.
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

    const result = await Product.bulkWrite(operations, { ordered: false });

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

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  uploadProducts,
};
