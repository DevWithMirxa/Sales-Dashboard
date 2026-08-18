const Sale = require("../models/Sale");
const Salesman = require("../models/Salesman");
const SalesTeam = require("../models/SalesTeam");
const Product = require("../models/Product");
const Target = require("../models/Target");
const FeedMill = require("../models/FeedMill");
const Region = require("../models/Region");
const XLSX = require("xlsx");

// Dedupe a list of { name, ... } objects by name (case/whitespace-insensitive),
// keeping the first occurrence. Order of the input array decides which
// source "wins" when the same name exists in two collections.
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

// Auto total = quantity * rate, unless the caller explicitly sent a totalAmount
const computeTotal = (body) => {
  if (
    body.totalAmount !== undefined &&
    body.totalAmount !== null &&
    body.totalAmount !== ""
  ) {
    return Number(body.totalAmount) || 0;
  }
  const quantity = Number(body.quantity) || 0;
  const rate = Number(body.rate) || 0;
  return quantity * rate;
};

// GET /sales/form-options
// Feeds the "Add Sales" dialog: salesmen (Salesman page + Business Directory
// Sales Team), products (Product page + products referenced in Targets),
// customers (Business Directory Feed Mills), and regions (Region page).
const getSaleFormOptions = async (req, res) => {
  try {
    const [salesmen, salesTeam, products, targets, feedMills, regions] =
      await Promise.all([
        Salesman.find().select("name designation area"),
        SalesTeam.find().select("salesperson designation region"),
        Product.find().select("name pricePerKg packingKg"),
        Target.find().populate("products.product", "name pricePerKg packingKg"),
        FeedMill.find().select("feedMillName districtRegion"),
        Region.find({ activeStatus: true }).select("region"),
      ]);

    // --- Salesmen: merge Salesman page + Business Directory Sales Team ---
    const salesmenCombined = dedupeByName([
      ...salesmen.map((s) => ({
        name: s.name,
        designation: s.designation || "",
        region: s.area || "",
        source: "salesman",
      })),
      ...salesTeam.map((s) => ({
        name: s.salesperson,
        designation: s.designation || "",
        region: s.region || "",
        source: "sales-team",
      })),
    ]);

    // --- Products: merge Product master + products referenced in Targets ---
    // (Target.products.product is already a ref to Product, so this mostly
    // guards against a target pointing at a product that's since been
    // renamed/removed from the Product list.)
    const targetProducts = targets.flatMap((t) =>
      (t.products || [])
        .map((p) => p.product)
        .filter(Boolean)
        .map((p) => ({
          name: p.name,
          pricePerKg: p.pricePerKg,
          packingKg: p.packingKg,
          source: "target",
        })),
    );
    const productsCombined = dedupeByName([
      ...products.map((p) => ({
        name: p.name,
        pricePerKg: p.pricePerKg,
        packingKg: p.packingKg,
        source: "product",
      })),
      ...targetProducts,
    ]);

    // --- Customers: Business Directory Feed Mills ---
    const customersCombined = dedupeByName(
      feedMills.map((f) => ({
        name: f.feedMillName,
        region: f.districtRegion || "",
        source: "feedmill",
      })),
    );

    // --- Regions: Region master list ---
    const regionsCombined = dedupeByName(
      regions.map((r) => ({ name: r.region })),
    );

    res.json({
      salesmen: salesmenCombined,
      products: productsCombined,
      customers: customersCombined,
      regions: regionsCombined,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createSale = async (req, res) => {
  try {
    const sale = new Sale({
      ...req.body,
      totalAmount: computeTotal(req.body),
      createdBy: req.user ? req.user._id : undefined,
    });
    const saved = await sale.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ saleDate: -1, createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSale = async (req, res) => {
  try {
    const updated = await Sale.findByIdAndUpdate(
      req.params.id,
      { ...req.body, totalAmount: computeTotal(req.body) },
      { new: true },
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSale = async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: "Sale deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Excel upload — same header-detection approach as Trend's uploadTrends, with
// one deliberate difference: Sale rows have no date/period column, so there's
// no reliable natural key to upsert on. Each valid row is INSERTED as a new
// Sale document rather than upserted - re-uploading the same file will create
// duplicate sale records. If your source file gets a Date column later, this
// can be switched to upsert on (salesman + product + customer + saleDate).
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

const UNIT_ENUM = ["kg", "bags", "tons", "units"];
// Maps a free-text "Units" cell ("Bags", "KG", "Tons", ...) to the schema's
// enum, defaulting to "bags" (the schema default) if unrecognized.
const normalizeUnit = (raw) => {
  const norm = normalizeHeader(raw);
  if (!norm) return "bags";
  const hit = UNIT_ENUM.find((u) => norm.includes(u.replace(/s$/, "")));
  return hit || "bags";
};

// Scans the first few rows for whichever one actually contains "Salesman"
// and "Product" as column headers (tolerates a title row above the headers).
const findHeaderRow = (matrix) => {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = matrix[i] || [];
    const hasSalesman = row.some((cell) =>
      normalizeHeader(cell).includes("salesman"),
    );
    const hasProduct = row.some((cell) =>
      normalizeHeader(cell).includes("product"),
    );
    if (hasSalesman && hasProduct) {
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

// POST /sales/upload - accepts an .xlsx/.xls file with Salesman, Product,
// Region, Customer, Quantity, Units, Rate, Sale Rate columns (order-
// independent, optional title row tolerated). "Sale Rate" is treated as an
// explicit total (same as totalAmount in the Add Sales form) and, when
// present, wins over Quantity x Rate - exactly like computeTotal() above.
const uploadSales = async (req, res) => {
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
          'Could not find a header row with "Salesman" and "Product" columns in any sheet.',
      });
    }

    const { headerRowIndex, headers } = headerInfo;
    const col = {
      salesman: findColumnIndex(headers, ["salesman"]),
      product: findColumnIndex(headers, ["product"]),
      region: findColumnIndex(headers, ["region"]),
      customer: findColumnIndex(headers, ["customer"]),
      quantity: findColumnIndex(headers, ["quantity"]),
      unit: findColumnIndex(headers, ["unit"]),
      rate: findColumnIndex(headers, ["rate"], ["sale"]),
      totalAmount: findColumnIndex(headers, ["sale", "rate"]),
    };

    if (
      col.salesman === -1 ||
      col.product === -1 ||
      col.customer === -1 ||
      col.region === -1
    ) {
      return res.status(400).json({
        message:
          "Could not find Salesman, Product, Customer, and Region columns in the sheet headers.",
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
    const docs = [];

    dataRows.forEach((row, idx) => {
      const rowNum = headerRowIndex + idx + 2; // 1-indexed, after the header row

      const salesman = row[col.salesman]
        ? String(row[col.salesman]).trim()
        : "";
      const product = row[col.product] ? String(row[col.product]).trim() : "";
      const customer = row[col.customer]
        ? String(row[col.customer]).trim()
        : "";
      const region = row[col.region] ? String(row[col.region]).trim() : "";

      if (!salesman || !product || !customer || !region) {
        errors.push(
          `Row ${rowNum}: missing Salesman, Product, Customer, or Region`,
        );
        return;
      }

      const quantity = toNumber(col.quantity !== -1 ? row[col.quantity] : 0);
      const rate = toNumber(col.rate !== -1 ? row[col.rate] : 0);
      const rawTotal = col.totalAmount !== -1 ? row[col.totalAmount] : null;

      docs.push({
        salesman,
        product,
        customer,
        region,
        quantity,
        unit: normalizeUnit(col.unit !== -1 ? row[col.unit] : ""),
        rate,
        totalAmount: computeTotal({ totalAmount: rawTotal, quantity, rate }),
        createdBy: req.user ? req.user._id : undefined,
      });
    });

    if (!docs.length) {
      return res.status(400).json({
        message: "No valid rows found in the uploaded file.",
        errors,
      });
    }

    const inserted = await Sale.insertMany(docs, { ordered: false });

    res.json({
      message: "Upload complete.",
      inserted: inserted.length,
      updated: 0,
      totalRows: dataRows.length,
      skipped: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSale,
  getSales,
  updateSale,
  deleteSale,
  getSaleFormOptions,
  uploadSales,
};
