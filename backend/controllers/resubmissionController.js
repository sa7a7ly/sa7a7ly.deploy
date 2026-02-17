const ResubmissionRequest = require('../models/ResubmissionRequest');
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Classroom = require('../models/Classroom');
const User = require('../models/User');

exports.createResubmissionRequest = async (req, res) => {
  try {
    const { assignmentId, reason } = req.body;
    const studentId = req.user?.userId;

    if (req.user?.role !== 'STUDENT') {
      return res.status(403).json({ message: 'Only students can request resubmission' });
    }

    if (!assignmentId || !studentId) {
      return res.status(400).json({ message: 'Assignment and student are required' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Reason is required' });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const submission = await Submission.findOne({ assignmentId, studentId }).sort({ submittedAt: -1 });
    if (!submission) {
      return res.status(400).json({ message: 'No submission found to resubmit' });
    }

    const existingPending = await ResubmissionRequest.findOne({
      assignmentId,
      studentId,
      status: 'PENDING',
    });
    if (existingPending) {
      return res.status(400).json({ message: 'A resubmission request is already pending' });
    }

    const request = await ResubmissionRequest.create({
      assignmentId,
      classroomId: assignment.classroomId,
      studentId,
      submissionId: submission._id,
      reason: reason.trim(),
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getResubmissionRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let classrooms = [];
    if (user.role === 'ADMIN') {
      classrooms = await Classroom.find({}).select('_id');
    } else if (user.role === 'TEACHER') {
      classrooms = await Classroom.find({ teacherId: userId }).select('_id');
    } else if (user.role === 'ASSISTANT') {
      classrooms = await Classroom.find({ assistantIds: userId }).select('_id');
    } else {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const classroomIds = classrooms.map((c) => c._id);
    const query = { classroomId: { $in: classroomIds } };
    if (status) {
      query.status = status;
    }

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '8', 10), 1);
    const skip = (page - 1) * limit;
    const total = await ResubmissionRequest.countDocuments(query);

    const requests = await ResubmissionRequest.find(query)
      .populate('assignmentId', 'title dueDate')
      .populate('studentId', 'name email')
      .populate('submissionId', 'grade submittedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.set('X-Total-Count', total.toString());
    res.set('X-Page', page.toString());
    res.set('X-Limit', limit.toString());
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateResubmissionRequest = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['APPROVED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const request = await ResubmissionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request already resolved' });
    }

    request.status = status;
    request.decidedBy = req.user?.userId || null;
    request.decidedAt = new Date();
    await request.save();

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
