const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  { maxRetriesPerRequest: null }
);

const gradingQueue = new Queue("grading", {
  connection,
  defaultJobOptions: {
    attempts: 10,
    backoff: {
      type: "exponential",
      delay: 600000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

const RR_KEYS = {
  slotMap: "grading:rr:teacher-slots",
  slotCursor: "grading:rr:slot-cursor",
};

const ROUND_STRIDE = 1000;

async function getTeacherSlot(teacherId) {
  const teacherKey = String(teacherId || "").trim();
  if (!teacherKey) {
    return 999;
  }

  const existingSlot = await connection.hget(RR_KEYS.slotMap, teacherKey);
  if (existingSlot) {
    return Number(existingSlot);
  }

  const newSlot = await connection.incr(RR_KEYS.slotCursor);
  const wasSet = await connection.hsetnx(RR_KEYS.slotMap, teacherKey, String(newSlot));
  if (wasSet === 1) {
    return newSlot;
  }

  const resolvedSlot = await connection.hget(RR_KEYS.slotMap, teacherKey);
  return Number(resolvedSlot || newSlot);
}

async function getRoundRobinPriority(teacherId) {
  const teacherKey = String(teacherId || "").trim() || "unknown";
  const round = await connection.incr(`grading:rr:teacher-round:${teacherKey}`);
  const slot = await getTeacherSlot(teacherKey);
  return round * ROUND_STRIDE + (slot % ROUND_STRIDE);
}

async function addGradingJob(data) {
  const payload = { ...(data || {}) };
  const priority = await getRoundRobinPriority(payload.teacherId);
  return gradingQueue.add("grade", payload, { priority });
}

module.exports = gradingQueue;
module.exports.addGradingJob = addGradingJob;
