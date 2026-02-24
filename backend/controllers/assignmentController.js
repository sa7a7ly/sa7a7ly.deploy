const Assignment = require('../models/Assignment');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { uploadPdfBuffer } = require('../services/cloudinary');

const ROLE = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  ASSISTANT: 'ASSISTANT',
};
const RESULT_VISIBILITY = {
  IMMEDIATE: 'IMMEDIATE',
  AFTER_DEADLINE: 'AFTER_DEADLINE',
  AFTER_REVIEW: 'AFTER_REVIEW',
};
const GRADING_PROFILE = {
  GENERAL: 'GENERAL',
  ARABIC_ESSAY: 'ARABIC_ESSAY',
};

function normalizeResultVisibility(value) {
  if (!value) return RESULT_VISIBILITY.IMMEDIATE;
  const normalized = String(value).trim().toUpperCase();
  if (
    normalized === RESULT_VISIBILITY.IMMEDIATE ||
    normalized === RESULT_VISIBILITY.AFTER_DEADLINE ||
    normalized === RESULT_VISIBILITY.AFTER_REVIEW
  ) {
    return normalized;
  }
  return null;
}

function normalizeGradingProfile(value) {
  if (!value) return GRADING_PROFILE.GENERAL;
  const normalized = String(value).trim().toUpperCase();
  if (normalized === GRADING_PROFILE.GENERAL) return GRADING_PROFILE.GENERAL;
  if (normalized === GRADING_PROFILE.ARABIC_ESSAY || normalized === 'ARABIC') {
    return GRADING_PROFILE.ARABIC_ESSAY;
  }
  return null;
}

// CREATE
exports.createAssignment = async (req, res) => {
  try {
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);

    if (!req.file) {
      return res.status(400).json({ message: 'Model answer PDF required' });
    }

    if (!req.file.buffer) {
      return res.status(400).json({ message: 'Invalid PDF upload' });
    }

    const classroom = await Classroom.findById(req.body.classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const creator = await User.findById(req.user?.userId);
    if (!creator) {
      return res.status(404).json({ message: 'Creator not found' });
    }

    const isAdmin = creator.role === ROLE.ADMIN;
    const isTeacherOfClassroom =
      creator.role === ROLE.TEACHER &&
      classroom.teacherId.toString() === creator._id.toString();
    const isAssistantInClassroom =
      creator.role === ROLE.ASSISTANT &&
      classroom.assistantIds.some((id) => id.toString() === creator._id.toString());

    if (isTeacherOfClassroom) {
      if (
        creator.subscriptionStatus &&
        ['ACTIVE', 'TRIAL'].includes(creator.subscriptionStatus) &&
        creator.subscriptionEndDate &&
        new Date() > new Date(creator.subscriptionEndDate)
      ) {
        return res.status(403).json({ message: 'Subscription expired' });
      }
      if (creator.subscriptionStatus === 'PAST_DUE' || creator.subscriptionStatus === 'CANCELED') {
        return res.status(403).json({ message: 'Subscription inactive' });
      }
    }

    if (!isAdmin && !isTeacherOfClassroom && !isAssistantInClassroom) {
      return res.status(403).json({ message: 'Not allowed to create assignment in this classroom' });
    }

    const uploadedModelAnswer = await uploadPdfBuffer(
      req.file.buffer,
      'sa7a7ly/assignments'
    );

    const dueDateValue = req.body.dueDate ? new Date(req.body.dueDate) : null;
    const normalizedDueDate =
      dueDateValue && !Number.isNaN(dueDateValue.getTime()) ? dueDateValue : null;
    const resultVisibility = normalizeResultVisibility(req.body.resultVisibility);
    if (!resultVisibility) {
      return res.status(400).json({ message: 'Invalid result visibility option' });
    }
    if (resultVisibility === RESULT_VISIBILITY.AFTER_DEADLINE && !normalizedDueDate) {
      return res.status(400).json({
        message: 'A valid due date is required when result visibility is set to after deadline',
      });
    }
    const gradingProfile = normalizeGradingProfile(req.body.gradingProfile);
    if (!gradingProfile) {
      return res.status(400).json({ message: 'Invalid grading profile' });
    }

    const assignment = await Assignment.create({
      classroomId: req.body.classroomId,
      title: req.body.title,
      description: req.body.description || '',
      modelAnswerPdfPath: uploadedModelAnswer.secure_url,
      modelAnswerText: req.body.modelAnswerText,
      totalPoints: req.body.totalPoints || 100,
      dueDate: normalizedDueDate,
      resultVisibility,
      gradingProfile,
      createdBy: creator._id,
    });

    classroom.assignments.push(assignment._id);
    await classroom.save();

    res.status(201).json(assignment);
  } catch (err) {
    console.error('ASSIGNMENT ERROR:', err);
    res.status(400).json({ message: err.message });
  }
};

// GET all
exports.getAssignments = async (req, res) => {
  try {
    const { classroomId } = req.query;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '8', 10), 1);
    const skip = (page - 1) * limit;
    
    let query = {};
    if (classroomId) {
      query.classroomId = classroomId;
    }

    const total = await Assignment.countDocuments(query);
    const assignments = await Assignment.find(query).skip(skip).limit(limit);
    res.set('X-Total-Count', total.toString());
    res.set('X-Page', page.toString());
    res.set('X-Limit', limit.toString());
    res.set('x-server-time', Date.now().toString());
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET one
exports.getAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Not found' });
    res.set('x-server-time', Date.now().toString());
    res.json(assignment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// UPDATE
exports.updateAssignment = async (req, res) => {
  try {
    const existingAssignment = await Assignment.findById(req.params.id);
    if (!existingAssignment) return res.status(404).json({ message: 'Not found' });

    const hasDueDateInput = Object.prototype.hasOwnProperty.call(req.body, 'dueDate');
    const nextDueDate = hasDueDateInput ? new Date(req.body.dueDate) : existingAssignment.dueDate;
    const normalizedNextDueDate =
      nextDueDate && !Number.isNaN(new Date(nextDueDate).getTime()) ? new Date(nextDueDate) : null;

    const hasVisibilityInput = Object.prototype.hasOwnProperty.call(req.body, 'resultVisibility');
    const nextVisibility = hasVisibilityInput
      ? normalizeResultVisibility(req.body.resultVisibility)
      : existingAssignment.resultVisibility || RESULT_VISIBILITY.IMMEDIATE;

    if (!nextVisibility) {
      return res.status(400).json({ message: 'Invalid result visibility option' });
    }
    if (nextVisibility === RESULT_VISIBILITY.AFTER_DEADLINE && !normalizedNextDueDate) {
      return res.status(400).json({
        message: 'A valid due date is required when result visibility is set to after deadline',
      });
    }
    const hasProfileInput = Object.prototype.hasOwnProperty.call(req.body, 'gradingProfile');
    const nextGradingProfile = hasProfileInput
      ? normalizeGradingProfile(req.body.gradingProfile)
      : existingAssignment.gradingProfile || GRADING_PROFILE.GENERAL;
    if (!nextGradingProfile) {
      return res.status(400).json({ message: 'Invalid grading profile' });
    }

    const updatePayload = {
      ...req.body,
      resultVisibility: nextVisibility,
      gradingProfile: nextGradingProfile,
    };
    if (hasDueDateInput) {
      updatePayload.dueDate = normalizedNextDueDate;
    }

    const assignment = await Assignment.findByIdAndUpdate(req.params.id, updatePayload, { new: true });

    res.json(assignment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE
exports.deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
