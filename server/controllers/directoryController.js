const FeedMill = require("../models/FeedMill");
const SalesTeam = require("../models/SalesTeam");

// GET /directory/feed-mills?search=&district=
const getFeedMills = async (req, res) => {
  try {
    const { search, district } = req.query;
    const match = {};

    if (district && district !== "all") {
      match.districtRegion = district;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      match.$or = [
        { feedMillName: regex },
        { millOwner: regex },
        { districtRegion: regex },
      ];
    }

    const rows = await FeedMill.find(match).sort({ feedMillName: 1 });
    res.json({ rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /directory/sales-team?search=&designation=
const getSalesTeam = async (req, res) => {
  try {
    const { search, designation } = req.query;
    const match = {};

    if (designation && designation !== "all") {
      match.designation = designation;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      match.$or = [
        { salesperson: regex },
        { designation: regex },
        { region: regex },
      ];
    }

    const rows = await SalesTeam.find(match).sort({ salesperson: 1 });
    res.json({ rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /directory/filters - distinct values to populate filter dropdowns
const getFilters = async (req, res) => {
  try {
    const [districts, designations] = await Promise.all([
      FeedMill.distinct("districtRegion"),
      SalesTeam.distinct("designation"),
    ]);

    res.json({
      districts: districts.filter(Boolean).sort(),
      designations: designations.filter(Boolean).sort(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getFeedMills,
  getSalesTeam,
  getFilters,
};
