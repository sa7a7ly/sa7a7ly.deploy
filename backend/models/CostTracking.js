const mongoose = require('mongoose');

const CostTrackingSchema = new mongoose.Schema({
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    month: String,
    visionCalls: { type: Number, default: 0 },
    mathpixCalls: { type: Number, default: 0 },
    aiTokens: { type: Number, default: 0 }
});

module.exports = mongoose.model('CostTracking', CostTrackingSchema);