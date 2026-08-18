const Trend = require("../models/Trend");
const XLSX = require("xlsx");
const { getTrendRegions } = require("../utils/salespersonRegion");

const MONTH_MAP = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

// Turns a raw "Month" cell into { month, monthNumber, year, period }.
// Handles "Jan 25", "Jan-25", "January 2025", and real Date objects/serials.
const parseMonthCell = (raw) => {
  if (raw === null || raw === undefined || raw === "") return null;

  if (raw instanceof Date && !isNaN(raw)) {
    const monthNumber = raw.getMonth() + 1;
    const year = raw.getFullYear();
    return {
      month: raw.toLocaleString("en-US", { month: "short" }),
      monthNumber,
      year,
      period: `${year}-${String(monthNumber).padStart(2, "0")}`,
    };
  }

  const str = String(raw).trim();

  // Numeric Excel serial date (fallback if the cell wasn't read as a Date)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const parsed = XLSX.SSF.parse_date_code(Number(str));
    if (parsed) {
      const { y: year, m: monthNumber } = parsed;
      return {
        month: new Date(year, monthNumber - 1, 1).toLocaleString("en-US", {
          month: "short",
        }),
        monthNumber,
        year,
        period: `${year}-${String(monthNumber).padStart(2, "0")}`,
      };
    }
  }

  // "Jan 25", "Jan-25", "January 2025"
  const match = str.match(/^([A-Za-z]+)[\s\-]?(\d{2,4})$/);
  if (match) {
    const [, monthText, yearText] = match;
    const monthNumber = MONTH_MAP[monthText.toLowerCase()];
    if (!monthNumber) return null;
    let year = Number(yearText);
    if (year < 100) year += 2000;
    return {
      month: monthText.slice(0, 3),
      monthNumber,
      year,
      period: `${year}-${String(monthNumber).padStart(2, "0")}`,
    };
  }

  return null;
};

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const toNullableNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const buildMatch = (query) => {
  const match = {};
  if (query.year) match.year = Number(query.year);
  if (query.month) match.monthNumber = Number(query.month);
  if (query.product) match.product = query.product;
  if (query.salesperson) match.salesperson = query.salesperson;
  return match;
};

