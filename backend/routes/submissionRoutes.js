const express = require('express');
const router = express.Router();
const uploadSubmission = require('../middleware/uploadSubmission');
const submissionController = require('../controllers/submissionController');
const { subscriptionGuard } = require('../middleware/SubscriptionMiddleware');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.post(
  '/',
  requireRole('STUDENT'),
  uploadSubmission.single('pdf'),
  subscriptionGuard,
  submissionController.submitAssignment
);
router.post(
  '/on-behalf',
  requireRole('ADMIN', 'TEACHER', 'ASSISTANT'),
  uploadSubmission.single('pdf'),
  subscriptionGuard,
  submissionController.submitAssignmentOnBehalf
);
router.post('/mark-reviewed', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), submissionController.markSubmissionsReviewed);
router.get('/', submissionController.getSubmissions);
router.get('/by-student', submissionController.getStudentSubmission);
router.get('/:id/pdf', submissionController.getSubmissionPdf);
router.post('/:id/resubmit', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), submissionController.resubmitSubmission);
router.patch('/:id', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), submissionController.updateSubmissionReview);
router.delete('/:id', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), submissionController.deleteSubmission);
router.get('/:id', submissionController.getSubmission);

module.exports = router;
