const mongoose = require("mongoose");

/**
 * Sale
 *
 * salesman / product / customer / region are stored as plain strings
 * (not ObjectId refs) on purpose: each of these is merged on the frontend
 * from TWO different collections (Salesman + SalesTeam, Product + Target,
 * etc.) that don't share a common _id space. Storing the resolved name
 * avoids having to track "which collection did this id come from" on every
 * read. This mirrors the existing pattern already used in this app for
 * Target.region and Salesman.area, which are also plain strings.
 */
const saleSchema = new mongoose.Schema(
  {
    salesman: { type: String, required: true, trim: true },
    product: { type: String, required: true, trim: true },
    customer: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true },

    quantity: { type: Number, default: 0, min: 0 },
    unit: {
      type: String,
      enum: ["kg", "bags", "tons", "units"],
      default: "bags",
    },
    rate: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },

    saleDate: { type: Date, default: Date.now },
    notes: { type: String, trim: true },

    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "completed",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Sale", saleSchema);
