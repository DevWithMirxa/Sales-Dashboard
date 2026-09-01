const Region = require("../models/Region");
const Salesman = require("../models/Salesman");
const Trend = require("../models/Trend");
const Target = require("../models/Target");

const normalizeRegion = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const normalizeName = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const getTargetRegion = (target) =>
  target.region || target.assignedTo?.area || "";

const getTargetSalesperson = (target) =>
  target.assignedTo?.name || target.salesperson || "";

const createRegion = async (req, res) => {
  try {
    const region = new Region({
      ...req.body,
      regionManager: req.user ? req.user._id : undefined,
    });
    const savedRegion = await region.save();
    res.status(201).json(savedRegion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /regions - each region enriched with:
//   - salesTeam (members) built from Salesmen and Targets
//   - monthlySales from latest Trends, matched to each salesman's region
//   - target from assigned Targets first, then latest Trends as a fallback
const getRegions = async (req, res) => {
  try {
    const regions = await Region.find().sort({ createdAt: -1 }).lean();

    const [salesmen, targets, latestPeriodDoc] = await Promise.all([
      Salesman.find().lean(),
      Target.find().populate("assignedTo").lean(),
      Trend.findOne().sort({ period: -1 }).select("period").lean(),
    ]);

    const latestPeriod = latestPeriodDoc?.period || null;

    const teamByRegion = new Map();
    const personRegionByName = new Map();

    const addTeamMember = ({ salesperson, name, designation, region }) => {
      const personName = salesperson || name;
      const personKey = normalizeName(personName);
      const regionKey = normalizeRegion(region);
      if (!personKey || !regionKey) return;

      personRegionByName.set(personKey, region);

      if (!teamByRegion.has(regionKey)) teamByRegion.set(regionKey, new Map());
      const regionTeam = teamByRegion.get(regionKey);
      const existing = regionTeam.get(personKey) || {};
      regionTeam.set(personKey, {
        salesperson: personName || existing.salesperson,
        designation: designation || existing.designation || null,
      });
    };

    salesmen.forEach((salesman) => {
      addTeamMember({
        salesperson: salesman.name,
        designation: salesman.designation || null,
        region: salesman.area,
      });
    });

    targets.forEach((target) => {
      addTeamMember({
        salesperson: getTargetSalesperson(target),
        designation: target.assignedTo?.designation || null,
        region: getTargetRegion(target),
      });
    });

    const salesByRegion = new Map();
    if (latestPeriod) {
      const trendAgg = await Trend.aggregate([
        { $match: { period: latestPeriod } },
        {
          $group: {
            _id: "$salesperson",
            saleValueRs: { $sum: "$saleValueRs" },
            targetValueRs: { $sum: "$targetValueRs" },
          },
        },
      ]);

      trendAgg.forEach((t) => {
        const trendSalesperson = normalizeName(t._id);
        const region =
          personRegionByName.get(trendSalesperson) ||
          salesmen.find((s) => normalizeName(s.name) === trendSalesperson)?.area;
        const regionKey = normalizeRegion(region);
        if (!regionKey) return;

        const existing = salesByRegion.get(regionKey) || {
          saleValueRs: 0,
          targetValueRs: 0,
        };
        salesByRegion.set(regionKey, {
          saleValueRs: existing.saleValueRs + Number(t.saleValueRs || 0),
          targetValueRs: existing.targetValueRs + Number(t.targetValueRs || 0),
        });
      });
    }

    const assignedTargetsByRegion = new Map();
    targets.forEach((target) => {
      if (target.status === "inactive") return;
      const regionKey = normalizeRegion(getTargetRegion(target));
      if (!regionKey) return;

      const existing = assignedTargetsByRegion.get(regionKey) || {
        totalRevenue: 0,
        totalQuantity: 0,
      };
      assignedTargetsByRegion.set(regionKey, {
        totalRevenue:
          existing.totalRevenue +
          Number(
            target.totalRevenue ||
              target.products?.reduce(
                (sum, product) => sum + Number(product.targetRevenue || 0),
                0,
              ) ||
              0,
          ),
        totalQuantity:
          existing.totalQuantity +
          Number(
            target.totalQuantity ||
              target.products?.reduce(
                (sum, product) => sum + Number(product.targetQuantity || 0),
                0,
              ) ||
              0,
          ),
      });
    });

    const enriched = regions.map((r) => {
      const regionKey = normalizeRegion(r.region);
      const uniqueTeam = [...(teamByRegion.get(regionKey)?.values() || [])].sort(
        (a, b) => a.salesperson.localeCompare(b.salesperson),
      );
      const trendTotals = salesByRegion.get(regionKey) || {
        saleValueRs: 0,
        targetValueRs: 0,
      };
      const assignedTargetTotals = assignedTargetsByRegion.get(regionKey);

      return {
        ...r,
        salesTeam: uniqueTeam,
        salesCount: uniqueTeam.length,
        monthlySales: trendTotals.saleValueRs,
        target:
          assignedTargetTotals?.totalRevenue || trendTotals.targetValueRs || 0,
        targetQuantity: assignedTargetTotals?.totalQuantity || 0,
        period: latestPeriod,
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateRegion = async (req, res) => {
  try {
    const updatedRegion = await Region.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    res.json(updatedRegion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteRegion = async (req, res) => {
  try {
    await Region.findByIdAndDelete(req.params.id);
    res.json({ message: "Region deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createRegion,
  getRegions,
  updateRegion,
  deleteRegion,
};
