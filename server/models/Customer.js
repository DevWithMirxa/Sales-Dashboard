const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    businessName: { type: String, required: true },
    businessType: { type: String },
    // Only relevant when businessType === 'Farm': Broiler | Layer | Breeder | Miscellaneous
    farmType: { type: String, enum: ['Broiler', 'Layer', 'Breeder', 'Miscellaneous', ''], default: '' },
    city: { type: String },
    region: { type: String },
    headOfficeAddress: { type: String },
    millAddress: { type: String },
    farmAddress: { type: String },
    // New contacts array to support multiple contacts per business
    contacts: [{
        name: { type: String },
        designation: { type: String },
        department: { type: String },
        mobile: { type: String },
        landline: { type: String },
        email: { type: String },
        primary: { type: Boolean, default: false }
    }],
    // legacy single-contact fields are kept for backward compatibility
    personName: { type: String },
    designation: { type: String },
    department: { type: String },
    mobile: { type: String },
    landline: { type: String },
    email: { type: String },
    area: { type: String }, // For the region/area display in the table
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);