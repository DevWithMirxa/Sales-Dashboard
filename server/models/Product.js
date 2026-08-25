const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    pricePerKg: { type: Number },
    packingKg: { type: Number },
    origin: { type: String, trim: true, default: null },
    supplier: { type: String, trim: true, default: null },
    description: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
