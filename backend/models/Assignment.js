const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: String,
    totalMarks: Number,
    modelAnswerPath: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Assignment', AssignmentSchema);