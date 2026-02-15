const express = require('express');
const router = express.Router();
const uploadSubmission = require('../middleware/uploadSubmission');
const submissionController = require('../controllers/submissionController');
const { subscriptionGuard } = require('../middleware/SubscriptionMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', uploadSubmission.single('pdf'), subscriptionGuard, submissionController.submitAssignment);
router.get('/', submissionController.getSubmissions);
router.get('/by-student', submissionController.getStudentSubmission);
router.get('/:id', submissionController.getSubmission);

module.exports = router;
