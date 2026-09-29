const mongoose = require("mongoose");

const productTargetSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    targetQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    targetRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },

    unit: {
      type: String,
      enum: ["kg", "bags", "tons", "units"],
      default: "kg",
    },
  },
  { _id: false },
);

// Normalizes any Date to the 1st of its month, midnight - so periodStart
// values are always directly comparable regardless of what day-of-month
// they were originally submitted with.
const toMonthStart = (d) => {
  const date = d ? new Date(d) : new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const targetSchema = new mongoose.Schema(
  {
    // Salesman selected in TargetForm
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salesman",
      required: true,
    },

    // Plain string, matching how region/area is stored everywhere else in this
    // app (Customer.region, Salesman.area) - not a separate Region collection.
    // Auto-filled from the salesman's area on the frontend, but editable.
    region: {
      type: String,
      trim: true,
      default: "",
    },

    // Optional Target Name
    targetName: {
      type: String,
      trim: true,
      default: "",
    },

    // Monthly / Weekly / Daily / Quarterly / Yearly - the DURATION this
    // target covers, starting from periodStart below.
    period: {
      type: String,
      enum: ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"],
      default: "Monthly",
    },

    // Which calendar month this target is FOR - explicit and user-editable,
    // unlike the old approach of reusing createdAt (a bookkeeping timestamp
    // Mongoose auto-sets to "whenever this document was saved," which can't
    // represent backfilling a past month or planning a future one, and was
    // never exposed for the user to see or edit). Always normalized to the
    // 1st of the month so it's directly comparable across records. This is
    // what lets a Target be matched against Sale records for the same
    // month - the original problem this field was added to solve.
    periodStart: {
      type: Date,
      required: true,
      default: toMonthStart,
      set: toMonthStart,
    },

    // Products assigned to salesman
    products: [productTargetSchema],

    // Summary
    totalQuantity: {
      type: Number,
      default: 0,
    },

    totalRevenue: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "completed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Target", targetSchema);
