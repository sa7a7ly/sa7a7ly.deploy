const multer = require('multer');
const path = require('path');
const { ensureUploadsDir, buildUploadFilename, UPLOADS_DIR } = require('../services/localUploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureUploadsDir();
      cb(null, UPLOADS_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    const classroomPart = req.body?.classroomId ? `classroom-${req.body.classroomId}` : 'classroom';
    const creatorPart = req.user?.userId ? `creator-${req.user.userId}` : 'creator';
    cb(
      null,
      buildUploadFilename({
        prefix: `model-answer-${classroomPart}-${creatorPart}`,
        originalName: file.originalname,
        extension: extension === '.pdf' ? '.pdf' : '.pdf',
      })
    );
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('PDF only'), false);
};

module.exports = multer({ storage, fileFilter });
