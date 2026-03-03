const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isRetryableUploadError(error) {
  const status = Number(error?.http_code);
  return !status || status === 408 || status === 409 || status === 429 || status >= 500;
}

async function uploadPdfBuffer(buffer, folder, format = 'pdf', retriesLeft = 2) {
  try {
    return await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'raw',
          format,
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(result);
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    if (retriesLeft > 0 && isRetryableUploadError(error)) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return uploadPdfBuffer(buffer, folder, format, retriesLeft - 1);
    }
    throw error;
  }
}

module.exports = { cloudinary, uploadPdfBuffer };
