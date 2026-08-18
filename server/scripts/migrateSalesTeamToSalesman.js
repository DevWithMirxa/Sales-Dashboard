/**
 * One-time migration: copy any Business Directory "Sales Team" members that
 * aren't already in the Salesman collection over to Salesman, matching by
 * name (case/whitespace-insensitive) so nobody gets duplicated.
 *
 * Run this ONCE, before you remove/ignore the Sales Team tab, so no data
 * silently disappears. Safe to re-run - anything already migrated (or that
 * already existed in Salesman) is skipped automatically.
 *
 * Usage (from your backend project root):
 *   node scripts/migrateSalesTeamToSalesman.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Salesman = require("../models/Salesman");
const SalesTeam = require("../models/SalesTeam");

const run = async () => {
  await connectDB();

  const salesTeamMembers = await SalesTeam.find();
  const existingSalesmen = await Salesman.find().select("name");
  const existingNames = new Set(
    existingSalesmen.map((s) => (s.name || "").trim().toLowerCase()),
  );

  let migrated = 0;
  let skipped = 0;

  for (const member of salesTeamMembers) {
    const key = (member.salesperson || "").trim().toLowerCase();

    if (!key || existingNames.has(key)) {
      skipped++;
      continue;
    }

    await Salesman.create({
      name: member.salesperson,
      // Salesman.contactNumber is required, but SalesTeam never captured a
      // phone number - "N/A" as a placeholder so the record can be created
      // at all. Go back and fill in the real number on the Salesmen page
      // for anyone migrated this way.
      contactNumber: "N/A",
      designation: member.designation || "",
      area: member.region || "",
    });

    existingNames.add(key);
    migrated++;
  }

  console.log(`Migrated ${migrated} sales team member(s) into Salesman.`);
  console.log(
    `Skipped ${skipped} (name already existed in Salesman, or was blank).`,
  );

  if (migrated > 0) {
    console.log(
      '\nHeads up: migrated records have a placeholder "N/A" contact number - ' +
        "edit them on the Salesmen page to add real phone numbers.",
    );
  }

  process.exit(0);
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
