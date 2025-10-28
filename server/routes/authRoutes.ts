import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/verify-2fa', AuthController.verify2FACode);
router.post('/request-password-reset', AuthController.requestPasswordReset);
router.post('/forgot-password', AuthController.requestPasswordReset); // Alias for frontend compatibility
router.post('/reset-password', AuthController.resetPassword);
router.post('/resend-verification', AuthController.resendVerification);

// Protected routes (using combined session and JWT auth)
router.get('/me', isAuthenticated, AuthController.getCurrentUser);
router.get('/user', isAuthenticated, AuthController.getCurrentUser);
router.post('/logout', isAuthenticated, AuthController.logout);
router.get('/devices', isAuthenticated, AuthController.getUserDevices);
router.delete('/devices/:deviceId', isAuthenticated, AuthController.revokeDevice);

export default router;
