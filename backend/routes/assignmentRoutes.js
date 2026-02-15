const express = require('express');
const router = express.Router();
const uploadAssignment = require('../middleware/uploadAssignment');
const assignmentController = require('../controllers/assignmentController');
const { subscriptionGuard } = require('../middleware/SubscriptionMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), uploadAssignment.single('pdf'), subscriptionGuard, assignmentController.createAssignment);
router.get('/', assignmentController.getAssignments);
router.get('/:id', assignmentController.getAssignment);
router.put('/:id', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), uploadAssignment.single('pdf'), assignmentController.updateAssignment);
router.delete('/:id', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), assignmentController.deleteAssignment);

module.exports = router;
