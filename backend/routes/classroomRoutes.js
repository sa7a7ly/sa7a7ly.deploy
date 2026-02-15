const express = require('express');
const router = express.Router();
const classroomController = require('../controllers/classroomController');
const { subscriptionGuard } = require('../middleware/SubscriptionMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/join', classroomController.joinClassroom);
router.post('/', requireRole('ADMIN', 'TEACHER'), subscriptionGuard, classroomController.createClassroom);
router.get('/', classroomController.getClassrooms);
router.get('/:id', classroomController.getClassroom);
router.put('/:id', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), classroomController.updateClassroom);
router.delete('/:id', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), classroomController.deleteClassroom);

module.exports = router;
