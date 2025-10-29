import { logger } from '../utils/logger';

export async function initializeRedisService() {
  // In development mode, just return the in-memory implementation
  if (process.env.NODE_ENV === 'development') {
    logger.info('Using in-memory Redis implementation for development mode');
    return {
      client: null,
      pubClient: null,
      subClient: null,
      isReady: true
    };
  }

  try {
    // Import real Redis implementation only in production
    const { redisClient, redisPubClient, redisSubClient } = await import('./redis');
    
    // Wait for Redis to be ready
    await Promise.all([
      new Promise((resolve) => redisClient.once('ready', resolve)),
      new Promise((resolve) => redisPubClient.once('ready', resolve)),
      new Promise((resolve) => redisSubClient.once('ready', resolve))
    ]);

    logger.info('Redis connections established successfully');
    return {
      client: redisClient,
      pubClient: redisPubClient,
      subClient: redisSubClient,
      isReady: true
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to connect to Redis, using in-memory fallback');
    return {
      client: null,
      pubClient: null,
      subClient: null,
      isReady: true
    };
  }
}