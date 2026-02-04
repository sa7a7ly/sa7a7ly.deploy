const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Register
router.post('/register', async(req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ message: 'Missing fields' });
        }

        if (!['student', 'teacher'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const user = new User({ email, password, role });
        await user.save();

        res.status(201).json({ message: 'User registered' });
    } catch (err) {
        res.status(400).json({ message: 'User already exists' });
    }
});

// Login
router.post('/login', async(req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, role: user.role },
            process.env.JWT_SECRET, { expiresIn: '30m' }
        );

        res.json({ token, role: user.role });
    } catch (err) {
        res.status(500).json({ message: 'Login failed' });
    }
});

module.exports = router;