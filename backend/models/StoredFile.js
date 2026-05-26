const mongoose = require('mongoose');

const storedFileSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['SUBMISSION', 'MODEL_ANSWER'],
      required: true,
      index: true,
    },

    localPath: {
      type: String,
      default: null,
      index: true,
    },
    originalLocalPath: {
      type: String,
      default: null,
    },
    originalName: {
      type: String,
      default: '',
      trim: true,
    },
    mimeType: {
      type: String,
      default: 'application/pdf',
      trim: true,
    },
    sizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },

    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null,
      index: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      default: null,
      index: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    studentName: {
      type: String,
      default: '',
      trim: true,
    },

    status: {
      type: String,
      enum: ['LOCAL', 'UPLOADING', 'CLOUDINARY', 'ERROR'],
      default: 'LOCAL',
      index: true,
    },
    cloudinaryUrl: {
      type: String,
      default: null,
      trim: true,
    },
    cloudinaryPublicId: {
      type: String,
      default: null,
      trim: true,
    },
    movedAt: {
      type: Date,
      default: null,
    },
    localDeletedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'stored_files',
  }
);

storedFileSchema.index({ kind: 1, status: 1 });

module.exports = mongoose.model('StoredFile', storedFileSchema);

