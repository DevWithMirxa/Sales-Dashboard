const Target = require("../models/Target");
const Salesman = require("../models/Salesman");
const Product = require("../models/Product");

/**
 * Create Target
 */
exports.createTarget = async (req, res) => {
  try {
    const { targetName, period, assignedTo, region, products, status } =
      req.body;

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: "Salesman is required.",
      });
    }

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one product.",
      });
    }

    // Check if target already exists for this salesman and period
    const exists = await Target.findOne({
      assignedTo,
      period,
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message:
          "Target already exists for this salesman in the selected period.",
      });
    }

    const totalQuantity = products.reduce(
      (sum, item) => sum + Number(item.targetQuantity || 0),
      0,
    );

    const totalRevenue = products.reduce(
      (sum, item) => sum + Number(item.targetRevenue || 0),
      0,
    );

    const target = await Target.create({
      targetName,
      period,
      assignedTo,
      region,
      products,
      totalQuantity,
      totalRevenue,
      status,
    });

    const populatedTarget = await Target.findById(target._id)
      .populate("assignedTo")
      .populate("region")
      .populate("products.product");

    res.status(201).json({
      success: true,
      message: "Target created successfully.",
      data: populatedTarget,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get All Targets
 */
exports.getAllTargets = async (req, res) => {
  try {
    const targets = await Target.find()
      .populate("assignedTo")
      .populate("region")
      .populate("products.product")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: targets.length,
      data: targets,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Target By Id
 */
exports.getTargetById = async (req, res) => {
  try {
    const target = await Target.findById(req.params.id)
      .populate("assignedTo")
      .populate("region")
      .populate("products.product");

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: target,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update Target
 */
exports.updateTarget = async (req, res) => {
  try {
    const { targetName, period, assignedTo, region, products, status } =
      req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one product.",
      });
    }

    const totalQuantity = products.reduce(
      (sum, item) => sum + Number(item.targetQuantity || 0),
      0,
    );

    const totalRevenue = products.reduce(
      (sum, item) => sum + Number(item.targetRevenue || 0),
      0,
    );

    const target = await Target.findByIdAndUpdate(
      req.params.id,
      {
        targetName,
        period,
        assignedTo,
        region,
        products,
        totalQuantity,
        totalRevenue,
        status,
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("assignedTo")
      .populate("region")
      .populate("products.product");

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Target updated successfully.",
      data: target,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete Target
 */
exports.deleteTarget = async (req, res) => {
  try {
    const target = await Target.findByIdAndDelete(req.params.id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Target deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
