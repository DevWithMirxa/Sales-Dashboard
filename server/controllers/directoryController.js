const FeedMill = require("../models/FeedMill");
const XLSX = require("xlsx");

// GET /directory/feed-mills?search=&district=
const getFeedMills = async (req, res) => {
  try {
    const { search, district } = req.query;
    const match = {};

    if (district && district !== "all") {
      match.districtRegion = district;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      match.$or = [
        { feedMillName: regex },
        { districtRegion: regex },
        // Contacts replaced "Mill Owner" as the source of the person's
        // name/role at a mill - match across the whole contacts array.
        { "contacts.name": regex },
        { "contacts.designation": regex },
        { "contacts.department": regex },
      ];
    }

    const rows = await FeedMill.find(match).sort({ feedMillName: 1 });
    res.json({ rows, total: rows.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /directory/filters - distinct values to populate filter dropdowns
const getFilters = async (req, res) => {
  try {
    const districts = await FeedMill.distinct("districtRegion");
    res.json({
      districts: districts.filter(Boolean).sort(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /directory/feed-mills - create a new feed mill
const createFeedMill = async (req, res) => {
  try {
    const doc = await FeedMill.create(req.body);
    res.status(201).json(doc);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PUT /directory/feed-mills/:id - update an existing feed mill
const updateFeedMill = async (req, res) => {
  try {
    const doc = await FeedMill.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ message: "Feed mill not found" });
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE /directory/feed-mills/:id - remove a feed mill
const deleteFeedMill = async (req, res) => {
  try {
    const doc = await FeedMill.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Feed mill not found" });
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Excel upload — Feed Mills. Same header-detection approach as the other uploads.
//
// Column mapping (per confirmed decisions):
//   Feed Mill Name    -> feedMillName (required, upsert key)
//   Address           -> dropped (duplicate of Mill Address); used as a
//                         fallback for millAddress only if "Mill Address"
//                         itself isn't found in the header row
//   Contact           -> appended into millPhones (it's a phone number, and
//                         millPhones is free-text/plural so it can hold more
//                         than one number). Distinct from the "Contact ___"
//                         person columns below.
//   Mill Address      -> millAddress
//   Office Address    -> officeAddress
//   Mill Phone(s)     -> millPhones
//   Office Phone(s)   -> officePhones
//   Email             -> email (the mill's own email, not a person's)
//   Production        -> copied into BOTH productionCapacity and bagsPerMonth
//   Contact Name        \
//   Contact Designation  |  together become contacts[0] - a single primary
//   Contact Department   |  contact (isPrimary: true). Only written when at
//   Contact Mobile       |  least one of these six columns has a value for
//   Contact Landline     |  that row, so rows with no contact info don't
//   Contact Email       /   wipe out contacts entered via the Add/Edit form.
//                           NOTE: this replaces the mill's entire contacts
//                           array with this single contact - if a mill has
//                           multiple contacts entered via the form, uploading
//                           a row for it will reduce it down to just this one.
//
// Not mapped from these headers: districtRegion, millOwner, srNo - these
// stay empty on upload (districtRegion in particular means uploaded rows
// won't show up under a specific district filter until that's populated).
// ownerContact IS mapped from the \"Owner's Contact\" header above.
// ---------------------------------------------------------------------------

const normalizeHeader = (h) =>
  String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Scans the first few rows for whichever one actually contains "Feed Mill"
// and "Email" as column headers (tolerates a title row above the headers).
const findHeaderRow = (matrix) => {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = matrix[i] || [];
    const hasFeedMill = row.some((cell) =>
      normalizeHeader(cell).includes("feedmill"),
    );
    const hasEmail = row.some((cell) =>
      normalizeHeader(cell).includes("email"),
    );
    if (hasFeedMill && hasEmail) {
      return { headerRowIndex: i, headers: row };
    }
  }
  return null;
};

// Matches a logical field to whichever column header contains all of the
// given keywords, regardless of word order.
const findColumnIndex = (headers, keywords, excludeKeywords = []) =>
  headers.findIndex((h) => {
    const norm = normalizeHeader(h);
    return (
      keywords.every((k) => norm.includes(k)) &&
      !excludeKeywords.some((k) => norm.includes(k))
    );
  });

const cell = (row, idx) =>
  idx !== -1 && row[idx] !== null && row[idx] !== undefined
    ? String(row[idx]).trim()
    : "";

// Joins two phone-ish strings without producing a stray leading/trailing
// separator if one side is empty.
const joinPhones = (a, b) => [a, b].filter(Boolean).join(", ");

// POST /directory/feed-mills/upload - accepts an .xlsx/.xls file with Feed
// Mill Name, Address, Owner's Contact, Mill Address, Office Address, Mill
// Phone(s), Office Phone(s), Email, Capacity (MT / Hour), Production
// (Bags / Month), Contact Name, Contact Designation, Contact Department,
// Contact Mobile, Contact Landline, Contact Email columns (order-independent,
// optional title row tolerated). Upserts on
// Feed Mill Name so re-uploading updates existing feed mills instead of
// duplicating them.
const uploadFeedMills = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });

    let matrix = null;
    let headerInfo = null;
    for (const name of workbook.SheetNames) {
      const candidate = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: null,
      });
      const found = findHeaderRow(candidate);
      if (found) {
        matrix = candidate;
        headerInfo = found;
        break;
      }
    }

    if (!headerInfo) {
      return res.status(400).json({
        message:
          'Could not find a header row with "Feed Mill Name" and "Email" columns in any sheet.',
      });
    }

    const { headerRowIndex, headers } = headerInfo;
    const col = {
      feedMillName: findColumnIndex(headers, ["feedmill"]),
      plainAddress: findColumnIndex(headers, ["address"], ["mill", "office"]),
      // Excludes "Contact Name"/"Contact Mobile"/etc so the phone-number
      // "Contact" column doesn't accidentally match those instead.
      contact: findColumnIndex(
        headers,
        ["contact"],
        ["name", "designation", "department", "mobile", "landline", "email", "owner"],
      ),
      // "Owner's Contact" maps to the mill owner's own phone number. It's
      // kept separate from the generic "Contact" fallback above (which now
      // excludes "owner" so the renamed template column doesn't get merged
      // into millPhones by mistake).
      ownerContact: findColumnIndex(headers, ["owner", "contact"]),
      millAddress: findColumnIndex(headers, ["mill", "address"]),
      officeAddress: findColumnIndex(headers, ["office", "address"]),
      millPhones: findColumnIndex(headers, ["mill", "phone"]),
      officePhones: findColumnIndex(headers, ["office", "phone"]),
      // Excludes "Contact Email" so the mill's own email doesn't get
      // confused with the contact person's email.
      email: findColumnIndex(headers, ["email"], ["contact"]),
      // "Capacity (MT / Hour)" and "Production (Bags / Month)" map to the two
      // separate capacity/bags fields. A single legacy "Production" column is
      // kept as a fallback so older files still upload correctly (and the
      // new "Production (Bags / Month)" header is matched by the "bags" one
      // below, not by this generic fallback).
      capacity: findColumnIndex(headers, ["capacity"]),
      bags: findColumnIndex(headers, ["bags"]),
      production: findColumnIndex(
        headers,
        ["production"],
        ["capacity", "bags"],
      ),
      contactName: findColumnIndex(headers, ["contact", "name"]),
      contactDesignation: findColumnIndex(headers, ["contact", "designation"]),
      contactDepartment: findColumnIndex(headers, ["contact", "department"]),
      contactMobile: findColumnIndex(headers, ["contact", "mobile"]),
      contactLandline: findColumnIndex(headers, ["contact", "landline"]),
      contactEmail: findColumnIndex(headers, ["contact", "email"]),
    };

    if (col.feedMillName === -1) {
      return res.status(400).json({
        message: "Could not find a Feed Mill Name column in the sheet headers.",
      });
    }

    const dataRows = matrix
      .slice(headerRowIndex + 1)
      .filter((row) => row && row.some((c) => c !== null && c !== ""));

    if (!dataRows.length) {
      return res
        .status(400)
        .json({ message: "The uploaded sheet has no data rows." });
    }

    const errors = [];
    const operations = [];

    dataRows.forEach((row, idx) => {
      const rowNum = headerRowIndex + idx + 2; // 1-indexed, after the header row

      const feedMillName = cell(row, col.feedMillName);
      if (!feedMillName) {
        errors.push(`Row ${rowNum}: missing Feed Mill Name`);
        return;
      }

      const millAddress =
        col.millAddress !== -1
          ? cell(row, col.millAddress)
          : cell(row, col.plainAddress); // fallback if "Mill Address" itself is absent

      const capacity = cell(row, col.capacity);
      const bags = cell(row, col.bags);
      const productionFallback = cell(row, col.production);

      const contactName = cell(row, col.contactName);
      const contactDesignation = cell(row, col.contactDesignation);
      const contactDepartment = cell(row, col.contactDepartment);
      const contactMobile = cell(row, col.contactMobile);
      const contactLandline = cell(row, col.contactLandline);
      const contactEmail = cell(row, col.contactEmail);
      const hasContactInfo =
        contactName ||
        contactDesignation ||
        contactDepartment ||
        contactMobile ||
        contactLandline ||
        contactEmail;

      const doc = {
        feedMillName,
        millAddress,
        ownerContact: cell(row, col.ownerContact) || null,
        officeAddress: cell(row, col.officeAddress),
        millPhones: joinPhones(
          cell(row, col.millPhones),
          cell(row, col.contact),
        ),
        officePhones: cell(row, col.officePhones),
        email: cell(row, col.email) || null,
        productionCapacity: capacity || productionFallback || null,
        bagsPerMonth: bags || productionFallback || null,
      };

      // Only touch contacts if the row actually has contact info - an empty
      // contacts array in $set would otherwise wipe out contacts entered via
      // the Add/Edit form for a mill that's just being re-uploaded for its
      // other fields.
      if (hasContactInfo) {
        doc.contacts = [
          {
            name: contactName,
            designation: contactDesignation,
            department: contactDepartment,
            mobile: contactMobile,
            landline: contactLandline,
            email: contactEmail,
            isPrimary: true,
          },
        ];
      }

      // Upsert on Feed Mill Name so re-uploading the same mill updates its
      // record instead of creating a duplicate.
      operations.push({
        updateOne: {
          filter: { feedMillName: doc.feedMillName },
          update: { $set: doc },
          upsert: true,
        },
      });
    });

    if (!operations.length) {
      return res.status(400).json({
        message: "No valid rows found in the uploaded file.",
        errors,
      });
    }

    const result = await FeedMill.bulkWrite(operations, { ordered: false });

    res.json({
      message: "Upload complete.",
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      totalRows: dataRows.length,
      skipped: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /directory/feed-mills/upload-template - generates an .xlsx with the
// exact column headers uploadFeedMills() below expects, plus one real row
// (the most recently created Feed Mill - falling back to a placeholder row
// if the collection is empty), so users have a working reference instead of
// guessing column names. Mirrors the template downloads on the Salesman /
// Target / Sales pages.
const downloadFeedMillsTemplate = async (req, res) => {
  try {
    const sample = await FeedMill.findOne().sort({ createdAt: -1 }).lean();
    const primaryContact =
      (sample?.contacts || []).find((c) => c.isPrimary) ||
      sample?.contacts?.[0];

    // Headers are deliberately worded to match what findColumnIndex() in
    // uploadFeedMills looks for - "Mill Address" contains "mill" + "address"
    // (and is picked over the generic/excluded plain "Address" column),
    // "Mill Phone(s)" contains "mill" + "phone", "Contact Mobile" contains
    // "contact" + "mobile" (and is excluded from the plain "Contact"/"Email"
    // columns), etc. - so a round-trip download -> fill -> upload always
    // parses correctly.
    const headers = [
      "Feed Mill Name",
      "Mill Address",
      "Office Address",
      "Owner's Contact",
      "Mill Phone(s)",
      "Office Phone(s)",
      "Email",
      "Capacity (MT / Hour)",
      "Production (Bags / Month)",
      "Contact Name",
      "Contact Designation",
      "Contact Department",
      "Contact Mobile",
      "Contact Landline",
      "Contact Email",
    ];

    const sampleRow = sample
      ? [
          sample.feedMillName || "",
          sample.millAddress || "",
          sample.officeAddress || "",
          sample.ownerContact || "",
          sample.millPhones || "",
          sample.officePhones || "",
          sample.email || "",
          sample.productionCapacity || "",
          sample.bagsPerMonth || "",
          primaryContact?.name || "",
          primaryContact?.designation || "",
          primaryContact?.department || "",
          primaryContact?.mobile || "",
          primaryContact?.landline || "",
          primaryContact?.email || "",
        ]
      : [
          "Al-Noor Feed Mill",
          "Industrial Area, Multan",
          "Main Bazaar, Multan",
          "0321-7654321",
          "042-1234567",
          "042-7654321",
          "info@alnoorfeed.com",
          "50 MT / hour",
          "5000 bags/month",
          "Muhammad Imran",
          "Regional Sales Manager",
          "Sales",
          "0300-7654321",
          "061-1234567",
          "imran@alnoorfeed.com",
        ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    worksheet["!cols"] = headers.map(() => ({ wch: 22 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Feed Mills");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="feed-mills-upload-template.xlsx"',
    );
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getFeedMills,
  getFilters,
  createFeedMill,
  updateFeedMill,
  deleteFeedMill,
  uploadFeedMills,
  downloadFeedMillsTemplate,
};
