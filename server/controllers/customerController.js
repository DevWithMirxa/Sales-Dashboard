const Customer = require("../models/Customer");
const FeedMill = require("../models/FeedMill");
const SalesTeam = require("../models/SalesTeam");
const normalizeContact = (contact = {}) => ({
  name: contact.name?.toString()?.trim() || "",
  designation: contact.designation?.toString()?.trim() || "",
  department: contact.department?.toString()?.trim() || "",
  mobile: contact.mobile?.toString()?.trim() || "",
  landline: contact.landline?.toString()?.trim() || "",
  email: contact.email?.toString()?.trim() || "",
  primary: !!contact.primary,
});
const normalizeContacts = (contacts) => {
  if (!Array.isArray(contacts)) return [];
  const normalized = contacts.map(normalizeContact);
  if (!normalized.some((c) => c.primary) && normalized.length > 0) {
    normalized[0].primary = true;
  }
  return normalized;
};
const createCustomer = async (req, res) => {
  try {
    const body = { ...req.body };
    body.contacts = normalizeContacts(body.contacts);
    if (
      !body.contacts.length &&
      (body.personName || body.mobile || body.email)
    ) {
      body.contacts = [
        normalizeContact({
          name: body.personName,
          designation: body.designation,
          department: body.department,
          mobile: body.mobile,
          landline: body.landline,
          email: body.email,
          primary: true,
        }),
      ];
    }
    const customer = new Customer({
      ...body,
      createdBy: req.user ? req.user._id : undefined,
    });
    const savedCustomer = await customer.save();
    res.status(201).json(savedCustomer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const updateCustomer = async (req, res) => {
  try {
    const body = { ...req.body };
    body.contacts = normalizeContacts(body.contacts);
    if (
      !body.contacts.length &&
      (body.personName || body.mobile || body.email)
    ) {
      body.contacts = [
        normalizeContact({
          name: body.personName,
          designation: body.designation,
          department: body.department,
          mobile: body.mobile,
          landline: body.landline,
          email: body.email,
          primary: true,
        }),
      ];
    }
    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: true },
    );
    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: "Customer deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = {
  createCustomer,
  getCustomers,
  updateCustomer,
  deleteCustomer,
};