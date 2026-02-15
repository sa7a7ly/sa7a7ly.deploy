const express = require('express');
const router = express.Router();
const resubmissionController = require('../controllers/resubmissionController');

router.post('/', resubmissionController.createResubmissionRequest);
router.get('/', resubmissionController.getResubmissionRequests);
router.patch('/:id', resubmissionController.updateResubmissionRequest);

module.exports = router;
