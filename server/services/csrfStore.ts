import { CacheService, CACHE_TTL } from '../config/redis';
import { logger } from '../utils/logger';

const CSRF_PREFIX = 'csrf:';

export class CSRFStore {
  /**
   * Store CSRF token in Redis
   */
  static async set(sessionId: string, token: string): Promise<boolean> {
    try {
      return await CacheService.set(
        `${CSRF_PREFIX}${sessionId}`,
        token,
        CACHE_TTL.HOUR
      );
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to store CSRF token');
      return false;
    }
  }

  /**
   * Get CSRF token from Redis
   */
  static async get(sessionId: string): Promise<string | null> {
    try {
      return await CacheService.get(`${CSRF_PREFIX}${sessionId}`);
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to get CSRF token');
      return null;
    }
  }

  /**
   * Delete CSRF token from Redis
   */
  static async delete(sessionId: string): Promise<boolean> {
    try {
      return await CacheService.del(`${CSRF_PREFIX}${sessionId}`);
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to delete CSRF token');
      return false;
    }
  }

  /**
   * Verify CSRF token matches stored token
   */
  static async verify(sessionId: string, token: string): Promise<boolean> {
    try {
      const storedToken = await this.get(sessionId);
      return storedToken === token;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to verify CSRF token');
      return false;
    }
  }
}