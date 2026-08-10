const mongoose = require('mongoose');

const trendSchema = new mongoose.Schema({
    // Raw month label as it appeared in the source file, e.g. "Jan"
    month: { type: String, required: true },
    // 1-12
    monthNumber: { type: Number, required: true },
    // Full year, e.g. 2024, 2025
    year: { type: Number, required: true, index: true },
    // "YYYY-MM" - convenient for sorting/grouping/chart x-axis, e.g. "2025-01"
    period: { type: String, required: true, index: true },

    salesperson: { type: String, required: true, trim: true, index: true },
    product: { type: String, required: true, trim: true, index: true },

    targetVolumeKg: { type: Number, default: 0 },
    saleVolumeKg: { type: Number, default: 0 },
    targetValueRs: { type: Number, default: 0 },
    saleValueRs: { type: Number, default: 0 },

    productPriceRs: { type: Number, default: null },
    productPackingKg: { type: Number, default: null },

    // bookkeeping - which source file this row came from
    sourceFile: { type: String },
}, { timestamps: true });

// Speeds up the aggregation queries used by the by-product / by-salesperson views
trendSchema.index({ period: 1, salesperson: 1, product: 1 });

module.exports = mongoose.model('Trend', trendSchema);