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

    // Monthly / Weekly / Daily
    period: {
      type: String,
      enum: ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"],
      default: "Monthly",
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
