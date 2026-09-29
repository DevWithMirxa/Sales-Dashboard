const Sale = require("../models/Sale");
const Target = require("../models/Target");
const Salesman = require("../models/Salesman");
const Product = require("../models/Product");

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
 * Converts a quantity + unit into kilograms.
 *
 * - "kg"    -> used as-is
 * - "tons"  -> * 1000
 * - "bags"  -> needs the product's packingKg (kg per bag). If that isn't
 *              set on the Product record, there's no way to know how much
 *              a bag weighs, so it contributes 0 to volume (revenue is
 *              unaffected either way - this only affects the MT figures).
 * - "units" -> a generic unit count has no inherent weight, so it always
 *              contributes 0 to volume. This mirrors what the old Trend
 *              import did implicitly (it only ever stored a weight-based
 *              saleVolumeKg field, so unit-based rows had nothing to map
 *              to anyway).
 */
const toKg = (quantity, unit, packingKg) => {
  const qty = Number(quantity) || 0;
  if (unit === "kg") return qty;
  if (unit === "tons") return qty * 1000;
  if (unit === "bags") return packingKg ? qty * Number(packingKg) : 0;
  return 0; // "units" or anything unrecognized
};

const monthKey = (year, monthNumber) =>
  `${year}-${String(monthNumber).padStart(2, "0")}`;

/**
 * A "Monthly" target covers the single calendar month its periodStart falls
 * in. "Quarterly" covers that month plus the next two; "Yearly" the next
 * twelve. "Weekly"/"Daily" don't divide evenly into calendar months, so
 * they're treated the same as "Monthly" - the single month containing
 * periodStart - since a week/day-level view isn't something any page
 * currently renders.
 *
 * periodStart is the explicit, user-editable field for "which month this
 * target is for" (see models/Target.js). Older records created before that
 * field existed fall back to createdAt, which is what used to double as
 * this marker - so nothing already in the database breaks.
 *
 * ASSUMPTION (flagged separately, not confirmed with the product owner):
 * the target's revenue/quantity is split EVENLY across however many months
 * it spans, rather than the full amount counting toward every month.
 */
const getTargetMonths = (target) => {
  const start = new Date(target.periodStart || target.createdAt);
  const startYear = start.getFullYear();
  const startMonthIndex = start.getMonth(); // 0-indexed

  const span =
    target.period === "Quarterly" ? 3 : target.period === "Yearly" ? 12 : 1;

  const months = [];
  for (let i = 0; i < span; i += 1) {
    const d = new Date(startYear, startMonthIndex + i, 1);
    months.push({ year: d.getFullYear(), monthNumber: d.getMonth() + 1 });
  }
  return months;
};

/**
 * Computes the full set of Trend-shaped rows live from Sale + Target data.
 * No filtering is done here - callers should filter the returned array
 * with filterComputedRows() below. Computing everything up front and
 * filtering in memory keeps this correct and simple; at this app's data
 * volume (hundreds/thousands of rows, not millions) that's not a
 * performance concern.
 *
 * Each row: { period, month, monthNumber, year, salesperson, product,
 *             region, saleValueRs, saleVolumeKg, targetValueRs,
 *             targetVolumeKg }
 *
 * NOTE: only Sale documents with status !== "cancelled" count toward
 * revenue/volume - a cancelled sale shouldn't count as real activity.
 * "pending" sales ARE included (treated as real, just not yet finalized).
 * This is a judgment call, not something explicitly confirmed - flag if
 * that's wrong.
 */
