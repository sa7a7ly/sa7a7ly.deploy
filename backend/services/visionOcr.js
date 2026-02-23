const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vision = require("@google-cloud/vision");
const { Storage } = require("@google-cloud/storage");

function resolveCredentialsPath() {
    const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fromEnv && fs.existsSync(fromEnv)) {
        return fromEnv;
    }

    const candidates = [
        path.resolve(__dirname, "..", "google-vision-key.json"),
        path.resolve(__dirname, "..", "gen-lang-client-0092369347-8f78e2f76aca.json"),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return "";
}

const credentialsPath = resolveCredentialsPath();
const googleClientOptions = credentialsPath ? { keyFilename: credentialsPath } : {};
const visionClient = new vision.ImageAnnotatorClient(googleClientOptions);
const storage = new Storage(googleClientOptions);

function getOcrBucketName() {
    return process.env.GCP_OCR_BUCKET || process.env.VISION_OCR_BUCKET || "";
}

async function bestEffortDeleteFile(fileRef) {
    try {
        await fileRef.delete();
    } catch (err) {
        // ignore cleanup failures
    }
}

async function extractTextFromPdfBuffer(pdfBuffer, options = {}) {
    if (!Buffer.isBuffer(pdfBuffer) || !pdfBuffer.length) {
        throw new Error("Invalid PDF buffer for OCR");
    }

    const bucketName = getOcrBucketName();
    if (!bucketName) {
        throw new Error("GCP_OCR_BUCKET is required for Vision PDF OCR");
    }

    const sourceLabel = options.sourceLabel || "document";
    const runId = `${Date.now()}-${sourceLabel.replace(/\s+/g, "-")}-${crypto
        .randomBytes(6)
        .toString("hex")}`;
    const inputObject = `vision-ocr/input/${runId}.pdf`;
    const outputPrefix = `vision-ocr/output/${runId}/`;
    const bucket = storage.bucket(bucketName);
    const inputFile = bucket.file(inputObject);

    await inputFile.save(pdfBuffer, {
        contentType: "application/pdf",
        resumable: false,
    });

    try {
        const inputUri = `gs://${bucketName}/${inputObject}`;
        const outputUri = `gs://${bucketName}/${outputPrefix}`;

        const [operation] = await visionClient.asyncBatchAnnotateFiles({
            requests: [
                {
                    inputConfig: {
                        mimeType: "application/pdf",
                        gcsSource: { uri: inputUri },
                    },
                    features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
                    outputConfig: {
                        gcsDestination: { uri: outputUri },
                        batchSize: 5,
                    },
                },
            ],
        });

        await operation.promise();

        const [outputFiles] = await bucket.getFiles({ prefix: outputPrefix });
        const jsonOutputFiles = outputFiles
            .filter((file) => file.name.toLowerCase().endsWith(".json"))
            .sort((a, b) => a.name.localeCompare(b.name));

        let extractedText = "";
        for (const outputFile of jsonOutputFiles) {
            const [contents] = await outputFile.download();
            const payload = JSON.parse(contents.toString("utf8"));
            const responses = payload.responses || [];
            for (const response of responses) {
                const text = response?.fullTextAnnotation?.text || "";
                if (text) {
                    extractedText += `${text}\n`;
                }
            }
        }

        return extractedText.trim();
    } finally {
        const [cleanupFiles] = await bucket.getFiles({ prefix: outputPrefix });
        await Promise.all(cleanupFiles.map((file) => bestEffortDeleteFile(file)));
        await bestEffortDeleteFile(inputFile);
    }
}

async function checkVisionOcrHealth() {
    const bucketName = getOcrBucketName();
    if (!bucketName) {
        throw new Error("GCP_OCR_BUCKET is not configured");
    }

    const projectId = await visionClient.getProjectId();
    const bucket = storage.bucket(bucketName);
    const [bucketExists] = await bucket.exists();
    if (!bucketExists) {
        throw new Error(`OCR bucket does not exist or is not accessible: ${bucketName}`);
    }

    const probeObject = `vision-ocr/health/${Date.now()}-${crypto
        .randomBytes(6)
        .toString("hex")}.txt`;
    const probeFile = bucket.file(probeObject);
    const probePayload = "vision-ocr-health-check";

    await probeFile.save(probePayload, {
        contentType: "text/plain",
        resumable: false,
    });

    try {
        const [downloaded] = await probeFile.download();
        const downloadedText = downloaded.toString("utf8");
        if (downloadedText !== probePayload) {
            throw new Error("OCR bucket probe content mismatch");
        }
    } finally {
        await bestEffortDeleteFile(probeFile);
    }

    return {
        projectId,
        bucketName,
        timestamp: new Date().toISOString(),
    };
}

module.exports = {
    checkVisionOcrHealth,
    extractTextFromPdfBuffer,
};
