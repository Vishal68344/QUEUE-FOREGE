process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/queueforge_test";
process.env.REDIS_HOST = "127.0.0.1";
process.env.REDIS_PORT = "6379";
process.env.JWT_SECRET = "test-only-secret-that-is-at-least-thirty-two-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CORS_ORIGIN = "http://localhost:3000";
