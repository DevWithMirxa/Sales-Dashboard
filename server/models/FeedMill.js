const mongoose = require("mongoose");

// One person on-site at a feed mill. A mill can have several contacts
// (e.g. owner, purchase manager, accountant) - exactly one should be
// flagged isPrimary at a time, enforced on the frontend form.
const contactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    mobile: { type: String, trim: true },
    landline: { type: String, trim: true },
    email: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

const feedMillSchema = new mongoose.Schema(
  {
    srNo: { type: Number },
    feedMillName: { type: String, required: true, trim: true },
    districtRegion: { type: String, trim: true },
    millOwner: { type: String, trim: true },
    ownerContact: { type: String, trim: true, default: null },
    millAddress: { type: String, trim: true },
    millPhones: { type: String, trim: true, default: null },
    officeAddress: { type: String, trim: true },
    officePhones: { type: String, trim: true, default: null },
    email: { type: String, trim: true, default: null },
    productionCapacity: { type: String, trim: true, default: null },
    bagsPerMonth: { type: String, trim: true, default: null },
    contacts: { type: [contactSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("FeedMill", feedMillSchema, "feedmills");
