const Classroom = require('../models/Classroom');

// CREATE classroom (teacher)
exports.createClassroom = async (req, res) => {
  try {
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const classroom = await Classroom.create({
      name: req.body.name,
      teacherId: req.body.teacherId,
      joinCode
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

    if (classroom.studentIds.includes(req.body.studentId))
      return res.status(400).json({ message: 'Already joined' });

    classroom.studentIds.push(req.body.studentId);
    await classroom.save();

    res.json({ message: 'Joined successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
