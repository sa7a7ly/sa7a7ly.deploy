const express = require('express');
const { continueWithGoogle } = require('../controllers/userController');

const router = express.Router();

router.post('/google', continueWithGoogle);

module.exports = router;
