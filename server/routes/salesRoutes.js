const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  createSale,
  getSales,
  updateSale,
  deleteSale,
  getSaleFormOptions,
  uploadSales,
} = require("../controllers/salesController");

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

// Must be declared before "/:id" or Express will try to treat
// "form-options" / "upload" as an :id value.
router.get("/form-options", getSaleFormOptions);

router.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  uploadSales,
);

router.route("/").get(getSales).post(createSale);

router.route("/:id").put(updateSale).delete(deleteSale);

module.exports = router;
