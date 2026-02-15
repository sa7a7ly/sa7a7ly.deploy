const Assignment = require('../models/Assignment');
const Classroom = require('../models/Classroom');
const User = require('../models/User');

const ROLE = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  ASSISTANT: 'ASSISTANT',
};

// CREATE
exports.createAssignment = async (req, res) => {
  try {
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);

    if (!req.file) {
      return res.status(400).json({ message: 'Model answer PDF required' });
    }

    const classroom = await Classroom.findById(req.body.classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const creator = await User.findById(req.body.createdBy);
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

    const dueDateValue = req.body.dueDate ? new Date(req.body.dueDate) : null;
    const assignment = await Assignment.create({
      classroomId: req.body.classroomId,
      title: req.body.title,
      description: req.body.description || '',
      modelAnswerPdfPath: req.file.path,
      modelAnswerText: req.body.modelAnswerText,
      totalPoints: req.body.totalPoints || 100,
      dueDate: dueDateValue && !Number.isNaN(dueDateValue.getTime()) ? dueDateValue : null,
      createdBy: req.body.createdBy,
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
    
    let query = {};
    if (classroomId) {
      query.classroomId = classroomId;
    }

    const assignments = await Assignment.find(query);
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
    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!assignment) return res.status(404).json({ message: 'Not found' });

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
