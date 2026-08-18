const express = require("express");
const router = express.Router();
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");

// This app doesn't have a shared "admin-only" middleware yet (only `protect`,
// which just checks the user is logged in). Managing users is sensitive, so
// gate the whole router on role === "admin" here. If you already have (or
// later add) a shared admin middleware, swap this out for that instead.
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Admin access required" });
};

router.use(protect, requireAdmin);

router.route("/").get(getUsers).post(createUser).delete(bulkDeleteUsers);

router.route("/:id").put(updateUser).delete(deleteUser);

module.exports = router;
