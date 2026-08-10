const Region = require("../models/Region");
const FeedMill = require("../models/FeedMill");

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

const getRegions = async (req, res) => {
  try {
    const regions = await Region.find().sort({ createdAt: -1 });
    res.json(regions);
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