const getComputedTrendRows = async () => {
  const [sales, targets, salesmen, products] = await Promise.all([
    Sale.find({ status: { $ne: "cancelled" } }).lean(),
    Target.find({}).lean(),
    Salesman.find({}, "name area").lean(),
    Product.find({}, "name packingKg").lean(),
  ]);

  const packingKgByProduct = {};
  products.forEach((p) => {
    packingKgByProduct[p.name] = p.packingKg;
  });

  const salesmanById = {};
  salesmen.forEach((s) => {
    salesmanById[String(s._id)] = s;
  });

  const productById = {};
  products.forEach((p) => {
    productById[String(p._id)] = p;
  });

  const rowsByKey = {};

  const getRow = (year, monthNumber, salesperson, product, region) => {
    const key = `${year}-${monthNumber}-${salesperson}-${product}`;
    if (!rowsByKey[key]) {
      rowsByKey[key] = {
        period: monthKey(year, monthNumber),
        month: MONTH_LABELS[monthNumber - 1],
        monthNumber,
        year,
        salesperson,
        product,
        region: region || "Unknown",
        saleValueRs: 0,
        saleVolumeKg: 0,
        targetValueRs: 0,
        targetVolumeKg: 0,
        _rateSum: 0,
        _rateCount: 0,
      };
    } else if (region && rowsByKey[key].region === "Unknown") {
      // Fill in region later if the row was first created by the "other"
      // source (Sale creates it without region info from Target, etc.)
      rowsByKey[key].region = region;
    }
    return rowsByKey[key];
  };

  // --- Sales ---
  sales.forEach((sale) => {
    const d = new Date(sale.saleDate);
    if (Number.isNaN(d.getTime())) return; // skip malformed dates defensively
    const year = d.getFullYear();
    const monthNumber = d.getMonth() + 1;
    const packingKg = packingKgByProduct[sale.product];
    const volumeKg = toKg(sale.quantity, sale.unit, packingKg);

    const row = getRow(
      year,
      monthNumber,
      sale.salesman,
      sale.product,
      sale.region,
    );
    row.saleValueRs += Number(sale.totalAmount) || 0;
    row.saleVolumeKg += volumeKg;
    if (sale.rate) {
      row._rateSum += Number(sale.rate);
      row._rateCount += 1;
    }
  });

  // --- Targets ---
  targets.forEach((target) => {
    const salesman = salesmanById[String(target.assignedTo)];
    if (!salesman) return; // orphaned reference, nothing to attribute this to
    const months = getTargetMonths(target);
    const region = target.region || salesman.area;

    (target.products || []).forEach((tp) => {
      const product = productById[String(tp.product)];
      if (!product) return; // orphaned reference
      const packingKg = product.packingKg;
      const volumeKg = toKg(tp.targetQuantity, tp.unit, packingKg);
      const valueRs = Number(tp.targetRevenue) || 0;

      months.forEach(({ year, monthNumber }) => {
        const row = getRow(
          year,
          monthNumber,
          salesman.name,
          product.name,
          region,
        );
        row.targetValueRs += valueRs / months.length;
        row.targetVolumeKg += volumeKg / months.length;
      });
    });
  });

  return Object.values(rowsByKey)
    .map((r) => {
      const { _rateSum, _rateCount, ...row } = r;
      // Average sale rate for this (salesperson, product, month) group, as
      // a stand-in for the old Excel import's explicit "Price" column.
      // Only reflects actual Sale.rate values - Target has no rate concept.
      row.productPriceRs = _rateCount
        ? Number((_rateSum / _rateCount).toFixed(2))
        : null;
      return row;
    })
    .sort((a, b) =>
      a.period === b.period
        ? a.salesperson.localeCompare(b.salesperson)
        : a.period.localeCompare(b.period),
    );
};

/**
 * Filters an already-computed row array the same way the old
 * Trend.find(match) / buildMatch()/buildTrendMatch() did: by year, month
 * (numeric monthNumber), product, salesperson, and (now directly, no
 * salesperson->region lookup needed since every row already carries its
 * own region) region.
 */
const filterComputedRows = (
  rows,
  { year, month, product, salesperson, region } = {},
) =>
  rows.filter((r) => {
    if (year && year !== "all" && r.year !== Number(year)) return false;
    if (month && r.monthNumber !== Number(month)) return false;
    if (product && product !== "all" && r.product !== product) return false;
    if (salesperson && salesperson !== "all" && r.salesperson !== salesperson)
      return false;
    if (region && region !== "all" && r.region !== region) return false;
    return true;
  });

module.exports = {
  getComputedTrendRows,
  filterComputedRows,
  getTargetMonths,
  MONTH_LABELS,
};
