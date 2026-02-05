const express = require('express');
const router = express.Router();
const classroomController = require('../controllers/classroomController');

router.post('/join', classroomController.joinClassroom);
router.post('/', classroomController.createClassroom);
router.get('/', classroomController.getClassrooms);
router.get('/:id', classroomController.getClassroom);
router.put('/:id', classroomController.updateClassroom);
router.delete('/:id', classroomController.deleteClassroom);

module.exports = router;
