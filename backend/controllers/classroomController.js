const Classroom = require('../models/Classroom');
const User = require('../models/User');

const ROLE = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  ASSISTANT: 'ASSISTANT',
  STUDENT: 'STUDENT',
};

// CREATE classroom (teacher)
exports.createClassroom = async (req, res) => {
  try {
    const teacher = req.body.teacherId
      ? await User.findOne({ _id: req.body.teacherId, role: ROLE.TEACHER })
      : null;
    const admin = req.body.adminId
      ? await User.findOne({ _id: req.body.adminId, role: ROLE.ADMIN })
      : null;

    if (!teacher && !admin) {
      return res.status(403).json({ message: 'Only teachers or admins can create classrooms' });
    }

    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const classroom = await Classroom.create({
      name: req.body.name,
      teacherId: teacher ? teacher._id : admin._id,
      joinCode,
    });

    res.status(201).json(classroom);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

// GET all classrooms
exports.getClassrooms = async (req, res) => {
  try {
    const classrooms = await Classroom.find();
    res.json(classrooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single classroom
exports.getClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate('teacherId', 'name email')
      .populate('assignments');

    if (!classroom) return res.status(404).json({ message: 'Not found' });

    res.json(classroom);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// UPDATE classroom
exports.updateClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!classroom) return res.status(404).json({ message: 'Not found' });

    res.json(classroom);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE classroom
exports.deleteClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findByIdAndDelete(req.params.id);
    if (!classroom) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// JOIN classroom by code (student)
exports.joinClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findOne({ joinCode: req.body.joinCode });

    if (!classroom) return res.status(404).json({ message: 'Invalid code' });

    const user = await User.findById(req.body.userId || req.body.studentId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === ROLE.STUDENT) {
      if (classroom.studentIds.some((id) => id.toString() === user._id.toString())) {
        return res.status(400).json({ message: 'Already joined' });
      }

      classroom.studentIds.push(user._id);
      await classroom.save();
      return res.json({ message: 'Joined successfully' });
    }

    if (user.role === ROLE.ASSISTANT) {
      if (!user.assistantTeacherId) {
        return res.status(403).json({ message: 'Assistant is not linked to a teacher' });
      }

      if (classroom.teacherId.toString() !== user.assistantTeacherId.toString()) {
        return res.status(403).json({ message: 'Assistant can only join classrooms of linked teacher' });
      }

      if (classroom.assistantIds.some((id) => id.toString() === user._id.toString())) {
        return res.status(400).json({ message: 'Already joined' });
      }

      classroom.assistantIds.push(user._id);
      await classroom.save();
      return res.json({ message: 'Joined successfully' });
    }

    return res.status(403).json({ message: 'Only students and assistants can join classrooms' });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
