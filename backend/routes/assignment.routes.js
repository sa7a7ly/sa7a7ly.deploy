const express = require('express');
const fs = require('fs');
const path = require('path');
const Assignment = require('../models/Assignment');
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');

const router = express.Router();

// Create assignment_toggle
router.post(
    '/',
    auth,
    role(['teacher']),
    upload.single('file'), // MUST be "file"
    async(req, res) => {
        try {
            const { title, totalMarks } = req.body;

            if (!title || !totalMarks || !req.file) {
                return res.status(400).json({ message: 'Missing data' });
            }

            // Create assignment first
            const assignment = await Assignment.create({
                teacherId: req.user.id,
                title,
                totalMarks
            });

            // Create model answer directory
            const modelDir = path.join(
                __dirname,
                '..',
                'uploads',
                'assignments',
                assignment._id.toString(),
                'model'
            );

            fs.mkdirSync(modelDir, { recursive: true });

            const finalPath = path.join(modelDir, req.file.filename);
            fs.renameSync(req.file.path, finalPath);

            assignment.modelAnswerPath = finalPath;
            await assignment.save();

            res.status(201).json({ message: 'Assignment created' });
        } catch (err) {
            res.status(500).json({ message: 'Failed to create assignment' });
        }
    }
);

module.exports = router;