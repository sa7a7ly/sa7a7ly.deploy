const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  { maxRetriesPerRequest: null }
);

const gradingQueue = new Queue("grading", {
  connection,
  defaultJobOptions: {
    attempts: 20,
    backoff: {
      type: "exponential",
      delay: 600000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

module.exports = gradingQueue;
