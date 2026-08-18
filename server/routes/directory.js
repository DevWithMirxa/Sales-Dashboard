const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  getFeedMills,
  getSalesTeam,
  getFilters,
  createFeedMill,
  updateFeedMill,
  deleteFeedMill,
  createSalesTeam,
  updateSalesTeam,
  deleteSalesTeam,
  uploadFeedMills,
} = require("../controllers/directoryController");

// Keep the file in memory - it's parsed with xlsx and never needs to touch disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const okExt = /\.(xlsx|xls)$/i.test(file.originalname);
    if (!okExt) return cb(new Error("Only .xlsx or .xls files are allowed"));
    cb(null, true);
  },
});

router.get("/feed-mills", getFeedMills);
router.get("/sales-team", getSalesTeam);
router.get("/filters", getFilters);

router.post("/feed-mills", createFeedMill);
router.put("/feed-mills/:id", updateFeedMill);
router.delete("/feed-mills/:id", deleteFeedMill);

// POST /directory/feed-mills/upload - excel file field name must be "file".
// Feed Mills only - Sales Team import is intentionally not supported here.
router.post(
  "/feed-mills/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  uploadFeedMills,
);

router.post("/sales-team", createSalesTeam);
router.put("/sales-team/:id", updateSalesTeam);
router.delete("/sales-team/:id", deleteSalesTeam);

module.exports = router;
