const User = require("../models/User");

// GET /api/users
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/users  (admin creates a user directly - different from self-registration)
const createUser = async (req, res) => {
  try {
    const { name, email, username, password, role, status } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const existing = await User.findOne({
      $or: [{ email }, ...(username ? [{ username }] : [])],
    });
    if (existing) {
      return res.status(400).json({
        message:
          existing.email === email
            ? "A user with this email already exists"
            : "This username is already taken",
      });
    }

    const user = await User.create({
      name,
      email,
      username: username || undefined,
      password,
      role: role || "user",
      status: status || "active",
    });

    const { password: _pw, ...userData } = user.toObject();
    res.status(201).json(userData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    const { name, email, username, password, role, status } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (username !== undefined) user.username = username;
    if (role !== undefined) user.role = role;
    if (status !== undefined) user.status = status;
    // Only touch the password field if the admin actually typed a new one -
    // this is what makes leaving it blank on the edit form safe.
    if (password) user.password = password;

    const updated = await user.save();
    const { password: _pw, ...userData } = updated.toObject();
    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    if (req.user && String(req.user._id) === String(req.params.id)) {
      return res
        .status(400)
        .json({ message: "You can't delete your own account" });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/users  (body: { ids: [...] })  -  bulk delete for the
// "Delete Selected" action in the Users table.
const bulkDeleteUsers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No user ids provided" });
    }

    // Never let an admin accidentally delete their own account this way.
    const idsToDelete = req.user
      ? ids.filter((id) => String(id) !== String(req.user._id))
      : ids;

    if (idsToDelete.length === 0) {
      return res
        .status(400)
        .json({ message: "You can't delete your own account" });
    }

    const result = await User.deleteMany({ _id: { $in: idsToDelete } });
    res.json({
      message: "Users deleted",
      deletedCount: result.deletedCount,
      skippedSelf: idsToDelete.length !== ids.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
};
