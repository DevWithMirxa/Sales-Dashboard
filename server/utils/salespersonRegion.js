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

// Leading title, e.g. "Dr." / "Mr." / "Mrs." - used as a tiebreaker so that
// "Mr. Junaid" isn't misattributed to the (distinct) "Dr. Junaid".
const titleOf = (name) => {
  const m = String(name || "")
    .trim()
    .match(/^(dr|mr|mrs|ms|engr|eng|prof)(?:\s*\.)?\s/i);
  return m ? m[1].toLowerCase() : null;
};

// Some Trend salesperson names are typos / abbreviations (from the raw source
// files) that can never be matched to a Salesman record by name alone. Mapping
// the EXACT Trend name to the Salesman it actually refers to lets those sales
// be attributed to the right region instead of falling through to "Unknown".
// Adjust / extend this map if the source data changes.
const SALESPERSON_ALIASES = {
  "Ameen Mati": "Mr. Ameen Matee", // typo: Mati -> Matee (Karachi)
  "Dr. A. Rehman": "Dr. Abdul Rehman", // abbreviation (Sahiwal)
  "Dr. Abdul Rrehman": "Dr. Abdul Rehman", // typo: double-r (Sahiwal)
  // best-effort guess: only "Nas*" salesperson on file is Mr. Nasie Ejaz (Lahore)
  "Mr. Nasir": "Mr. Nasie Ejaz",
};

// "Karachi (Mr. Shakeeb's slot)" -> "Karachi"
const parseRegionTag = (salespersonName) => {
  const m = String(salespersonName || "").match(/^([^(]+?)\s*\(([^)]+)\)$/);
  return m ? m[1].trim() : null;
};

/**
 * True when every significant token of the trend name is present in the
 * salesman's name (or vice-versa), i.e. one is a tolerant subset of the other.
 * Order / extra suffixes (area codes, initials) are ignored.
 */
const looselyMatches = (nameTokens, salesmanTokens) => {
  if (!nameTokens.length || !salesmanTokens.length) return false;
  const shorter =
    nameTokens.length <= salesmanTokens.length ? nameTokens : salesmanTokens;
  const longerSet = new Set(
    nameTokens.length <= salesmanTokens.length ? salesmanTokens : nameTokens,
  );
  return shorter.every((t) => longerSet.has(t));
};

// Higher is better; lets us pick the BEST salesman when several loosely match
// (e.g. "Mr. Junaid" vs "Dr. Junaid") instead of whichever the DB returns first.
const scoreMatch = (nameTokens, salesmanTokens, nameTitle, salesmanTitle) => {
  let score = 0;
  // Identical significant tokens (title/order aside) is a near-perfect match.
  if (
    nameTokens.length === salesmanTokens.length &&
    nameTokens.every((t) => salesmanTokens.includes(t))
  ) {
    score += 100;
  }
  // Matching honorific is a strong tiebreaker for legend-like names.
  if (nameTitle && nameTitle === salesmanTitle) score += 10;
  // Closeness: fewer extra tokens is better.
  score += Math.max(nameTokens.length, salesmanTokens.length);
  return score;
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

    // Resolve through an explicit alias first (typos/abbreviations can never be
    // matched by name alone), otherwise fall back to tolerant name matching.
    const aliasName = SALESPERSON_ALIASES[sp];
    const targetName = aliasName || sp;
    const nameTokens = tokens(targetName);
    const nameTitle = titleOf(targetName);

    let area = null;

    // Fast path: an alias points at an exact Salesman name.
    if (aliasName) {
      const exact = salesmen.find(
        (s) =>
          String(s.name).trim().toLowerCase() ===
          String(aliasName).trim().toLowerCase(),
      );
      if (exact) {
        map[sp] = exact.area || "Unknown";
        return;
      }
    }

    // Best-match: pick the salesman that scores highest (preferring an exact
    // name / matching title) rather than just the first loose match in the DB.
    if (nameTokens.length) {
      let best = null;
      let bestScore = -1;
      for (const s of salesmen) {
        const salesmanTokens = tokens(s.name);
        if (!looselyMatches(nameTokens, salesmanTokens)) continue;
        const score = scoreMatch(
          nameTokens,
          salesmanTokens,
          nameTitle,
          titleOf(s.name),
        );
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
      area = best ? best.area : null;
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
