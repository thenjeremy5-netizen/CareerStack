import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { isAuthenticated } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

import { SECURITY_CONFIG } from '../config/security';

// Rate limiters for different auth endpoints
const loginLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMITS.LOGIN_WINDOW_MS,
  max: SECURITY_CONFIG.RATE_LIMITS.LOGIN_ATTEMPTS,
  message: { message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const twoFALimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMITS.TWO_FA_WINDOW_MS,
  max: SECURITY_CONFIG.RATE_LIMITS.TWO_FA_ATTEMPTS,
  message: { message: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMITS.PASSWORD_RESET_WINDOW_MS,
  max: SECURITY_CONFIG.RATE_LIMITS.PASSWORD_RESET_ATTEMPTS,
  message: { message: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registrationLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMITS.REGISTRATION_WINDOW_MS,
  max: SECURITY_CONFIG.RATE_LIMITS.REGISTRATION_ATTEMPTS,
  message: { message: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Public routes with rate limiting
router.post('/register', registrationLimiter, AuthController.register);
router.post('/login', loginLimiter, AuthController.login);
router.post('/verify-2fa', twoFALimiter, AuthController.verify2FACode);
router.post('/request-password-reset', passwordResetLimiter, AuthController.requestPasswordReset);
router.post('/forgot-password', passwordResetLimiter, AuthController.requestPasswordReset); // Alias for frontend compatibility
router.post('/reset-password', passwordResetLimiter, AuthController.resetPassword);
router.post('/resend-verification', passwordResetLimiter, AuthController.resendVerification);

// Protected routes (using combined session and JWT auth)
router.get('/me', isAuthenticated, AuthController.getCurrentUser);
router.get('/user', isAuthenticated, AuthController.getCurrentUser);
router.post('/logout', isAuthenticated, AuthController.logout);
router.get('/devices', isAuthenticated, AuthController.getUserDevices);
router.delete('/devices/:deviceId', isAuthenticated, AuthController.revokeDevice);

export default router;
