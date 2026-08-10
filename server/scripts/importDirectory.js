/**
 * One-time import script for Business Directory data (Feed Mills + Sales Team).
 *
 * SETUP:
 * 1. Copy the two source JSON files into the same folder as this script
 *    (or update the FEED_MILLS_FILE / SALES_TEAM_FILE paths below):
 *      - Feed_Mills.json
 *      - Sales_Team.json
 * 2. Make sure your .env has your Mongo connection string. This script tries
 *    MONGO_URI first, then MONGODB_URI - update the env var name below if
 *    your project uses something else.
 * 3. Run from your backend project root:
 *      node scripts/importDirectory.js
 *
 * This script wipes the FeedMill and SalesTeam collections before
 * re-inserting, so you can safely re-run it after fixing data issues
 * without creating duplicates. If you'd rather keep other directory data
 * untouched later, swap the deleteMany({}) calls for a scoped filter
 * (e.g. { importedFrom: 'Feed_Mills.json' }) the same way importTrends.js
 * scopes deletes by sourceFile.
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const FeedMill = require("../models/FeedMill");
const SalesTeam = require("../models/SalesTeam");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const FEED_MILLS_FILE = path.join(__dirname, "Feed_Mills.json");
const SALES_TEAM_FILE = path.join(__dirname, "Sales_Team.json");

function normalizeFeedMill(record) {
  return {
    srNo: record["Sr#"] ?? null,
    feedMillName: (record["Feed Mill Name"] || "").toString().trim(),
    districtRegion: (record["District/Region"] || "").toString().trim(),
    millOwner: (record["Mill Owner"] || "").toString().trim(),
    millAddress: (record["Mill Address"] || "").toString().trim(),
    millPhones: record["Mill Phone(s)"] || null,
    officeAddress: (record["Office Address"] || "").toString().trim(),
    officePhones: record["Office Phone(s)"] || null,
    email: record["Email"] || null,
    productionCapacity: record["Production Capacity"] || null,
    bagsPerMonth: record["Number of Bags per Month"] || null,
  };
}

// NOTE: the source JSON uses the key "Saleperson" (missing an 's') - kept
// as-is here since that's what's actually in the file.
function normalizeSalesperson(record) {
  return {
    salesperson: (record["Saleperson"] || "").toString().trim(),
    designation: (record["Designation"] || "").toString().trim(),
    region: (record["Region"] || "").toString().trim(),
  };
}

async function importFeedMills() {
  if (!fs.existsSync(FEED_MILLS_FILE)) {
    console.warn(`Skipping missing file: ${FEED_MILLS_FILE}`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(FEED_MILLS_FILE, "utf-8"));
  const records = Array.isArray(raw["Feed Mills"]) ? raw["Feed Mills"] : [];
  console.log(`\nFeed Mills: ${records.length} records found`);

  const normalized = records.map(normalizeFeedMill);

  const deleted = await FeedMill.deleteMany({});
  if (deleted.deletedCount) {
    console.log(
      `  Removed ${deleted.deletedCount} previously imported Feed Mill records`,
    );
  }

  const inserted = await FeedMill.insertMany(normalized);
  console.log(`  Inserted ${inserted.length} Feed Mill records`);
}

async function importSalesTeam() {
  if (!fs.existsSync(SALES_TEAM_FILE)) {
    console.warn(`Skipping missing file: ${SALES_TEAM_FILE}`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(SALES_TEAM_FILE, "utf-8"));
  const records = Array.isArray(raw["Sales Team"]) ? raw["Sales Team"] : [];
  console.log(`\nSales Team: ${records.length} records found`);

  const normalized = records.map(normalizeSalesperson);

  const deleted = await SalesTeam.deleteMany({});
  if (deleted.deletedCount) {
    console.log(
      `  Removed ${deleted.deletedCount} previously imported Sales Team records`,
    );
  }

  const inserted = await SalesTeam.insertMany(normalized);
  console.log(`  Inserted ${inserted.length} Sales Team records`);
}

async function run() {
  if (!MONGO_URI) {
    console.error(
      "No Mongo connection string found. Set MONGO_URI or MONGODB_URI in your .env",
    );
    process.exit(1);
  }

  const dbName = process.env.MONGODB_DB || "sales_dashboard";
  await mongoose.connect(MONGO_URI, { dbName });
  console.log(`Connected to MongoDB (${dbName})`);

  await importFeedMills();
  await importSalesTeam();

  console.log("\nDone.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
