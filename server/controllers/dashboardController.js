const Salesman = require("../models/Salesman");
const Region = require("../models/Region");
const Trend = require("../models/Trend");

// No real daily/weekly granularity exists in the Trends data (it's monthly),
// so those periods intentionally return empty results rather than a
// misleading "rolled up" number.
const INSUFFICIENT_GRANULARITY_PERIODS = ["D", "W"];

// Trend.salesperson is a plain string (not a ref), so to filter/group by
// region we resolve it via the Salesman model's `area` field first.
const buildTrendMatch = async ({ region, product, salesperson }) => {
  const match = {};

  if (product && product !== "all") {
    match.product = product;
  }

  if (salesperson && salesperson !== "all") {
    match.salesperson = salesperson;
  }

  if (region && region !== "all") {
    const salesmenInRegion = await Salesman.find({ area: region }).select(
      "name",
    );
    const namesInRegion = salesmenInRegion.map((s) => s.name);

    if (match.salesperson) {
      // Both region AND salesperson selected - only valid if that
      // salesperson actually belongs to the selected region.
      match.salesperson = namesInRegion.includes(match.salesperson)
        ? match.salesperson
        : "__no_match__";
    } else {
      match.salesperson = {
        $in: namesInRegion.length ? namesInRegion : ["__no_match__"],
      };
    }
  }

  return match;
};

const buildSalespersonAreaMap = async () => {
  const salesmen = await Salesman.find().select("name area");
  const map = {};
  salesmen.forEach((s) => {
    map[s.name] = s.area || "Unknown";
  });
  return map;
};

const parseQuery = (req) => ({
  period: req.query.period || "M",
  region: req.query.region || "all",
  product: req.query.product || "all",
  salesperson: req.query.salesperson || "all",
});

/**
 * GET /dashboard/summary
 * KPI totals + top 3 salesmen, computed from Trend data (sales/targets)
 * and Salesman data (recovery).
 */
const getDashboardSummary = async (req, res) => {
  try {
    const { period, region, product, salesperson } = parseQuery(req);
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

    const match = await buildTrendMatch({ region, product, salesperson });
    const trends = await Trend.find(match);

    const totalSaleRs = trends.reduce(
      (sum, t) => sum + (t.saleValueRs || 0),
      0,
    );
    const totalSaleMT =
      trends.reduce((sum, t) => sum + (t.saleVolumeKg || 0), 0) / 1000;
    const totalTargetRs = trends.reduce(
      (sum, t) => sum + (t.targetValueRs || 0),
      0,
    );
    const targetAchievement =
      totalTargetRs > 0
        ? Number(((totalSaleRs / totalTargetRs) * 100).toFixed(1))
        : 0;

    // Top 3 salesmen by sale value within the filtered set
    const bySalesperson = {};
    trends.forEach((t) => {
      if (!bySalesperson[t.salesperson])
        bySalesperson[t.salesperson] = { sales: 0, mt: 0 };
      bySalesperson[t.salesperson].sales += t.saleValueRs || 0;
      bySalesperson[t.salesperson].mt += (t.saleVolumeKg || 0) / 1000;
    });

    const areaMap = await buildSalespersonAreaMap();
    const topSalesmen = Object.entries(bySalesperson)
      .map(([name, v]) => ({
        name,
        sales: v.sales,
        mt: Number(v.mt.toFixed(2)),
        region: areaMap[name] || "Unknown",
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 3);

    // Recovery has no equivalent in Trend data - still sourced from Salesman
    const salesmenQuery = {};
    if (region !== "all") salesmenQuery.area = region;
    if (salesperson !== "all") salesmenQuery.name = salesperson;
    const salesmenForRecovery = await Salesman.find(salesmenQuery);
    const recovery = salesmenForRecovery.reduce(
      (sum, s) => sum + (Number(s.recovery?.amount) || 0),
      0,
    );

    res.json({
      totalSaleRs,
      totalSaleMT: Number(totalSaleMT.toFixed(2)),
      totalTargetRs,
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
 * Sale vs Target grouped by region (resolved via each salesperson's area).
 */
const getRegionSales = async (req, res) => {
  try {
    const { period, region, product, salesperson } = parseQuery(req);
    if (INSUFFICIENT_GRANULARITY_PERIODS.includes(period)) return res.json([]);

    const match = await buildTrendMatch({ region, product, salesperson });
    const trends = await Trend.find(match);
    const areaMap = await buildSalespersonAreaMap();

    const regionMap = {};
    trends.forEach((t) => {
      const r = areaMap[t.salesperson] || "Unknown";
      if (!regionMap[r]) regionMap[r] = { sales: 0, target: 0 };
      regionMap[r].sales += t.saleValueRs || 0;
      regionMap[r].target += t.targetValueRs || 0;
    });

    const result = Object.entries(regionMap)
      .map(([regionName, v]) => ({
        region: regionName,
        sales: v.sales,
        target: v.target,
      }))
      .sort((a, b) => b.sales - a.sales);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /dashboard/top-products
 * Top 3 products by sale value within the filtered set.
 */
const getTopProducts = async (req, res) => {
  try {
    const { period, region, product, salesperson } = parseQuery(req);
    if (INSUFFICIENT_GRANULARITY_PERIODS.includes(period)) return res.json([]);

    const match = await buildTrendMatch({ region, product, salesperson });
    const trends = await Trend.find(match);

    const byProduct = {};
    trends.forEach((t) => {
      if (!byProduct[t.product]) byProduct[t.product] = { sales: 0, volume: 0 };
      byProduct[t.product].sales += t.saleValueRs || 0;
      byProduct[t.product].volume += t.saleVolumeKg || 0;
    });

    const result = Object.entries(byProduct)
      .map(([name, v]) => ({
        id: name,
        name,
        sales: v.sales,
        volume: Number((v.volume / 1000).toFixed(2)), // MT
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 3);

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
    const { period, region, product, salesperson } = parseQuery(req);
    if (INSUFFICIENT_GRANULARITY_PERIODS.includes(period)) {
      return res.json({ data: [], products: [] });
    }

    const match = await buildTrendMatch({ region, product, salesperson });
    const trends = await Trend.find(match);
    const areaMap = await buildSalespersonAreaMap();

    const productTotals = {};
    trends.forEach((t) => {
      productTotals[t.product] =
        (productTotals[t.product] || 0) + (t.saleVolumeKg || 0);
    });
    const topProductNames = Object.entries(productTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);

    const regionProductMap = {};
    trends.forEach((t) => {
      if (!topProductNames.includes(t.product)) return;
      const r = areaMap[t.salesperson] || "Unknown";
      if (!regionProductMap[r]) regionProductMap[r] = {};
      regionProductMap[r][t.product] =
        (regionProductMap[r][t.product] || 0) + (t.saleVolumeKg || 0) / 1000;
    });

    const result = Object.entries(regionProductMap).map(
      ([regionName, products]) => {
        const row = { region: regionName };
        topProductNames.forEach((p) => {
          row[p] = Number((products[p] || 0).toFixed(2));
        });
        return row;
      },
    );

    res.json({ data: result, products: topProductNames });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardSummary,
  getRegionSales,
  getTopProducts,
  getRegionProductComparison,
};
