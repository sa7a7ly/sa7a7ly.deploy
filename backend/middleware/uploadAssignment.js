const multer = require('multer');
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('PDF only'), false);
};

module.exports = multer({ storage, fileFilter });
