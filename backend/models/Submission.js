const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    studentName: {
      type: String,
      default: '',
      trim: true,
    },

    pdfPath: {
      type: String,
      required: true,
    },

    extractedText: {
      type: String,
      default: '',
    },

    grade: {
      type: Number,
      default: null,
    },

    feedback: {
      type: String,
      default: '',
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    submittedByRole: {
      type: String,
      enum: ['STUDENT', 'TEACHER', 'ASSISTANT'],
      default: 'STUDENT',
    },

    gradedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'submittedAt', updatedAt: false },
    collection: 'submissions',
  }
);

submissionSchema.index({ assignmentId: 1 });
submissionSchema.index({ studentId: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
