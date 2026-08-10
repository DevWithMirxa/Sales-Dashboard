const express = require("express");
const router = express.Router();
const {
  getDashboardSummary,
  getRegionSales,
  getTopProducts,
  getRegionProductComparison,
} = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/auth");

// Dashboard is only for admins
router.use(protect);
router.use(authorize("admin"));

router.get("/summary", getDashboardSummary);
router.get("/region-sales", getRegionSales);
router.get("/top-products", getTopProducts);
router.get("/region-product-comparison", getRegionProductComparison);

module.exports = router;