// GET /trends - paginated raw records (used for a detailed/drill-down table if needed)
const getTrends = async (req, res) => {
  try {
    const match = buildMatch(req.query);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const [rows, total] = await Promise.all([
      Trend.find(match)
        .sort({ period: -1, salesperson: 1, product: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Trend.countDocuments(match),
    ]);

    res.json({ rows, total, page, limit });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /trends/filters - distinct values to populate filter dropdowns.
// product / salesperson / year come straight from Trend data and region is
// derived from the trends->salesman area mapping so every option maps to
// records that actually exist in the sale data.
const getFilters = async (req, res) => {
  try {
    const [
      products,
      salespersons,
      periods,
      regions,
    ] = await Promise.all([
      Trend.distinct("product"),
      Trend.distinct("salesperson"),
      Trend.distinct("period"),
      getTrendRegions(),
    ]);

    const years = [
      ...new Set(periods.map((p) => Number(p.split("-")[0]))),
    ].sort();

    res.json({
      products: products.sort(),
      salespersons: salespersons.sort(),
      years,
      regions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const achievementFields = {
  volumeAchievementPct: {
    $cond: [
      { $eq: ["$targetVolumeKg", 0] },
      null,
      { $multiply: [{ $divide: ["$saleVolumeKg", "$targetVolumeKg"] }, 100] },
    ],
  },
  valueAchievementPct: {
    $cond: [
      { $eq: ["$targetValueRs", 0] },
      null,
      { $multiply: [{ $divide: ["$saleValueRs", "$targetValueRs"] }, 100] },
    ],
  },
};

// GET /trends/by-product - summary rows for the table + a monthly series for charts
const getByProduct = async (req, res) => {
  try {
    const match = buildMatch(req.query);

    const rows = await Trend.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$product",
          targetVolumeKg: { $sum: "$targetVolumeKg" },
          saleVolumeKg: { $sum: "$saleVolumeKg" },
          targetValueRs: { $sum: "$targetValueRs" },
          saleValueRs: { $sum: "$saleValueRs" },
          avgProductPriceRs: { $avg: "$productPriceRs" },
        },
      },
      {
        $project: {
          _id: 0,
          product: "$_id",
          targetVolumeKg: 1,
          saleVolumeKg: 1,
          targetValueRs: 1,
          saleValueRs: 1,
          avgProductPriceRs: 1,
          ...achievementFields,
        },
      },
      { $sort: { saleValueRs: -1 } },
    ]);

    const series = await Trend.aggregate([
      { $match: match },
      {
        $group: {
          _id: { product: "$product", period: "$period" },
          targetValueRs: { $sum: "$targetValueRs" },
          saleValueRs: { $sum: "$saleValueRs" },
        },
      },
      {
        $project: {
          _id: 0,
          product: "$_id.product",
          period: "$_id.period",
          targetValueRs: 1,
          saleValueRs: 1,
        },
      },
      { $sort: { period: 1 } },
    ]);

    res.json({ rows, series });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /trends/by-salesperson - same shape as by-product, grouped by salesperson
const getBySalesperson = async (req, res) => {
  try {
    const match = buildMatch(req.query);

    const rows = await Trend.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$salesperson",
          targetVolumeKg: { $sum: "$targetVolumeKg" },
          saleVolumeKg: { $sum: "$saleVolumeKg" },
          targetValueRs: { $sum: "$targetValueRs" },
          saleValueRs: { $sum: "$saleValueRs" },
        },
      },
      {
        $project: {
          _id: 0,
          salesperson: "$_id",
          targetVolumeKg: 1,
          saleVolumeKg: 1,
          targetValueRs: 1,
          saleValueRs: 1,
          ...achievementFields,
        },
      },
      { $sort: { saleValueRs: -1 } },
    ]);

    const series = await Trend.aggregate([
      { $match: match },
      {
        $group: {
          _id: { salesperson: "$salesperson", period: "$period" },
          targetValueRs: { $sum: "$targetValueRs" },
          saleValueRs: { $sum: "$saleValueRs" },
        },
      },
      {
        $project: {
          _id: 0,
          salesperson: "$_id.salesperson",
          period: "$_id.period",
          targetValueRs: 1,
          saleValueRs: 1,
        },
      },
      { $sort: { period: 1 } },
    ]);

    res.json({ rows, series });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * GET /trends/series
 * Monthly / Quarterly / Yearly sale breakdown fetched directly from Trend data.
 *
 * Query params:
 *   granularity - "month" | "quarter" | "year" (default "month")
 *   year        - optional 4-digit year, e.g. 2024. When provided the full set
 *                 of buckets for that year is returned (Jan-Dec or Q1-Q4),
 *                 zero-filled so every period in the year is always visible.
 *   product / salesperson - optional extra filters forwarded to the query.
 *
 * Returns [ { label, saleValue, targetValue, saleVolumeKg, count }, ... ]
 * ordered chronologically (e.g. Jan 2024 ... Dec 2024).
 */
const getSalesSeries = async (req, res) => {
  try {
    const valid = ["month", "quarter", "year"];
    const granularity = valid.includes(req.query.granularity)
      ? req.query.granularity
      : "month";
    const year = req.query.year ? Number(req.query.year) : null;

    const match = {};
    if (year) match.year = year;
    if (req.query.product && req.query.product !== "all") {
      match.product = req.query.product;
    }
    if (req.query.salesperson && req.query.salesperson !== "all") {
      match.salesperson = req.query.salesperson;
    }

    const id =
      granularity === "month"
        ? { year: "$year", segment: "$monthNumber" }
        : granularity === "quarter"
          ? { year: "$year", segment: { $ceil: { $divide: ["$monthNumber", 3] } } }
          : { year: "$year" };

    const rows = await Trend.aggregate([
      { $match: match },
      {
        $group: {
          _id: id,
          saleValue: { $sum: "$saleValueRs" },
          saleVolumeKg: { $sum: "$saleVolumeKg" },
          targetValue: { $sum: "$targetValueRs" },
          count: { $sum: 1 },
        },
      },
    ]);

    const map = new Map();
    const presentYears = new Set();
    rows.forEach((r) => {
      const y = r._id.year;
      if (y !== null && y !== undefined) presentYears.add(y);
      const seg = r._id.segment;
      const key =
        granularity === "year"
          ? String(y)
          : `${y}-${granularity === "quarter" ? `Q${seg}` : seg}`;
      map.set(key, r);
    });

    const makeBucket = (y, seg) => {
      const key =
        granularity === "year"
          ? String(y)
          : `${y}-${granularity === "quarter" ? `Q${seg}` : seg}`;
      const hit = map.get(key);
      // When a specific year is selected use plain Q1/Q2/Q3/Q4 labels;
      // with "All Years" include the year to avoid identical labels.
      const label =
        granularity === "year"
          ? String(y)
          : granularity === "quarter"
            ? year
              ? `Q${seg}`
              : `Q${seg} ${y}`
            : `${MONTH_LABELS[seg - 1]} ${y}`;
      return {
        label,
        value: hit ? hit.saleValue : 0,
        target: hit ? hit.targetValue : 0,
        volume: hit ? hit.saleVolumeKg : 0,
        count: hit ? hit.count : 0,
      };
    };

    const result = [];
    const yearsToUse = year
      ? [year]
      : Array.from(presentYears).sort((a, b) => a - b);

    yearsToUse.forEach((y) => {
      if (granularity === "month") {
        for (let m = 1; m <= 12; m += 1) result.push(makeBucket(y, m));
      } else if (granularity === "quarter") {
        for (let q = 1; q <= 4; q += 1) result.push(makeBucket(y, q));
      } else {
        result.push(makeBucket(y, null));
      }
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const normalizeHeader = (h) =>
  String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Your source files sometimes have a title row above the real headers
// (e.g. "Sale Data Detail, 2026") - scan the first few rows and use whichever
// one actually contains "Month" and "Product" as column headers.
const findHeaderRow = (matrix) => {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = matrix[i] || [];
    const hasMonth = row.some((cell) => normalizeHeader(cell) === "month");
    const hasProduct = row.some((cell) => normalizeHeader(cell) === "product");
    if (hasMonth && hasProduct) {
      return { headerRowIndex: i, headers: row };
    }
  }
  return null;
};

// Matches a logical field to whichever column header contains all of the
// given keywords, regardless of word order - so "Target Volume (Kg)" and
// "Volume Target (Kg)" both resolve to the same field.
const findColumnIndex = (headers, keywords, excludeKeywords = []) =>
  headers.findIndex((h) => {
    const norm = normalizeHeader(h);
    return (
      keywords.every((k) => norm.includes(k)) &&
      !excludeKeywords.some((k) => norm.includes(k))
    );
  });

// POST /trends/upload - accepts an .xlsx/.xls file containing Month,
// Salesperson, Product, and Target/Sale Volume & Value columns (column order
// and an optional title row above the headers are both tolerated). Upserts
// every row into MongoDB so the new period immediately shows up in
// filters/tables/charts.
const uploadTrends = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });

    // Prefer a sheet literally named "Master Data"; otherwise use whichever
    // sheet actually has recognizable headers.
    const preferredSheet = workbook.SheetNames.find(
      (n) => n.trim().toLowerCase() === "master data",
    );
    const sheetOrder = preferredSheet
      ? [
          preferredSheet,
          ...workbook.SheetNames.filter((n) => n !== preferredSheet),
        ]
      : workbook.SheetNames;

    let matrix = null;
    let headerInfo = null;
    for (const name of sheetOrder) {
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
          'Could not find a header row with "Month" and "Product" columns in any sheet.',
      });
    }

    const { headerRowIndex, headers } = headerInfo;
    const col = {
      month: findColumnIndex(headers, ["month"]),
      salesperson:
        findColumnIndex(headers, ["salesperson"]) !== -1
          ? findColumnIndex(headers, ["salesperson"])
          : findColumnIndex(headers, ["sales", "person"]),
      product: findColumnIndex(headers, ["product"]),
      targetVolumeKg: findColumnIndex(headers, ["target", "volume"]),
      saleVolumeKg: findColumnIndex(headers, ["sale", "volume"], ["target"]),
      targetValueRs: findColumnIndex(headers, ["target", "value"]),
      saleValueRs: findColumnIndex(headers, ["sale", "value"], ["target"]),
      productPriceRs: findColumnIndex(headers, ["price"]),
      productPackingKg: findColumnIndex(headers, ["pack"]),
    };

    if (col.month === -1 || col.salesperson === -1 || col.product === -1) {
      return res.status(400).json({
        message:
          "Could not find Month, Salesperson, and Product columns in the sheet headers.",
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

      const monthInfo = parseMonthCell(row[col.month]);
      const salesperson = row[col.salesperson]
        ? String(row[col.salesperson]).trim()
        : "";
      const product = row[col.product] ? String(row[col.product]).trim() : "";

      if (!monthInfo) {
        errors.push(`Row ${rowNum}: could not parse Month "${row[col.month]}"`);
        return;
      }
      if (!salesperson || !product) {
        errors.push(`Row ${rowNum}: missing Salesperson or Product`);
        return;
      }

      const doc = {
        month: monthInfo.month,
        monthNumber: monthInfo.monthNumber,
        year: monthInfo.year,
        period: monthInfo.period,
        salesperson,
        product,
        targetVolumeKg: toNumber(
          col.targetVolumeKg !== -1 ? row[col.targetVolumeKg] : 0,
        ),
        saleVolumeKg: toNumber(
          col.saleVolumeKg !== -1 ? row[col.saleVolumeKg] : 0,
        ),
        targetValueRs: toNumber(
          col.targetValueRs !== -1 ? row[col.targetValueRs] : 0,
        ),
        saleValueRs: toNumber(
          col.saleValueRs !== -1 ? row[col.saleValueRs] : 0,
        ),
        productPriceRs: toNullableNumber(
          col.productPriceRs !== -1 ? row[col.productPriceRs] : null,
        ),
        productPackingKg: toNullableNumber(
          col.productPackingKg !== -1 ? row[col.productPackingKg] : null,
        ),
        sourceFile: req.file.originalname,
      };

      // Upsert on the natural key so re-uploading the same period/salesperson/
      // product combo updates the existing record instead of duplicating it.
      operations.push({
        updateOne: {
          filter: {
            period: doc.period,
            salesperson: doc.salesperson,
            product: doc.product,
          },
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

    const result = await Trend.bulkWrite(operations, { ordered: false });

    res.json({
      message: "Upload complete.",
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      totalRows: dataRows.length,
      skipped: errors.length,
      errors: errors.slice(0, 20), // cap so a bad file doesn't flood the response
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTrends,
  getFilters,
  getByProduct,
  getBySalesperson,
  getSalesSeries,
  uploadTrends,
};
