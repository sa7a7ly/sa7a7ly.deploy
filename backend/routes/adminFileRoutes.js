const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const adminFileController = require('../controllers/adminFileController');

router.use(authenticateToken);
router.use(requireRole('ADMIN'));

router.get('/local', adminFileController.listLocalFiles);
router.post('/move-to-cloudinary', adminFileController.moveToCloudinary);

module.exports = router;

