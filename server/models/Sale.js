const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    salesman: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesman' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region' },
    actualSales: { type: Number },
    volume: { type: Number }, // MT
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['completed', 'pending', 'cancelled'], default: 'completed' },
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
