const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  getTrends,
  getFilters,
  getByProduct,
  getBySalesperson,
  uploadTrends,
} = require("../controllers/trendController");

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

router.get("/", getTrends);
router.get("/filters", getFilters);
router.get("/by-product", getByProduct);
router.get("/by-salesperson", getBySalesperson);

// POST /trends/upload - excel file field name must be "file"
router.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  uploadTrends,
);

module.exports = router;
