const Salesman = require("../models/Salesman");
const Region = require("../models/Region");
const Recovery = require("../models/Recovery");
const Product = require("../models/Product");
const {
  getComputedTrendRows,
  filterComputedRows,
  MONTH_LABELS,
} = require("../utils/computeTrendRows");

// No real daily/weekly granularity exists in the computed data (Sale/Target
// are resolved down to whole calendar months - see computeTrendRows.js), so
// those periods intentionally return empty results rather than a
// misleading "rolled up" number. Kept from the previous implementation.
const INSUFFICIENT_GRANULARITY_PERIODS = ["D", "W"];

const parseQuery = (req) => ({
  period: req.query.period || "M",
  granularity: req.query.granularity || "year",
  year: req.query.year || "all",
  region: req.query.region || "all",
  product: req.query.product || "all",
  salesperson: req.query.salesperson || "all",
});

// How many period buckets the current selection spans. Used to turn a raw
// total into a "per-period" figure so KPIs/charts change when the Breakdown
// is switched between Monthly / Quarterly / Yearly:
//   month   -> 12 * number-of-years  (Monthly shows an average per month)
//   quarter -> 4  * number-of-years  (Quarterly shows an average per quarter)
//   year    -> number-of-years       (Yearly shows the full-year total)
const getPeriodDivisor = (granularity, rows) => {
  const years = new Set((rows || []).map((t) => t && t.year)).size;
  const n = Math.max(1, years);
  if (granularity === "month") return 12 * n;
  if (granularity === "quarter") return 4 * n;
  return n;
};

/**
 * GET /dashboard/summary
 * KPI totals + top 5 salesmen, computed live from Sale/Target data
 * and Salesman data (recovery).
 */
