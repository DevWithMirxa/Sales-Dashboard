/**
 * One-time import script for historical sales Trend data.
 *
 * SETUP:
 * 1. Copy the two source JSON files into the same folder as this script
 *    (or update the FILES array below with the correct paths):
 *      - Sale_Data_Analysis_2025_cleaned.json
 *      - Sale_Data_analysis_2024_cleaned.json
 * 2. Make sure your .env has your Mongo connection string. This script tries
 *    MONGO_URI first, then MONGODB_URI - update the env var name below if
 *    your project uses something else.
 * 3. Run from your backend project root:
 *      node scripts/importTrends.js
 *
 * This script is idempotent-ish: it wipes existing Trend documents that came
 * from the same sourceFile before re-inserting, so you can safely re-run it
 * after fixing data issues (e.g. adding a salesperson alias) without
 * creating duplicates.
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Trend = require("../models/Trend");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const FILES = [
  path.join(__dirname, "Sale_Data_Analysis_2025_cleaned.json"),
  path.join(__dirname, "Sale_Data_analysis_2024_cleaned.json"),
];

// Confirmed spacing-only duplicates across the two files. Add more entries
// here if you confirm other names refer to the same person
// (e.g. 'Dr. Abdul Rrehman': 'Dr. A. Rehman' - left out because it's a guess,
// review manually before adding).
const SALESPERSON_ALIASES = {
  "Dr.Imran": "Dr. Imran",
  "Mr.Shakeeb": "Mr. Shakeeb",
  "Mr.Junaid": "Mr. Junaid",
};

const MONTH_MAP = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function parseMonth(raw) {
  // raw looks like "Jan 25"
  const [mon, yy] = raw.trim().split(/\s+/);
  const monthNumber = MONTH_MAP[mon];
  if (!monthNumber) throw new Error(`Unrecognized month label: "${raw}"`);
  const year = 2000 + parseInt(yy, 10);
  const period = `${year}-${String(monthNumber).padStart(2, "0")}`;
  return { month: mon, monthNumber, year, period };
}

function normalizeSalesperson(raw) {
  const trimmed = (raw || "").toString().trim();
  return SALESPERSON_ALIASES[trimmed] || trimmed;
}

// The 2024 and 2025 files use different field names for the same values.
// This function detects which shape a record is and normalizes it.
function normalizeRecord(record, sourceFile) {
  const { month, monthNumber, year, period } = parseMonth(record.Month);

  const targetVolumeKg =
    record["Volume Target (Kg)"] ?? record["Target Volume (Kg)"] ?? 0;
  const saleVolumeKg =
    record["Volume Sale (Kg)"] ?? record["Sale Volume (Kg)"] ?? 0;
  const targetValueRs =
    record["Value Target (Rs)"] ?? record["Target Value (Rs)"] ?? 0;
  const saleValueRs =
    record["Value Sale (Rs)"] ?? record["Sale Value (Rs)"] ?? 0;

  return {
    month,
    monthNumber,
    year,
    period,
    salesperson: normalizeSalesperson(record.Salesperson),
    product: (record.Product || "").toString().trim(),
    targetVolumeKg: Number(targetVolumeKg) || 0,
    saleVolumeKg: Number(saleVolumeKg) || 0,
    targetValueRs: Number(targetValueRs) || 0,
    saleValueRs: Number(saleValueRs) || 0,
    productPriceRs: record["Product Price (Rs/Kg)"] ?? null,
    productPackingKg: record["Product Packing (Kg)"] ?? null,
    sourceFile,
  };
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

  let totalInserted = 0;

  for (const filePath of FILES) {
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping missing file: ${filePath}`);
      continue;
    }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const sourceFile = raw.source_file || path.basename(filePath);
    const records = Array.isArray(raw.data) ? raw.data : [];

    console.log(`\n${sourceFile}: ${records.length} records found`);

    const normalized = records.map((r) => normalizeRecord(r, sourceFile));

    // Clear any previous import from this same source file to avoid duplicates
    const deleted = await Trend.deleteMany({ sourceFile });
    if (deleted.deletedCount) {
      console.log(
        `  Removed ${deleted.deletedCount} previously imported records for this file`,
      );
    }

    const inserted = await Trend.insertMany(normalized);
    console.log(`  Inserted ${inserted.length} records`);
    totalInserted += inserted.length;
  }

  console.log(`\nDone. Total records inserted: ${totalInserted}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
