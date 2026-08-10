const mongoose = require("mongoose");

const feedMillSchema = new mongoose.Schema(
  {
    srNo: { type: Number },
    feedMillName: { type: String, required: true, trim: true },
    districtRegion: { type: String, trim: true },
    millOwner: { type: String, trim: true },
    millAddress: { type: String, trim: true },
    millPhones: { type: String, trim: true, default: null },
    officeAddress: { type: String, trim: true },
    officePhones: { type: String, trim: true, default: null },
    email: { type: String, trim: true, default: null },
    productionCapacity: { type: String, trim: true, default: null },
    bagsPerMonth: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("FeedMill", feedMillSchema, "feedmills");
