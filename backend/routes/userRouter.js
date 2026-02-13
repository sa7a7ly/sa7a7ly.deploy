const express = require('express');
const router = express.Router();

const {
  register,
  registerAssistant,
  createTeacher,
  createAdmin,
  login,
  getUsers,
  getUser,
  getTeacherAssistants
} = require('../controllers/userController');

// Auth
router.post('/register', register);
router.post('/register-assistant', registerAssistant);
router.post('/teachers', createTeacher);
router.post('/admins', createAdmin);
router.post('/login', login);

// Users
router.get('/', getUsers);
router.get('/teachers/:teacherId/assistants', getTeacherAssistants);
router.get('/:id', getUser);

module.exports = router;
