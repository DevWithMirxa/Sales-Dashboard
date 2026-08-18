const express = require("express");
const multer = require("multer");
const router = express.Router();

const {
  createTarget,
  getAllTargets,
  getTargetById,
  updateTarget,
  deleteTarget,
  uploadTargets,
} = require("../controllers/targetController");

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

// ===============================
// Target Routes
// ===============================

// Create Target
router.post("/", createTarget);

// Get All Targets
router.get("/", getAllTargets);

// Upload Targets from Excel - must be declared before "/:id" or Express
// will try to treat "upload" as an :id value.
router.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  uploadTargets,
);

// Get Single Target
router.get("/:id", getTargetById);

// Update Target
router.put("/:id", updateTarget);

// Delete Target
router.delete("/:id", deleteTarget);

module.exports = router;
