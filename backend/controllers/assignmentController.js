const Assignment = require('../models/Assignment');

// CREATE
exports.createAssignment = async (req, res) => {
  try {
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);

    if (!req.file) {
      return res.status(400).json({ message: 'Model answer PDF required' });
    }

    const assignment = await Assignment.create({
      classroomId: req.body.classroomId,
      title: req.body.title,
      description: req.body.description || '',
      modelAnswerPdfPath: req.file.path,
      modelAnswerText: req.body.modelAnswerText,
      totalPoints: req.body.totalPoints || 100,
      createdBy: req.body.createdBy,
    });

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
