const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    filePath: String,

    aiGrade: Number,
    aiConfidence: Number,
    aiFeedback: String,

    finalGrade: Number,
    status: {
        type: String,
        enum: ['uploaded', 'ai_pending', 'ai_completed', 'teacher_reviewed'],
        default: 'uploaded'
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Submission', SubmissionSchema);