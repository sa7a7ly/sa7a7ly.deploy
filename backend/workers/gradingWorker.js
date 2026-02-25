require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const axios = require("axios");
const mongoose = require("mongoose");
const IORedis = require("ioredis");
const { Worker } = require("bullmq");

const connectDB = require("../config/db");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const { cloudinary } = require("../services/cloudinary");
const { getGradingStrategy } = require("../services/grading/getStrategy");
const { gradeWithStrategy } = require("../services/grading/engine");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const PDF_DOWNLOAD_TIMEOUT_MS = 20000;
const PDF_DOWNLOAD_RETRIES = 2;

function parseCloudinaryAsset(urlString) {
  try {
    const url = new URL(urlString);
    const parts = url.pathname.split("/").filter(Boolean);
    const rawIndex = parts.findIndex((p) => p === "raw");
    if (rawIndex === -1) return null;

    const type = parts[rawIndex + 1] || "upload";
    let publicIdParts = parts.slice(rawIndex + 2);
    if (publicIdParts[0] && /^v\d+$/.test(publicIdParts[0])) {
      publicIdParts = publicIdParts.slice(1);
    }
    if (!publicIdParts.length) return null;

    return { type, publicId: publicIdParts.join("/") };
  } catch {
    return null;
  }
}

function getPublicIdCandidates(publicId) {
  if (!publicId) return [];
  const withExt = /\.pdf$/i.test(publicId) ? publicId : `${publicId}.pdf`;
  const withoutExt = publicId.replace(/\.pdf$/i, "");
  return Array.from(new Set([withExt, withoutExt]));
}

async function fetchWithRetry(url, retriesLeft = PDF_DOWNLOAD_RETRIES) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: PDF_DOWNLOAD_TIMEOUT_MS,
    });
    return Buffer.from(response.data);
  } catch (err) {
    const code = err?.code;
    const status = err?.response?.status;
    const isTimeoutOrNetworkError =
      code === "ETIMEDOUT" ||
      code === "ECONNABORTED" ||
      code === "ECONNRESET" ||
      code === "ENOTFOUND" ||
      code === "EAI_AGAIN" ||
      !status;

    if (retriesLeft > 0 && isTimeoutOrNetworkError) {
      return fetchWithRetry(url, retriesLeft - 1);
    }
    throw err;
  }
}

async function getPdfBuffer(source) {
  if (typeof source === "string" && /^https?:\/\//i.test(source)) {
    try {
      return await fetchWithRetry(source);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.code;
      const isTimeoutOrNetworkError =
        code === "ETIMEDOUT" ||
        code === "ECONNABORTED" ||
        code === "ECONNRESET" ||
        code === "ENOTFOUND" ||
        code === "EAI_AGAIN" ||
        !status;

      const shouldUseCloudinarySignedFallback = Boolean(
        source.includes("res.cloudinary.com") &&
          ((status && [401, 403].includes(status)) || isTimeoutOrNetworkError)
      );

      if (shouldUseCloudinarySignedFallback) {
        const cloudinaryAsset = parseCloudinaryAsset(source);
        if (cloudinaryAsset) {
          let lastError = err;
          const candidates = getPublicIdCandidates(cloudinaryAsset.publicId);

          for (const candidate of candidates) {
            try {
              const signedUrl = cloudinary.utils.private_download_url(
                candidate,
                "pdf",
                {
                  resource_type: "raw",
                  type: cloudinaryAsset.type,
                  expires_at: Math.floor(Date.now() / 1000) + 300,
                }
              );
              return await fetchWithRetry(signedUrl);
            } catch (candidateErr) {
              lastError = candidateErr;
            }
          }

          throw lastError;
        }
      }

      throw err;
    }
  }

  if (typeof source === "string") {
    return fs.readFileSync(source);
  }

  throw new Error("Unable to read PDF");
}

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

async function processGradingJob(job) {
  const { submissionId } = job.data || {};
  if (!submissionId) {
    throw new Error("Missing submissionId");
  }

  const submission = await Submission.findById(submissionId);
  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }

  const assignment = await Assignment.findById(submission.assignmentId);
  if (!assignment) {
    throw new Error(`Assignment not found for submission: ${submissionId}`);
  }

  const studentPdf = await getPdfBuffer(submission.pdfPath);
  const modelPdf = await getPdfBuffer(assignment.modelAnswerPdfPath);
  const strategy = getGradingStrategy(assignment);

  const { result, feedbackText } = await gradeWithStrategy({
    strategy,
    assignment,
    studentPdf,
    studentMimeType: "application/pdf",
    modelPdf,
  });

  await Submission.findByIdAndUpdate(submissionId, {
    $set: {
      status: "DONE",
      grade: result.totalGrade,
      feedback: String(feedbackText || "").trim(),
      gradedAt: new Date(),
    },
  });
}

async function startWorker() {
  await connectDB();

  const worker = new Worker(
    "grading",
    async (job) => {
      try {
        await processGradingJob(job);
      } catch (err) {
        const { submissionId } = job.data || {};
        if (submissionId) {
          await Submission.findByIdAndUpdate(submissionId, {
            $set: {
              status: "FAILED",
            },
          }).catch(() => null);
        }
        throw err;
      }
    },
    {
      connection,
    }
  );

  worker.on("completed", (job) => {
    console.log(`Grading job completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Grading job failed: ${job?.id || "unknown"}`, err.message);
  });

  const shutdown = async () => {
    await worker.close();
    await connection.quit();
    await mongoose.connection.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Grading worker listening on queue: grading");
}

startWorker().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
