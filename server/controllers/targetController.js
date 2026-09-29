const Target = require("../models/Target");
const Salesman = require("../models/Salesman");
const Product = require("../models/Product");
const XLSX = require("xlsx");
const { getTargetMonths } = require("../utils/computeTrendRows");

// True if any (year, monthNumber) pair appears in both arrays - used to
// detect whether two targets' coverage windows genuinely overlap, rather
// than just sharing the same period TYPE (which two targets for different
// months are allowed to do).
const monthsOverlap = (monthsA, monthsB) => {
  const setB = new Set(monthsB.map((m) => `${m.year}-${m.monthNumber}`));
  return monthsA.some((m) => setB.has(`${m.year}-${m.monthNumber}`));
};

/**
 * Create Target
 */
exports.createTarget = async (req, res) => {
  try {
    const {
      targetName,
      period,
      periodStart,
      assignedTo,
      region,
      products,
      status,
    } = req.body;

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: "Salesman is required.",
      });
    }

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one product.",
      });
    }

    // Only a target that GENUINELY overlaps the same calendar month(s) as
    // the one being created should be blocked - not every target that ever
    // existed for this salesman+period type. periodStart is what makes
    // that distinction possible; two Monthly targets for different months
    // are legitimate and should both be allowed to exist.
    const candidates = await Target.find({
      assignedTo,
      period,
      status: { $ne: "completed" },
    });
    if (candidates.length) {
      const newMonths = getTargetMonths({
        periodStart: periodStart || new Date(),
        period,
      });
      const conflict = candidates.find((c) =>
        monthsOverlap(newMonths, getTargetMonths(c)),
      );
      if (conflict) {
        return res.status(400).json({
          success: false,
          message:
            "This salesman already has a target for the selected period that overlaps the chosen month.",
        });
      }
    }

    const totalQuantity = products.reduce(
      (sum, item) => sum + Number(item.targetQuantity || 0),
      0,
    );

    const totalRevenue = products.reduce(
      (sum, item) => sum + Number(item.targetRevenue || 0),
      0,
    );

    const target = await Target.create({
      targetName,
      period,
      periodStart,
      assignedTo,
      region,
      products,
      totalQuantity,
      totalRevenue,
      status,
    });

    const populatedTarget = await Target.findById(target._id)
      .populate("assignedTo")
      .populate("products.product");

    res.status(201).json({
      success: true,
      message: "Target created successfully.",
      data: populatedTarget,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get All Targets
 */
exports.getAllTargets = async (req, res) => {
  try {
    const targets = await Target.find()
      .populate("assignedTo")
      .populate("products.product")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: targets.length,
      data: targets,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Target By Id
 */
exports.getTargetById = async (req, res) => {
  try {
    const target = await Target.findById(req.params.id)
      .populate("assignedTo")
      .populate("products.product");

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: target,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update Target
 */
exports.updateTarget = async (req, res) => {
  try {
    const {
      targetName,
      period,
      periodStart,
      assignedTo,
      region,
      products,
      status,
    } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one product.",
      });
    }

    const totalQuantity = products.reduce(
      (sum, item) => sum + Number(item.targetQuantity || 0),
      0,
    );

    const totalRevenue = products.reduce(
      (sum, item) => sum + Number(item.targetRevenue || 0),
      0,
    );

    const target = await Target.findByIdAndUpdate(
      req.params.id,
      {
        targetName,
        period,
        periodStart,
        assignedTo,
        region,
        products,
        totalQuantity,
        totalRevenue,
        status,
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("assignedTo")
      .populate("products.product");

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Target updated successfully.",
      data: target,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete Target
 */
exports.deleteTarget = async (req, res) => {
  try {
    const target = await Target.findByIdAndDelete(req.params.id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Target deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /targets/upload-template - generates an .xlsx with the exact column
// headers uploadTargets() below expects, plus one real row (one product line
// from the most recently created Target - falling back to a placeholder row
// if the collection is empty), so users have a working reference instead of
// guessing column names/casing. Mirrors salesmanController's
// downloadSalesmenTemplate.
exports.downloadTargetsTemplate = async (req, res) => {
  try {
    const sample = await Target.findOne()
      .sort({ createdAt: -1 })
      .populate("assignedTo")
      .populate("products.product")
      .lean();

    // Headers are deliberately worded to match what findColumnIndex() in
    // uploadTargets looks for - "Target Quantity" contains "target" +
    // "quantity", "Target Revenue (Rs)" contains "target" + "revenue", etc.
    // - so a round-trip download -> fill -> upload always parses correctly.
    // "Month" is what this target is FOR (periodStart) - required. "Period"
    // is the duration (Monthly/Quarterly/...) - optional, defaults to
    // Monthly if left blank.
    const headers = [
      "Month",
      "Period",
      "Salesman",
      "Region",
      "Product",
      "Target Quantity",
      "Unit",
      "Target Revenue (Rs)",
    ];

    const sampleProduct = sample?.products?.[0];
    const sampleMonth = sample?.periodStart
      ? `${new Date(sample.periodStart).toLocaleString("en-US", { month: "short" })}-${String(
          new Date(sample.periodStart).getFullYear(),
        ).slice(-2)}`
      : "Jan-26";

    const sampleRow = sample
      ? [
          sampleMonth,
          sample.period || "Monthly",
          sample.assignedTo?.name || "",
          sample.region || sample.assignedTo?.area || "",
          sampleProduct?.product?.name || "",
          sampleProduct?.targetQuantity || 0,
          sampleProduct?.unit || "kg",
          sampleProduct?.targetRevenue || 0,
        ]
      : [
          "Jan-26",
          "Monthly",
          "Dr. Imran",
          "Multan",
          "Urea",
          500,
          "bags",
          250000,
        ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    worksheet["!cols"] = headers.map(() => ({ wch: 22 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Targets");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="targets-upload-template.xlsx"',
    );
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Excel upload
//
// Target is different from the flat models (Salesman/Product): a Target
// document holds an ARRAY of products for one salesman + one period, but the
// source file has one row per product line. So upload does a few extra
// things the other uploads don't:
//   1. Resolves the "Salesman" and "Product" text columns to the matching
//      Salesman/Product ObjectIds (Target.assignedTo / products.product are
//      refs, not plain strings).
//   2. Parses the "Month" column into an explicit periodStart, the same
//      field the live TargetForm now sets - see models/Target.js.
//   3. GROUPS rows that share the same (salesman, period, month) into a
//      single Target document with a products[] array. The month is part
//      of the group key specifically so a sheet covering several months
//      for the same salesman creates one Target PER month, not one target
//      with all those months' numbers merged together.
// Re-uploading the same salesman+period+month replaces that target's
// product list rather than duplicating it; a different month creates a
// separate target, exactly like the live form would.
// ---------------------------------------------------------------------------

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

// Turns a raw "Month" cell into a Date normalized to the 1st of that month.
// Handles "Jan 25", "Jan-25", "January 2025", real Date objects, and Excel
// date serials.
const parseMonthCell = (raw) => {
  if (raw === null || raw === undefined || raw === "") return null;

  if (raw instanceof Date && !isNaN(raw)) {
    return new Date(raw.getFullYear(), raw.getMonth(), 1);
  }

  const str = String(raw).trim();

  if (/^\d+(\.\d+)?$/.test(str)) {
    const parsed = XLSX.SSF.parse_date_code(Number(str));
    if (parsed) return new Date(parsed.y, parsed.m - 1, 1);
  }

  const match = str.match(/^([A-Za-z]+)[\s\-]?(\d{2,4})$/);
  if (match) {
    const [, monthText, yearText] = match;
    const monthNumber = MONTH_MAP[monthText.toLowerCase()];
    if (!monthNumber) return null;
    let year = Number(yearText);
    if (year < 100) year += 2000;
    return new Date(year, monthNumber - 1, 1);
  }

  return null;
};

const normalizeHeader = (h) =>
  String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const PERIOD_ENUM = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"];
// "monthly", "Monthly ", "MONTHLY" all resolve to the schema's enum casing.
// Falls back to "Monthly" (the schema default) for anything unrecognized or
// blank - Period is optional in the sheet, unlike Month.
const normalizePeriod = (raw) => {
  const norm = normalizeHeader(raw);
  if (!norm) return "Monthly";
  const hit = PERIOD_ENUM.find((p) => p.toLowerCase() === norm);
  return hit || "Monthly";
};

const UNIT_ENUM = ["kg", "bags", "tons", "units"];
// Defaults to "kg" - the productTargetSchema default - for anything unrecognized.
const normalizeUnit = (raw) => {
  const norm = normalizeHeader(raw);
  if (!norm) return "kg";
  const hit = UNIT_ENUM.find((u) => norm.includes(u.replace(/s$/, "")));
  return hit || "kg";
};

// Scans the first few rows for whichever one actually contains "Month" and
// "Salesman" as column headers (tolerates a title row above the headers).
const findHeaderRow = (matrix) => {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = matrix[i] || [];
    const hasMonth = row.some((cell) =>
      normalizeHeader(cell).includes("month"),
    );
    const hasSalesman = row.some((cell) =>
      normalizeHeader(cell).includes("salesman"),
    );
    if (hasMonth && hasSalesman) {
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

// POST /targets/upload - accepts an .xlsx/.xls file with Month, Salesman,
// Product, Target Quantity columns required, plus optional Period, Region,
// Unit, Target Revenue (Rs) columns (order-independent, optional title row
// tolerated). Rows sharing the same Salesman + Period + Month are grouped
// into one Target document with all of that salesman's products for that
// specific month.
exports.uploadTargets = async (req, res) => {
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
          'Could not find a header row with "Month" and "Salesman" columns in any sheet.',
      });
    }

    const { headerRowIndex, headers } = headerInfo;
    const col = {
      month: findColumnIndex(headers, ["month"]),
      period: findColumnIndex(headers, ["period"]),
      salesman: findColumnIndex(headers, ["salesman"]),
      region: findColumnIndex(headers, ["region"]),
      product: findColumnIndex(headers, ["product"]),
      targetQuantity: findColumnIndex(headers, ["target", "quantity"]),
      unit: findColumnIndex(headers, ["unit"]),
      targetRevenue: findColumnIndex(headers, ["target", "revenue"]),
    };

    if (
      col.month === -1 ||
      col.salesman === -1 ||
      col.product === -1 ||
      col.targetQuantity === -1
    ) {
      return res.status(400).json({
        message:
          "Could not find Month, Salesman, Product, and Target Quantity columns in the sheet headers.",
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

    // Preload lookup maps so each row resolves Salesman/Product by name
    // without a query per row. Keyed lowercase/trimmed for tolerant matching.
    const [allSalesmen, allProducts] = await Promise.all([
      Salesman.find().select("name area"),
      Product.find().select("name"),
    ]);
    const salesmanByName = new Map(
      allSalesmen.map((s) => [s.name.trim().toLowerCase(), s]),
    );
    const productByName = new Map(
      allProducts.map((p) => [p.name.trim().toLowerCase(), p]),
    );

    const errors = [];
    // Groups keyed by "salesmanId::period::YYYY-MM" -> { assignedTo, period,
    // periodStart, region, products: Map<productId, {...}> }
    const groups = new Map();

    dataRows.forEach((row, idx) => {
      const rowNum = headerRowIndex + idx + 2; // 1-indexed, after the header row

      const periodStart = parseMonthCell(row[col.month]);
      if (!periodStart) {
        errors.push(`Row ${rowNum}: could not parse Month "${row[col.month]}"`);
        return;
      }

      const salesmanName = row[col.salesman]
        ? String(row[col.salesman]).trim()
        : "";
      const productName = row[col.product]
        ? String(row[col.product]).trim()
        : "";
      if (!salesmanName || !productName) {
        errors.push(`Row ${rowNum}: missing Salesman or Product`);
        return;
      }

      const period = normalizePeriod(col.period !== -1 ? row[col.period] : "");

      const salesman = salesmanByName.get(salesmanName.toLowerCase());
      if (!salesman) {
        errors.push(
          `Row ${rowNum}: no salesman found matching "${salesmanName}" - add them on the Salesman page first`,
        );
        return;
      }

      const product = productByName.get(productName.toLowerCase());
      if (!product) {
        errors.push(
          `Row ${rowNum}: no product found matching "${productName}" - add it on the Product page first`,
        );
        return;
      }

      const region =
        col.region !== -1 && row[col.region]
          ? String(row[col.region]).trim()
          : salesman.area || "";

      const monthKey = `${periodStart.getFullYear()}-${periodStart.getMonth()}`;
      const groupKey = `${salesman._id}::${period}::${monthKey}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          assignedTo: salesman._id,
          period,
          periodStart,
          region,
          products: new Map(), // productId -> { product, targetQuantity, targetRevenue, unit }
        });
      }
      const group = groups.get(groupKey);

      const targetQuantity = toNumber(row[col.targetQuantity]);
      const targetRevenue = toNumber(
        col.targetRevenue !== -1 ? row[col.targetRevenue] : 0,
      );
      const unit = normalizeUnit(col.unit !== -1 ? row[col.unit] : "");

      // If the same product appears twice for the same salesman+period+month,
      // sum the quantities/revenue rather than overwrite.
      const productKey = String(product._id);
      if (group.products.has(productKey)) {
        const existing = group.products.get(productKey);
        existing.targetQuantity += targetQuantity;
        existing.targetRevenue += targetRevenue;
        existing.unit = unit;
      } else {
        group.products.set(productKey, {
          product: product._id,
          targetQuantity,
          targetRevenue,
          unit,
        });
      }
    });

    if (!groups.size) {
      return res.status(400).json({
        message: "No valid rows found in the uploaded file.",
        errors,
      });
    }

    const operations = Array.from(groups.values()).map((group) => {
      const products = Array.from(group.products.values());
      const totalQuantity = products.reduce(
        (sum, p) => sum + p.targetQuantity,
        0,
      );
      const totalRevenue = products.reduce(
        (sum, p) => sum + p.targetRevenue,
        0,
      );

      return {
        updateOne: {
          // periodStart is part of the match filter now, not just period -
          // otherwise uploading a second month for the same salesman would
          // silently overwrite the first month's target instead of
          // creating a separate one.
          filter: {
            assignedTo: group.assignedTo,
            period: group.period,
            periodStart: group.periodStart,
          },
          update: {
            $set: {
              region: group.region,
              products,
              totalQuantity,
              totalRevenue,
            },
            $setOnInsert: { targetName: "", status: "active" },
          },
          upsert: true,
        },
      };
    });

    const result = await Target.bulkWrite(operations, { ordered: false });

    res.json({
      message: "Upload complete.",
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      totalRows: dataRows.length,
      skipped: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
