const express = require("express");
const router = express.Router();

const {
  createTarget,
  getAllTargets,
  getTargetById,
  updateTarget,
  deleteTarget,
} = require("../controllers/targetController");

// ===============================
// Target Routes
// ===============================

// Create Target
router.post("/", createTarget);

// Get All Targets
router.get("/", getAllTargets);

// Get Single Target
router.get("/:id", getTargetById);

// Update Target
router.put("/:id", updateTarget);

// Delete Target
router.delete("/:id", deleteTarget);

module.exports = router;