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
  refreshTokenHandler,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  getUsers,
  getUser,
  updateTeacherSubscription,
  getTeacherAssistants,
  getTeacherAssistantCode,
  removeTeacherAssistant
} = require('../controllers/userController');

// Auth
router.post('/register', register);
router.post('/signup', register);
router.post('/register-assistant', registerAssistant);
router.post('/login', login);
router.post('/refresh-token', refreshTokenHandler);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.get('/me', authenticateToken, getMe);

router.use(authenticateToken);

router.post('/teachers', requireRole('ADMIN'), createTeacher);
router.post('/admins', requireRole('ADMIN'), createAdmin);

// Users
router.get('/', requireRole('ADMIN'), getUsers);
router.get('/teachers/:teacherId/assistants', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), getTeacherAssistants);
router.get('/teachers/:teacherId/assistant-code', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), getTeacherAssistantCode);
router.delete('/teachers/:teacherId/assistants/:assistantId', requireRole('ADMIN', 'TEACHER'), removeTeacherAssistant);
router.patch('/teachers/:id/subscription', requireRole('ADMIN'), updateTeacherSubscription);
router.get('/:id', requireRole('ADMIN', 'TEACHER', 'ASSISTANT'), getUser);

module.exports = router;
