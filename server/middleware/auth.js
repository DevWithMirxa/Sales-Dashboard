const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  // Check the Authorization header first. This is what our frontend now
  // uses reliably (see lib/api.js), since frontend (Vercel) and backend
  // (Railway) are on different domains and cookies aren't guaranteed to
  // travel across them. Falling back to the cookie only if no header is
  // present avoids a stale/unexpected cookie silently overriding the
  // correct token.
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  // Bypass for frontend demo-token
  if (token === "demo-token") {
    req.user = {
      _id: "60c72b2f9b1d8e001c888888", // mock valid MongoDB ObjectId for demo admin
      name: "Demo Admin",
      email: "admin@saleshub.com",
      role: "admin",
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({
          message: `Role ${req.user ? req.user.role : "Unknown"} is not authorized to access this route`,
        });
    }
    next();
  };
};

module.exports = { protect, authorize };
