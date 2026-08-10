const Salesman = require("../models/Salesman");
const SalesTeam = require("../models/SalesTeam");

const createSalesman = async (req, res) => {
  try {
    const salesman = new Salesman({
      ...req.body,
      createdBy: req.user ? req.user._id : undefined,
    });
    const savedSalesman = await salesman.save();
    res.status(201).json(savedSalesman);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSalesmen = async (req, res) => {
  try {
    const salesmen = await Salesman.find().sort({ createdAt: -1 });
    res.json(salesmen);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSalesman = async (req, res) => {
  try {
    const updatedSalesman = await Salesman.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    res.json(updatedSalesman);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSalesman = async (req, res) => {
  try {
    await Salesman.findByIdAndDelete(req.params.id);
    res.json({ message: "Salesman deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSalesman,
  getSalesmen,
  updateSalesman,
  deleteSalesman,
};
