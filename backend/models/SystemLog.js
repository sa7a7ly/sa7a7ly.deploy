const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema({
    level: String,
    message: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SystemLog', SystemLogSchema);