const mongoose = require("mongoose");

/**
 * Recovery
 *
 * salesperson / customer / region are stored as plain strings (not ObjectId
 * refs) on purpose - same pattern as Sale.js in this app - since each is
 * merged on the frontend from multiple collections (Salesman + SalesTeam,
 * Feed Mills, Region) that don't share a common _id space.
 *
 * Balance, Days Overdue, and Status are deliberately NOT stored here.
 * Balance is trivially derivable (invoiceAmount - amountRecovered), and Days
 * Overdue / Status both depend on TODAY's date - storing them would mean
 * a record silently goes stale (e.g. a "Pending" invoice should become
 * "Overdue" the day after its due date passes, with no edit having
 * happened). Instead these three are computed fresh on every read - see
 * computeDerivedFields() in recoveryController.js.
 */
const recoverySchema = new mongoose.Schema(
  {
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },

    salesperson: { type: String, required: true, trim: true },
    customer: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true },

    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    invoiceAmount: { type: Number, default: 0, min: 0 },
    amountRecovered: { type: Number, default: 0, min: 0 },
    recoveryDate: { type: Date, default: null },

    notes: { type: String, trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Recovery", recoverySchema);
