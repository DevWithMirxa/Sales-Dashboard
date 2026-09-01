/**
 * One-time import script for Business Directory data (Feed Mills).
 *
 * SETUP:
 * 1. Copy the Feed_Mills.json source file into the same folder as this script
 *    (or update the FEED_MILLS_FILE path below).
 * 2. Make sure your .env has your Mongo connection string. This script tries
 *    MONGO_URI first, then MONGODB_URI - update the env var name below if
 *    your project uses something else.
 * 3. Run from your backend project root:
 *      node scripts/importDirectory.js
 *
 * This script wipes the FeedMill collection before re-inserting, so you can
 * safely re-run it after fixing data issues without creating duplicates.
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const FeedMill = require("../models/FeedMill");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const FEED_MILLS_FILE = path.join(__dirname, "Feed_Mills.json");

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

  console.log("\nDone.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
