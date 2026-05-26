const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function safeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function buildUploadFilename({ prefix, originalName, extension = '.pdf' }) {
  const slug = safeSlug(originalName || 'file');
  const random = crypto.randomBytes(10).toString('hex');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safePrefix = safeSlug(prefix || 'upload');
  return `${safePrefix}-${slug}-${ts}-${random}${extension}`;
}

function toUploadsPath(filename) {
  ensureUploadsDir();
  return path.join(UPLOADS_DIR, filename);
}

module.exports = { UPLOADS_DIR, ensureUploadsDir, buildUploadFilename, toUploadsPath };

