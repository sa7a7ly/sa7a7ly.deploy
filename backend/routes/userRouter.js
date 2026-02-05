const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getUsers,
  getUser
} = require('../controllers/userController');

// Auth
router.post('/register', register);
router.post('/login', login);

// Users
router.get('/', getUsers);
router.get('/:id', getUser);

module.exports = router;
