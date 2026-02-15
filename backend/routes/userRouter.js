const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const {
  register,
  registerAssistant,
  createTeacher,
  createAdmin,
  login,
  getUsers,
  getUser,
  updateTeacherSubscription,
  getTeacherAssistants,
  getTeacherAssistantCode
} = require('../controllers/userController');

// Auth
router.post('/register', register);
router.post('/register-assistant', registerAssistant);
router.post('/login', login);

router.use(authenticateToken);

router.post('/teachers', requireRole('ADMIN'), createTeacher);
router.post('/admins', requireRole('ADMIN'), createAdmin);

// Users
router.get('/', requireRole('ADMIN'), getUsers);
router.get('/teachers/:teacherId/assistants', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), getTeacherAssistants);
router.get('/teachers/:teacherId/assistant-code', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), getTeacherAssistantCode);
router.patch('/teachers/:id/subscription', requireRole('ADMIN'), updateTeacherSubscription);
router.get('/:id', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), getUser);

module.exports = router;
