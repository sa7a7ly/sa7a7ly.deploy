const fs = require("fs");
const User = require("../models/User");
const Classroom = require("../models/Classroom");
const Assignment = require("../models/Assignment");

const ROLE = {
  TEACHER: "TEACHER"
};

const SUBSCRIPTION_STATUS = {
  TRIAL: "TRIAL",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  CANCELED: "CANCELED"
};

function cleanupUploadedFile(req) {
  if (req.file?.path) fs.unlink(req.file.path, () => {});
}

function deny(req, res, message) {
  cleanupUploadedFile(req);
  return res.status(403).json({ message });
}

async function enforceTeacherSubscription(teacher) {
  if (!teacher) return { ok: false, message: "Teacher not found" };

  if (
    [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIAL].includes(
      teacher.subscriptionStatus
    ) &&
    teacher.subscriptionEndDate &&
    new Date() > new Date(teacher.subscriptionEndDate)
  ) {
    teacher.subscriptionStatus = SUBSCRIPTION_STATUS.PAST_DUE;
    await teacher.save();
    return { ok: false, message: "Subscription expired" };
  }

  if (
    teacher.subscriptionStatus === SUBSCRIPTION_STATUS.PAST_DUE ||
    teacher.subscriptionStatus === SUBSCRIPTION_STATUS.CANCELED
  ) {
    return { ok: false, message: "Subscription inactive" };
  }

  return { ok: true };
}

exports.subscriptionGuard = async (req, res, next) => {
  try {
    let teacherId;

    // classroom create: only authenticated teacher should be checked;
    // admins bypass subscription checks
    if (!req.body.classroomId && !req.body.assignmentId) {
      if (req.user?.role === "ADMIN") {
        return next();
      }
      if (req.user?.role === "TEACHER") {
        teacherId = req.user.userId;
      } else {
        return deny(req, res, "Only teachers or admins can create classrooms");
      }
    }

    // assignment create
    else if (req.body.classroomId) {
      const classroom = await Classroom.findById(req.body.classroomId);
      if (!classroom) return deny(req, res, "Classroom not found");
      teacherId = classroom.teacherId;
    }

    // submission create
    else if (req.body.assignmentId) {
      const assignment = await Assignment.findById(req.body.assignmentId);
      if (!assignment) return deny(req, res, "Assignment not found");

      const classroom = await Classroom.findById(assignment.classroomId);
      if (!classroom) return deny(req, res, "Classroom not found");

      teacherId = classroom.teacherId;
    }

    // admin or unrelated routes
    else {
      return next();
    }

    const teacher = await User.findOne({
      _id: teacherId,
      role: ROLE.TEACHER
    });

    const check = await enforceTeacherSubscription(teacher);
    if (!check.ok) return deny(req, res, check.message);

    next();
  } catch (err) {
    cleanupUploadedFile(req);
    return res.status(500).json({ message: err.message });
  }
};
