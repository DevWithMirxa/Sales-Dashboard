const mongoose = require("mongoose");

const salesTeamSchema = new mongoose.Schema(
  {
    salesperson: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    region: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SalesTeam", salesTeamSchema, "salesteams");
