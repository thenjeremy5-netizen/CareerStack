import { Strategy as LocalStrategy } from 'passport-local';
import { db } from '../db';
import { users, User } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { compare } from 'bcryptjs';
import { logger } from '../utils/logger';
import { SECURITY_CONFIG } from '../config/security';

const MAX_LOGIN_ATTEMPTS = SECURITY_CONFIG.RATE_LIMITS.LOGIN_ATTEMPTS;
const LOCK_DURATION_MS = SECURITY_CONFIG.RATE_LIMITS.LOGIN_WINDOW_MS;

export function configurePassport(passport: any) {
  // Local strategy for username/password authentication
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true,
      },
      async (req, email, password, done) => {
        try {
          const sanitizedEmail = email ? email.replace(/[\r\n\t]/g, '') : 'undefined';
          logger.info('Passport strategy executing', { hasEmail: !!email, hasPassword: !!password });
          
          // Find user by email
          const user = await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase()),
          });

          logger.info('User lookup completed', { found: !!user });

          // If user not found
          if (!user) {
            return done(null, false, { message: 'Invalid credentials' });
          }

          // If account is locked
          if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
            return done(null, false, {
              message: 'Account is temporarily locked. Please try again later.',
            });
          }

          // Check if password is correct
          const isMatch = await compare(password, user.password);
          if (!isMatch) {
            // Increment failed login attempts and lock if threshold reached
            const newCount = (user.failedLoginAttempts || 0) + 1;
            const shouldLock = newCount >= MAX_LOGIN_ATTEMPTS;
            await db
              .update(users)
              .set({
                failedLoginAttempts: newCount,
                accountLockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
              })
              .where(eq(users.id, user.id));

            return done(null, false, { message: shouldLock ? 'Account temporarily locked. Try again later.' : 'Invalid credentials' });
          }

          // If email is not verified
          if (!user.emailVerified) {
            return done(null, false, {
              message: 'Account verification required.',
              requiresVerification: true,
            } as any);
          }

          // Check approval status
          if (user.approvalStatus !== 'approved') {
            return done(null, false, {
              message: 'Account access restricted.',
            });
          }

          logger.info('User authentication successful', { userId: user.id });

          // Reset failed login attempts on successful login
          if ((user.failedLoginAttempts || 0) > 0) {
            await db
              .update(users)
              .set({
                failedLoginAttempts: 0,
                accountLockedUntil: null,
              })
              .where(eq(users.id, user.id));
          }

          // Return user without password
          const { password: _, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword as User);
        } catch (error) {
          logger.error({ error: error }, 'Passport error:');
          return done(error);
        }
      }
    )
  );

  // Serialize user into the session
  passport.serializeUser((user: any, done: any) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id: string, done: any) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
        columns: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          pseudoName: true,
          emailVerified: true,
          twoFactorEnabled: true,
          role: true,
          approvalStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return done(null, false);
      }

      // Check if user is approved
      if (user.approvalStatus !== 'approved') {
        return done(null, false);
      }

      done(null, user);
    } catch (error) {
      logger.error({ error: error }, 'Deserialize user error:');
      done(error);
    }
  });
}
