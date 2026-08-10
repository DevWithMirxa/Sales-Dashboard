const mongoose = require('mongoose');

const salesmanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String },
    designation: { type: String },
    area: { type: String },
    productTarget: {
        Rs: { type: Number },
        MT: { type: Number },
        period: { type: String }
    },
    productSale: {
        Rs: { type: Number },
        MT: { type: Number },
        period: { type: String }
    },
    percentageSale: {
        value: { type: Number },
        period: { type: String }
    },
    recovery: {
        customer: { type: Number },
        amount: { type: Number }
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Salesman', salesmanSchema);
