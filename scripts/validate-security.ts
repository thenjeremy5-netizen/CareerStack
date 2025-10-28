#!/usr/bin/env node

/**
 * Security Validation Script
 * 
 * This script validates that all critical security fixes have been properly implemented
 * in the CareerStack authentication system.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

interface SecurityCheck {
  name: string;
  description: string;
  check: () => boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

function readFile(relativePath: string): string {
  const fullPath = join(PROJECT_ROOT, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${relativePath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

const securityChecks: SecurityCheck[] = [
  {
    name: 'JWT_SECRETS_NOT_HARDCODED',
    description: 'JWT secrets should not be hardcoded',
    severity: 'CRITICAL',
    check: () => {
      const authService = readFile('server/services/authService.ts');
      return !authService.includes('your-secret-key') && 
             !authService.includes('your-refresh-secret-key') &&
             authService.includes('if (!JWT_SECRET || !JWT_REFRESH_SECRET)');
    }
  },
  
  {
    name: 'USER_ENUMERATION_PREVENTED',
    description: 'Generic error messages should be used to prevent user enumeration',
    severity: 'HIGH',
    check: () => {
      const authController = readFile('server/controllers/authController.ts');
      const passport = readFile('server/config/passport.ts');
      
      return authController.includes('Registration failed. Please try again with different details.') &&
             authController.includes('Invalid credentials') &&
             !passport.includes('User not found:') &&
             !passport.includes('Email not verified:');
    }
  },
  
  {
    name: 'RATE_LIMITING_IMPLEMENTED',
    description: 'Rate limiting should be implemented for authentication endpoints',
    severity: 'HIGH',
    check: () => {
      const authRoutes = readFile('server/routes/authRoutes.ts');
      return authRoutes.includes('loginLimiter') &&
             authRoutes.includes('twoFALimiter') &&
             authRoutes.includes('passwordResetLimiter') &&
             authRoutes.includes('registrationLimiter');
    }
  },
  
  {
    name: 'LOG_INJECTION_PREVENTED',
    description: 'User input should be sanitized in log statements',
    severity: 'MEDIUM',
    check: () => {
      const authController = readFile('server/controllers/authController.ts');
      const passport = readFile('server/config/passport.ts');
      
      return !authController.includes('email: req.body?.email') &&
             !passport.includes('{ email }') &&
             authController.includes('sanitizedEmail') &&
             passport.includes('sanitizedEmail');
    }
  },
  
  {
    name: 'SESSION_REGENERATION',
    description: 'Session should be regenerated on login to prevent session fixation',
    severity: 'HIGH',
    check: () => {
      const authController = readFile('server/controllers/authController.ts');
      return authController.includes('req.session.regenerate');
    }
  },
  
  {
    name: 'SECURE_COOKIE_OPTIONS',
    description: 'Secure cookie options should be used',
    severity: 'MEDIUM',
    check: () => {
      const authController = readFile('server/controllers/authController.ts');
      return authController.includes('getSecureCookieOptions()');
    }
  },
  
  {
    name: 'PASSWORD_STRENGTH_VALIDATION',
    description: 'Password strength should be validated',
    severity: 'HIGH',
    check: () => {
      const authController = readFile('server/controllers/authController.ts');
      return authController.includes('validatePasswordStrength') &&
             authController.includes('passwordValidation.isValid');
    }
  },
  
  {
    name: 'INPUT_SANITIZATION',
    description: 'User input should be sanitized',
    severity: 'HIGH',
    check: () => {
      const authController = readFile('server/controllers/authController.ts');
      return authController.includes('sanitizeInput(email)') &&
             authController.includes('sanitizeInput(pseudoName)');
    }
  },
  
  {
    name: 'SECURITY_CONFIG_EXISTS',
    description: 'Security configuration file should exist',
    severity: 'MEDIUM',
    check: () => {
      return existsSync(join(PROJECT_ROOT, 'server/config/security.ts'));
    }
  },
  
  {
    name: 'BCRYPT_ROUNDS_SECURE',
    description: 'Bcrypt should use secure number of rounds',
    severity: 'HIGH',
    check: () => {
      const authService = readFile('server/services/authService.ts');
      return authService.includes('SECURITY_CONFIG.PASSWORD.BCRYPT_ROUNDS') &&
             !authService.includes('bcrypt.genSalt(12)');
    }
  },
  
  {
    name: 'TOKEN_ENTROPY_INCREASED',
    description: 'Token entropy should be increased for security',
    severity: 'MEDIUM',
    check: () => {
      const authService = readFile('server/services/authService.ts');
      return authService.includes('SECURITY_CONFIG.TOKENS.EMAIL_VERIFICATION_BYTES') &&
             authService.includes('SECURITY_CONFIG.TOKENS.PASSWORD_RESET_BYTES');
    }
  },
  
  {
    name: 'TWO_FA_TOKEN_EXPIRY_REDUCED',
    description: '2FA token expiry should be reduced for security',
    severity: 'MEDIUM',
    check: () => {
      const authService = readFile('server/services/authService.ts');
      return authService.includes('SECURITY_CONFIG.JWT.TWO_FA_TOKEN_EXPIRY') &&
             !authService.includes("expiresIn: '10m'");
    }
  }
];

function runSecurityValidation(): void {
  console.log('🔒 Running Security Validation...\n');
  
  let passed = 0;
  let failed = 0;
  const failures: { check: SecurityCheck; error?: string }[] = [];
  
  for (const check of securityChecks) {
    try {
      const result = check.check();
      if (result) {
        console.log(`✅ ${check.name}: ${check.description}`);
        passed++;
      } else {
        console.log(`❌ ${check.name}: ${check.description} [${check.severity}]`);
        failed++;
        failures.push({ check });
      }
    } catch (error) {
      console.log(`💥 ${check.name}: Error during check - ${error instanceof Error ? error.message : 'Unknown error'} [${check.severity}]`);
      failed++;
      failures.push({ check, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  
  console.log(`\n📊 Security Validation Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failures.length > 0) {
    console.log(`\n🚨 Critical Issues Found:`);
    const criticalFailures = failures.filter(f => f.check.severity === 'CRITICAL');
    const highFailures = failures.filter(f => f.check.severity === 'HIGH');
    
    if (criticalFailures.length > 0) {
      console.log(`\n   CRITICAL (${criticalFailures.length}):`);
      criticalFailures.forEach(f => {
        console.log(`   - ${f.check.name}: ${f.check.description}`);
        if (f.error) console.log(`     Error: ${f.error}`);
      });
    }
    
    if (highFailures.length > 0) {
      console.log(`\n   HIGH (${highFailures.length}):`);
      highFailures.forEach(f => {
        console.log(`   - ${f.check.name}: ${f.check.description}`);
        if (f.error) console.log(`     Error: ${f.error}`);
      });
    }
    
    if (criticalFailures.length > 0 || highFailures.length > 0) {
      console.log(`\n⚠️  Please address CRITICAL and HIGH severity issues before deploying to production.`);
      process.exit(1);
    }
  }
  
  console.log(`\n🎉 Security validation completed successfully!`);
  console.log(`   All critical security vulnerabilities have been addressed.`);
}

// Always run validation when script is executed
try {
  runSecurityValidation();
} catch (error) {
  console.error('💥 Security validation failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}

export { runSecurityValidation, securityChecks };