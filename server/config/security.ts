import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '../utils/logger';

// Security configuration constants
export const SECURITY_CONFIG = {
  // JWT Configuration
  JWT: {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '24h',
    TWO_FA_TOKEN_EXPIRY: '5m',
  },
  
  // Password Security
  PASSWORD: {
    MIN_LENGTH: 8,
    BCRYPT_ROUNDS: 14,
    REQUIRE_SPECIAL_CHARS: true,
  },
  
  // Rate Limiting
  RATE_LIMITS: {
    LOGIN_ATTEMPTS: 5,
    LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    TWO_FA_ATTEMPTS: 3,
    TWO_FA_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    PASSWORD_RESET_ATTEMPTS: 3,
    PASSWORD_RESET_WINDOW_MS: 60 * 60 * 1000, // 1 hour
    REGISTRATION_ATTEMPTS: 3,
    REGISTRATION_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  },
  
  // Token Security
  TOKENS: {
    EMAIL_VERIFICATION_BYTES: 48,
    PASSWORD_RESET_BYTES: 48,
    REFRESH_TOKEN_BYTES: 40,
  },
  
  // Session Security
  SESSION: {
    REGENERATE_ON_LOGIN: true,
    CLEAR_ALL_COOKIES_ON_LOGOUT: true,
  },
};

// Input sanitization helper
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\r\n\t]/g, '').trim();
}

// Log sanitization helper
export function sanitizeForLog(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^\w@.-]/g, '');
}

// Validate password strength
export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < SECURITY_CONFIG.PASSWORD.MIN_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD.MIN_LENGTH} characters long`);
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (SECURITY_CONFIG.PASSWORD.REQUIRE_SPECIAL_CHARS && !/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Security headers middleware
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for compatibility
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  });
}

// Request logging middleware with sanitization
export function secureRequestLogger(req: Request, res: Response, next: NextFunction) {
  const sanitizedUrl = sanitizeForLog(req.url);
  const sanitizedMethod = sanitizeForLog(req.method);
  const sanitizedIp = sanitizeForLog(req.ip || 'unknown');
  
  logger.info('Request received', {
    method: sanitizedMethod,
    url: sanitizedUrl,
    ip: sanitizedIp,
    userAgent: req.headers['user-agent'] ? 'present' : 'missing',
  });
  
  next();
}

// Environment validation
export function validateSecurityEnvironment(): void {
  const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SESSION_SECRET',
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required security environment variables: ${missingVars.join(', ')}`);
  }
  
  // Validate JWT secrets are strong enough
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
  }
  
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long');
  }
  
  logger.info('Security environment validation passed');
}

// Generic error response to prevent information leakage
export function sendGenericError(res: Response, statusCode: number = 500, message: string = 'An error occurred') {
  res.status(statusCode).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  });
}

// Secure cookie options
export function getSecureCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}