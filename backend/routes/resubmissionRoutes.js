const express = require('express');
const router = express.Router();
const resubmissionController = require('../controllers/resubmissionController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.post('/', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), resubmissionController.createResubmissionRequest);
router.get('/', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), resubmissionController.getResubmissionRequests);
router.patch('/:id', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), resubmissionController.updateResubmissionRequest);

module.exports = router;
