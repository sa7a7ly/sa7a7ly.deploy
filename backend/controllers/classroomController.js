const Classroom = require('../models/Classroom');
const User = require('../models/User');

const ROLE = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  ASSISTANT: 'ASSISTANT',
  STUDENT: 'STUDENT',
};

function canAccessClassroomStaffData(classroom, user) {
  const requesterId = user?.userId?.toString();
  const requesterRole = user?.role;

  if (!requesterId || !requesterRole || !classroom) {
    return false;
  }

  if (requesterRole === ROLE.ADMIN) {
    return true;
  }

  if (requesterRole === ROLE.TEACHER) {
    return classroom.teacherId?.toString() === requesterId;
  }

  if (requesterRole === ROLE.ASSISTANT) {
    return (classroom.assistantIds || []).some(
      (assistantId) => assistantId.toString() === requesterId
    );
  }

  return false;
}

// CREATE classroom (teacher)
exports.createClassroom = async (req, res) => {
  try {
    const requesterId = req.user?.userId;
    const requesterRole = req.user?.role;

    if (![ROLE.TEACHER, ROLE.ADMIN].includes(requesterRole)) {
      return res.status(403).json({ message: 'Only teachers or admins can create classrooms' });
    }

    const teacher =
      requesterRole === ROLE.TEACHER
        ? await User.findOne({ _id: requesterId, role: ROLE.TEACHER })
        : null;
    const admin =
      requesterRole === ROLE.ADMIN
        ? await User.findOne({ _id: requesterId, role: ROLE.ADMIN })
        : null;

    if ((requesterRole === ROLE.TEACHER && !teacher) || (requesterRole === ROLE.ADMIN && !admin)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (teacher) {
      if (
        teacher.subscriptionStatus &&
        ['ACTIVE', 'TRIAL'].includes(teacher.subscriptionStatus) &&
        teacher.subscriptionEndDate &&
        new Date() > new Date(teacher.subscriptionEndDate)
      ) {
        return res.status(403).json({ message: 'Subscription expired' });
      }
      if (teacher.subscriptionStatus === 'PAST_DUE' || teacher.subscriptionStatus === 'CANCELED') {
        return res.status(403).json({ message: 'Subscription inactive' });
      }
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
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '8', 10), 1);
    const skip = (page - 1) * limit;
    const total = await Classroom.countDocuments();
    const classrooms = await Classroom.find().skip(skip).limit(limit);
    res.set('X-Total-Count', total.toString());
    res.set('X-Page', page.toString());
    res.set('X-Limit', limit.toString());
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

// GET classroom students
exports.getClassroomStudents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '8', 10), 1);
    const skip = (page - 1) * limit;
    const classroom = await Classroom.findById(req.params.id)
      .populate('studentIds', 'name email role');

    if (!classroom) return res.status(404).json({ message: 'Not found' });
    if (!canAccessClassroomStaffData(classroom, req.user)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const total = (classroom.studentIds || []).length;
    const paged = (classroom.studentIds || []).slice(skip, skip + limit);
    res.set('X-Total-Count', total.toString());
    res.set('X-Page', page.toString());
    res.set('X-Limit', limit.toString());
    res.json(paged);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// REMOVE student from classroom
exports.removeStudentFromClassroom = async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const classroom = await Classroom.findById(id);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (!canAccessClassroomStaffData(classroom, req.user)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const student = await User.findById(studentId).select('role');
    if (!student || student.role !== ROLE.STUDENT) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const isEnrolled = (classroom.studentIds || []).some(
      (idValue) => idValue.toString() === studentId.toString()
    );

    if (!isEnrolled) {
      return res.status(404).json({ message: 'Student is not in this classroom' });
    }

    classroom.studentIds = (classroom.studentIds || []).filter(
      (idValue) => idValue.toString() !== studentId.toString()
    );

    await classroom.save();

    return res.json({ message: 'Student removed from classroom successfully' });
  } catch (err) {
    return res.status(400).json({ message: err.message });
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

    const user = await User.findById(req.user?.userId);
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
