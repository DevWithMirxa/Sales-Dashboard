const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  uploadProducts,
  downloadProductsTemplate,
} = require("../controllers/productController");

// const { protect } = require('../middleware/authMiddleware');

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

router.route("/").get(getProducts).post(createProduct);

// GET /products/upload-template - must come before "/:id" or Express will
// try to treat "upload-template" as an :id value.
router.get("/upload-template", downloadProductsTemplate);

router.route("/:id").put(updateProduct).delete(deleteProduct);

// POST /products/upload - excel file field name must be "file"
router.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  uploadProducts,
);

module.exports = router;
