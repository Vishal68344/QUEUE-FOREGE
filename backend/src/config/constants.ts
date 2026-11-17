export const QUEUE_NAMES = ["emails", "reports", "dead-letter"] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export const JOB_TYPES = ["send-email", "generate-report"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const REALTIME_CHANNEL = "queueforge:realtime";
