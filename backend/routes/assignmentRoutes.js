const express = require('express');
const router = express.Router();
const uploadAssignment = require('../middleware/uploadAssignment');
const assignmentController = require('../controllers/assignmentController');

router.post('/', uploadAssignment.single('pdf'), assignmentController.createAssignment);
router.get('/', assignmentController.getAssignments);
router.get('/:id', assignmentController.getAssignment);
router.put('/:id', uploadAssignment.single('pdf'), assignmentController.updateAssignment);
router.delete('/:id', assignmentController.deleteAssignment);

module.exports = router;
