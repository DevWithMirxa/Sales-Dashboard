const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    // New: shown as its own column in User Management, separate from email.
    username: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // lets existing users with no username coexist without a uniqueness clash
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "user", "customer", "salesman"],
      default: "user",
    },
    status: {
      // Expanded from ['active','inactive'] to support the admin actions
      // a "manage users" screen needs (ban/suspend/pending approval).
      type: String,
      enum: ["active", "inactive", "pending", "suspended", "banned"],
      default: "active",
    },
    // New: updated on each successful login so "Last Active" can be shown.
    lastActiveAt: {
      type: Date,
    },
    // Forgot-password flow: a SHA-256 hash of the raw token emailed to the
    // user (never store the raw token itself - same principle as storing
    // hashed passwords). select: false keeps it out of normal queries
    // (e.g. getUserProfile) so it never accidentally leaks to the client;
    // the auth controller queries against it directly by field name, which
    // still works fine even with select: false.
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true },
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    // Early return, no hashing. (Previously this fell through and
    // re-hashed the already-hashed password on every save that didn't
    // touch it - e.g. an admin editing someone's name - silently
    // corrupting it and locking that user out on their next login.)
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // No next() call: this Mongoose version treats an `async` hook as
  // done when its Promise resolves, and doesn't pass a real `next`
  // into it - calling next() here throws "next is not a function".
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;
