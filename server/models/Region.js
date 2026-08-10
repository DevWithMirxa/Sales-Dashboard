const mongoose = require('mongoose');
const regionSchema = new mongoose.Schema({
    region: { type: String, required: true },
    regionManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activeStatus: { type: Boolean, default: true },
    notes: { type: String }
}, { timestamps: true });
module.exports = mongoose.model('Region', regionSchema);