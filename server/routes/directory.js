const express = require("express");
const router = express.Router();
const {
  getFeedMills,
  getSalesTeam,
  getFilters,
} = require("../controllers/directoryController");

router.get("/feed-mills", getFeedMills);
router.get("/sales-team", getSalesTeam);
router.get("/filters", getFilters);

module.exports = router;
