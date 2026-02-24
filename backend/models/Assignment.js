const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: [true, 'Classroom ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    modelAnswerPdfPath: {
      type: String,
      required: [true, 'Model answer PDF path is required'],
    },
    modelAnswerText: {
      type: String,
      default: '',
    },
    totalPoints: {
      type: Number,
      default: 100,
      min: 0,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    resultVisibility: {
      type: String,
      enum: ['IMMEDIATE', 'AFTER_DEADLINE', 'AFTER_REVIEW'],
      default: 'IMMEDIATE',
    },
    gradingProfile: {
      type: String,
      enum: ['GENERAL', 'ARABIC_ESSAY'],
      default: 'GENERAL',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection: 'assignments',
  }
);

assignmentSchema.index({ classroomId: 1 });
assignmentSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
