const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../utils/sendEmail");

const generateToken = (id) => {
  const secret = process.env.JWT_SECRET || "defaultsecret";
  return jwt.sign({ id }, secret, {
    expiresIn: "30d",
  });
};
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    const user = await User.create({
      name,
      email,
      password,
      role: role || "user",
    });
    if (user) {
      const token = generateToken(user._id);
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token, // also returned in the body so the frontend can store
        // it client-side (needed since frontend and backend
        // are on different domains, and our middleware/API
        // interceptor rely on a client-readable token)
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      // Stamp last-active time for the User Management screen.
      // Safe with the pre-save hook fix in User.js: since `password`
      // isn't modified here, the hook now correctly skips re-hashing.
      user.lastActiveAt = new Date();
      await user.save();

      const token = generateToken(user._id);

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const logoutUser = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.json({ message: "Logged out successfully" });
};
const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: "User not found" });
  }
};

// How long a reset link stays valid after being requested.
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// POST /auth/forgot-password
// Always responds with the same generic message whether or not the email
// belongs to a real account - this is deliberate, not an oversight: it
// stops this endpoint being used to enumerate which emails are registered.
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user) {
      // Store only a HASH of the token (same principle as password
      // hashing) - the raw token only ever exists in the emailed link, so
      // a database leak alone can't be used to reset anyone's password.
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = Date.now() + RESET_TOKEN_EXPIRY_MS;
      await user.save({ validateBeforeSave: false });

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const resetUrl = `${frontendUrl}/reset-password/${rawToken}`;

      // Dev convenience: logging the link here means you can test the
      // full reset flow from the server console without needing an inbox
      // handy for every test account.
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Password reset link for ${user.email}:`);
        console.log(resetUrl);
      }

      try {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        });
      } catch (emailError) {
        // Log server-side only - the response to the client stays generic
        // either way, so this failure doesn't leak whether the account
        // exists (and doesn't block the request from "succeeding").
        console.error("Failed to send password reset email:", emailError);
      }
    }

    res.json({
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /auth/reset-password/:token
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message:
          "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    user.password = password; // pre-save hook hashes this automatically
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful. You can now sign in." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  forgotPassword,
  resetPassword,
};
