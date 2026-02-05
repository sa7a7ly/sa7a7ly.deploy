const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    joinCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    assistantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    assignments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' }],
  },
  {
    timestamps: true,
    collection: 'classrooms',
  }
);

classroomSchema.index({ teacherId: 1 });

module.exports = mongoose.model('Classroom', classroomSchema);
