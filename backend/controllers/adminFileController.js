const fs = require('fs');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const StoredFile = require('../models/StoredFile');
const { uploadPdfBuffer } = require('../services/cloudinary');

function toClientFile(fileDoc, { exists }) {
  return {
    _id: fileDoc._id,
    kind: fileDoc.kind,
    status: fileDoc.status,
    localPath: fileDoc.localPath,
    originalName: fileDoc.originalName,
    mimeType: fileDoc.mimeType,
    sizeBytes: fileDoc.sizeBytes,
    assignmentId: fileDoc.assignmentId,
    submissionId: fileDoc.submissionId,
    studentId: fileDoc.studentId,
    studentName: fileDoc.studentName,
    cloudinaryUrl: fileDoc.cloudinaryUrl,
    movedAt: fileDoc.movedAt,
    localDeletedAt: fileDoc.localDeletedAt,
    lastError: fileDoc.lastError,
    createdAt: fileDoc.createdAt,
    updatedAt: fileDoc.updatedAt,
    exists,
  };
}

exports.listLocalFiles = async (req, res) => {
  try {
    const files = await StoredFile.find({
      localPath: { $ne: null },
      status: { $in: ['LOCAL', 'ERROR'] },
    })
      .sort({ createdAt: -1 })
      .limit(1000);

    const payload = files.map((fileDoc) =>
      toClientFile(fileDoc, { exists: Boolean(fileDoc.localPath && fs.existsSync(fileDoc.localPath)) })
    );

    return res.json({ files: payload });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.moveToCloudinary = async (req, res) => {
  try {
    const fileIds = Array.isArray(req.body?.fileIds) ? req.body.fileIds : [];
    if (!fileIds.length) {
      return res.status(400).json({ message: 'fileIds is required' });
    }

    const results = [];

    for (const fileId of fileIds) {
      const fileDoc = await StoredFile.findById(fileId);
      if (!fileDoc) {
        results.push({ fileId, ok: false, error: 'NOT_FOUND' });
        continue;
      }

      if (!fileDoc.localPath) {
        results.push({ fileId, ok: false, error: 'NO_LOCAL_PATH' });
        continue;
      }

      if (!fs.existsSync(fileDoc.localPath)) {
        await StoredFile.findByIdAndUpdate(fileDoc._id, {
          $set: { status: 'ERROR', lastError: 'Local file not found on disk' },
        }).catch(() => null);
        results.push({ fileId, ok: false, error: 'MISSING_ON_DISK' });
        continue;
      }

      await StoredFile.findByIdAndUpdate(fileDoc._id, {
        $set: { status: 'UPLOADING', lastError: '' },
      }).catch(() => null);

      try {
        const folder = fileDoc.kind === 'MODEL_ANSWER' ? 'sa7a7ly/assignments' : 'sa7a7ly/submissions';
        const buffer = fs.readFileSync(fileDoc.localPath);
        const uploaded = await uploadPdfBuffer(buffer, folder, 'pdf');
        const cloudUrl = uploaded.secure_url;
        const publicId = uploaded.public_id || null;

        if (fileDoc.kind === 'SUBMISSION') {
          if (!fileDoc.submissionId) {
            throw new Error('SUBMISSION_ID_MISSING');
          }
          await Submission.findByIdAndUpdate(fileDoc.submissionId, { $set: { pdfPath: cloudUrl } });
        } else if (fileDoc.kind === 'MODEL_ANSWER') {
          if (!fileDoc.assignmentId) {
            throw new Error('ASSIGNMENT_ID_MISSING');
          }
          await Assignment.findByIdAndUpdate(fileDoc.assignmentId, { $set: { modelAnswerPdfPath: cloudUrl } });
        } else {
          throw new Error('UNKNOWN_KIND');
        }

        let deleted = false;
        try {
          fs.unlinkSync(fileDoc.localPath);
          deleted = true;
        } catch (unlinkErr) {
          deleted = false;
        }

        await StoredFile.findByIdAndUpdate(fileDoc._id, {
          $set: {
            status: deleted ? 'CLOUDINARY' : 'ERROR',
            cloudinaryUrl: cloudUrl,
            cloudinaryPublicId: publicId,
            movedAt: new Date(),
            localDeletedAt: deleted ? new Date() : null,
            originalLocalPath: fileDoc.originalLocalPath || fileDoc.localPath,
            localPath: deleted ? null : fileDoc.localPath,
            lastError: deleted ? '' : 'Uploaded, but failed to delete local file',
          },
        }).catch(() => null);

        results.push({
          fileId,
          ok: deleted,
          uploaded: true,
          deleted,
          cloudinaryUrl: cloudUrl,
          error: deleted ? null : 'DELETE_FAILED',
        });
      } catch (err) {
        await StoredFile.findByIdAndUpdate(fileDoc._id, {
          $set: { status: 'ERROR', lastError: String(err?.message || err) },
        }).catch(() => null);
        results.push({ fileId, ok: false, error: String(err?.message || err) });
      }
    }

    return res.json({ results });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

