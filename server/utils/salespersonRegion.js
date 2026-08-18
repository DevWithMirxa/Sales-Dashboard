/**
 * Shared helper to (loosely) assign a region/area to each Trend salesperson.
 *
 * The Trend records store the salesperson as a plain string with no region,
 * while the Salesman collection carries `name` + `area`. The names don't always
 * match exactly (e.g. trend "Dr. Asad Afzal" vs salesman
 * "Dr. Asad Afzal LHR RWL SWL"), so we use a tolerant token-subset comparison.
 * A parenthesized region tag in the salesperson name is also honored
 * (e.g. "Karachi (Mr. Shakeeb's slot)" -> Karachi).
 *
 * This lets the dashboard's Region filter (and the "region" shown next to
 * salespeople / on region charts) be driven entirely by sales data that
 * actually exists.
 */
const Salesman = require("../models/Salesman");
const Trend = require("../models/Trend");

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "engr", "eng", "prof"]);

const tokens = (name) =>
  String(name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .filter((t) => !HONORIFICS.has(t));

/**
 * True when every significant token of one name is present in the other
 * name's token set (order/suffixes like area codes are ignored).
 */
const isNameSubset = (nameA, nameB) => {
  const a = tokens(nameA);
  const b = tokens(nameB);
  if (!a.length || !b.length) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = new Set(a.length <= b.length ? b : a);
  return shorter.every((t) => longer.has(t));
};

// "Karachi (Mr. Shakeeb's slot)" -> "Karachi"
const parseRegionTag = (salespersonName) => {
  const m = String(salespersonName || "").match(/^([^(]+?)\s*\(([^)]+)\)$/);
  return m ? m[1].trim() : null;
};

// salesperson name -> region string (never undefined; falls back to "Unknown")
const getSalespersonRegionMap = async () => {
  const [salesmen, trendSalespersons] = await Promise.all([
    Salesman.find().select("name area"),
    Trend.distinct("salesperson"),
  ]);

  const map = {};
  trendSalespersons.forEach((sp) => {
    const tag = parseRegionTag(sp);
    if (tag) {
      map[sp] = tag;
      return;
    }
    let area = null;
    for (const s of salesmen) {
      if (isNameSubset(s.name, sp)) {
        area = s.area || null;
        break;
      }
    }
    map[sp] = area || "Unknown";
  });
  return map;
};

// Sorted list of regions that actually contain at least one trend record.
const getTrendRegions = async () => {
  const map = await getSalespersonRegionMap();
  const regions = new Set(
    Object.values(map).filter((r) => r && r !== "Unknown"),
  );
  return Array.from(regions).sort();
};

// Sorted list of salesperson names that appear in Trend data
const getTrendSalespersons = async () => {
  const list = await Trend.distinct("salesperson");
  return list.sort();
};

module.exports = {
  getSalespersonRegionMap,
  getTrendRegions,
  getTrendSalespersons,
};