const getDashboardSummary = async (req, res) => {
  try {
    const { period, granularity, year, region, product, salesperson } =
      parseQuery(req);
    const activeRegionsCount = await Region.countDocuments();

    if (INSUFFICIENT_GRANULARITY_PERIODS.includes(period)) {
      return res.json({
        totalSaleRs: 0,
        totalSaleMT: 0,
        totalTargetRs: 0,
        targetAchievement: 0,
        activeRegions: activeRegionsCount,
        recovery: 0,
        topSalesmen: [],
        insufficientGranularity: true,
      });
    }

    const allRows = await getComputedTrendRows();
    const rows = filterComputedRows(allRows, {
      year,
      region,
      product,
      salesperson,
    });
    const divisor = getPeriodDivisor(granularity, rows);

    const totalSaleRs = rows.reduce((sum, t) => sum + (t.saleValueRs || 0), 0);
    const totalSaleMT =
      rows.reduce((sum, t) => sum + (t.saleVolumeKg || 0), 0) / 1000;
    const totalTargetRs = rows.reduce(
      (sum, t) => sum + (t.targetValueRs || 0),
      0,
    );
    const targetAchievement =
      totalTargetRs > 0
        ? Number(((totalSaleRs / totalTargetRs) * 100).toFixed(1))
        : 0;

    // Per-period figures so the KPIs change with the Breakdown selection
    const avgSaleRs = totalSaleRs / divisor;
    const avgSaleMT = totalSaleMT / divisor;
    const avgTargetRs = totalTargetRs / divisor;

    // Top 5 salesmen by sale value within the filtered set (per-period avg)
    const bySalesperson = {};
    rows.forEach((t) => {
      if (!bySalesperson[t.salesperson])
        bySalesperson[t.salesperson] = { sales: 0, mt: 0, region: t.region };
      bySalesperson[t.salesperson].sales += t.saleValueRs || 0;
      bySalesperson[t.salesperson].mt += (t.saleVolumeKg || 0) / 1000;
    });

    // Fetch designations from Salesman model for enriched display
    const salesmanDocs = await Salesman.find({}, "name designation").lean();
    const designationMap = {};
    salesmanDocs.forEach((s) => {
      designationMap[s.name.trim().toLowerCase()] = s.designation;
    });

    const topSalesmen = Object.entries(bySalesperson)
      .map(([name, v]) => {
        const designation = designationMap[name.trim().toLowerCase()] || null;
        return {
          name,
          sales: v.sales / divisor,
          mt: Number((v.mt / divisor).toFixed(2)),
          region: v.region || "Unknown",
          designation,
        };
      })
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    // Recovery comes from the actual Recovery page (Recovery collection):
    // outstanding = invoiced - recovered, respecting the region/salesperson
    // filters. (Previously this read a static number stored on Salesman.)
    const recoveryQuery = {};
    if (region !== "all") recoveryQuery.region = region;
    if (salesperson !== "all") recoveryQuery.salesperson = salesperson;
    const recoveryDocs = await Recovery.find(
      recoveryQuery,
      "invoiceAmount amountRecovered",
    ).lean();
    const recovery = recoveryDocs.reduce(
      (sum, r) =>
        sum +
        Math.max(
          (Number(r.invoiceAmount) || 0) - (Number(r.amountRecovered) || 0),
          0,
        ),
      0,
    );

    res.json({
      totalSaleRs: avgSaleRs,
      totalSaleMT: Number(avgSaleMT.toFixed(2)),
      totalTargetRs: avgTargetRs,
      targetAchievement,
      activeRegions: activeRegionsCount,
      recovery,
      topSalesmen,
      insufficientGranularity: false,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /dashboard/region-sales
 * Sale vs Target grouped by region (each row already carries its own
 * region directly - no salesperson->region lookup needed anymore).
 */
const getRegionSales = async (req, res) => {
  try {
    const { period, granularity, year, region, product, salesperson } =
      parseQuery(req);
    if (INSUFFICIENT_GRANULARITY_PERIODS.includes(period)) return res.json([]);

    const allRows = await getComputedTrendRows();
    const rows = filterComputedRows(allRows, {
      year,
      region,
      product,
      salesperson,
    });
    const divisor = getPeriodDivisor(granularity, rows);

    const regionMap = {};
    rows.forEach((t) => {
      const r = t.region || "Unknown";
      if (!regionMap[r]) regionMap[r] = { sales: 0, target: 0 };
      regionMap[r].sales += t.saleValueRs || 0;
      regionMap[r].target += t.targetValueRs || 0;
    });

    const result = Object.entries(regionMap)
      .map(([regionName, v]) => ({
        region: regionName,
        sales: v.sales / divisor,
        target: v.target / divisor,
      }))
      .sort((a, b) => b.sales - a.sales);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /dashboard/top-products
 * Top 5 products by sale value within the filtered set.
 */
const getTopProducts = async (req, res) => {
  try {
    const { period, granularity, year, region, product, salesperson } =
      parseQuery(req);
    if (INSUFFICIENT_GRANULARITY_PERIODS.includes(period)) return res.json([]);

    const allRows = await getComputedTrendRows();
    const rows = filterComputedRows(allRows, {
      year,
      region,
      product,
      salesperson,
    });
    const divisor = getPeriodDivisor(granularity, rows);

    const byProduct = {};
    rows.forEach((t) => {
      if (!byProduct[t.product]) byProduct[t.product] = { sales: 0, volume: 0 };
      byProduct[t.product].sales += t.saleValueRs || 0;
      byProduct[t.product].volume += t.saleVolumeKg || 0;
    });

    const result = Object.entries(byProduct)
      .map(([name, v]) => ({
        id: name,
        name,
        sales: v.sales / divisor,
        volume: Number((v.volume / 1000 / divisor).toFixed(2)), // MT per period
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /dashboard/region-product-comparison
 * Volume (MT) of the top 4 products, broken down by region.
 * Returns { data: [{ region, [product]: volume, ... }], products: [names] }
 * so the frontend can render dynamic <Bar> series per product.
 */
const getRegionProductComparison = async (req, res) => {
  try {
    const { period, granularity, year, region, product, salesperson } =
      parseQuery(req);
    if (INSUFFICIENT_GRANULARITY_PERIODS.includes(period)) {
      return res.json({ data: [], products: [] });
    }

    const allRows = await getComputedTrendRows();
    const rows = filterComputedRows(allRows, {
      year,
      region,
      product,
      salesperson,
    });
    const divisor = getPeriodDivisor(granularity, rows);

    const productTotals = {};
    rows.forEach((t) => {
      productTotals[t.product] =
        (productTotals[t.product] || 0) + (t.saleVolumeKg || 0);
    });
    const topProductNames = Object.entries(productTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);

    const regionProductMap = {};
    rows.forEach((t) => {
      if (!topProductNames.includes(t.product)) return;
      const r = t.region || "Unknown";
      if (!regionProductMap[r]) regionProductMap[r] = {};
      regionProductMap[r][t.product] =
        (regionProductMap[r][t.product] || 0) + (t.saleVolumeKg || 0) / 1000;
    });

    const result = Object.entries(regionProductMap).map(
      ([regionName, products]) => {
        const row = { region: regionName };
        topProductNames.forEach((p) => {
          row[p] = Number(((products[p] || 0) / divisor).toFixed(2));
        });
        return row;
      },
    );

    res.json({ data: result, products: topProductNames });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /dashboard/filters
 * Dropdown options for the dashboard filter bar, taken from the real pages
 * (Salesman, Product, Region) plus whatever appears in actual sales/targets.
 * Same response shape the old /trends/filters returned.
 */
const getDashboardFilters = async (req, res) => {
  try {
    const [salesmen, products, regionDocs, rows] = await Promise.all([
      Salesman.find({}, "name").lean(),
      Product.find({}, "name").lean(),
      Region.find({}, "region").lean(),
      getComputedTrendRows(),
    ]);
    const clean = (arr) =>
      [
        ...new Set(arr.map((v) => String(v || "").trim()).filter(Boolean)),
      ].sort();

    const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
    if (!years.length) years.push(new Date().getFullYear());

    res.json({
      products: clean([
        ...products.map((p) => p.name),
        ...rows.map((r) => r.product),
      ]),
      salespersons: clean([
        ...salesmen.map((s) => s.name),
        ...rows.map((r) => r.salesperson),
      ]),
      regions: clean([
        ...regionDocs.map((r) => r.region),
        ...rows.map((r) => r.region),
      ]),
      years,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /dashboard/series
 * Month / quarter / year Sale-vs-Target buckets for the "Sale Breakdown"
 * chart, computed live from Sale + Target. Same response shape the old
 * /trends/series returned: [{ label, value, target, volume, count }].
 */
const getDashboardSeries = async (req, res) => {
  try {
    const valid = ["month", "quarter", "year"];
    const granularity = valid.includes(req.query.granularity)
      ? req.query.granularity
      : "month";
    const year =
      req.query.year && req.query.year !== "all"
        ? Number(req.query.year)
        : null;

    const allRows = await getComputedTrendRows();
    const filtered = filterComputedRows(allRows, {
      year: year || undefined,
      product: req.query.product,
      salesperson: req.query.salesperson,
      region: req.query.region,
    });

    const map = new Map();
    const presentYears = new Set();
    const keyFor = (y, seg) =>
      granularity === "year"
        ? String(y)
        : `${y}-${granularity === "quarter" ? `Q${seg}` : seg}`;

    filtered.forEach((r) => {
      presentYears.add(r.year);
      const seg =
        granularity === "quarter"
          ? Math.ceil(r.monthNumber / 3)
          : r.monthNumber;
      const key = keyFor(r.year, seg);
      if (!map.has(key))
        map.set(key, { value: 0, target: 0, volume: 0, count: 0 });
      const b = map.get(key);
      b.value += r.saleValueRs || 0;
      b.target += r.targetValueRs || 0;
      b.volume += r.saleVolumeKg || 0;
      b.count += 1;
    });

    const makeBucket = (y, seg) => {
      const hit = map.get(keyFor(y, seg));
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
        value: hit ? hit.value : 0,
        target: hit ? hit.target : 0,
        volume: hit ? hit.volume : 0,
        count: hit ? hit.count : 0,
      };
    };

    const result = [];
    const yearsToUse = year ? [year] : [...presentYears].sort((a, b) => a - b);
    yearsToUse.forEach((y) => {
      if (granularity === "month")
        for (let m = 1; m <= 12; m += 1) result.push(makeBucket(y, m));
      else if (granularity === "quarter")
        for (let q = 1; q <= 4; q += 1) result.push(makeBucket(y, q));
      else result.push(makeBucket(y, null));
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardSummary,
  getRegionSales,
  getTopProducts,
  getRegionProductComparison,
  getDashboardFilters,
  getDashboardSeries,
};
