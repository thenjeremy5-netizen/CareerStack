import { db } from '../server/db';
import { users, authRateLimits, emailRateLimits } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { AuthService } from '../server/services/authService';

async function resetTestEnvironment() {
  try {
    console.log('🔄 Resetting test environment...');
    
    // 1. Clear all rate limits
    await db.delete(authRateLimits);
    await db.delete(emailRateLimits);
    console.log('✅ Rate limits cleared');
    
    // 2. Delete existing test user
    await db.delete(users).where(eq(users.email, 'test@example.com'));
    console.log('✅ Existing test user removed');
    
    // 3. Create fresh test user
    const hashedPassword = await AuthService.hashPassword('testpassword123');
    
    const result = await db.insert(users).values({
      email: 'test@example.com',
      password: hashedPassword,
      pseudoName: 'TestUser',
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
      approvalStatus: 'approved',
      role: 'user',
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({
      id: users.id,
      email: users.email,
    });
    
    console.log('✅ Fresh test user created:', result[0]);
    console.log('🎉 Test environment reset complete!');
    
  } catch (error) {
    console.error('❌ Error resetting test environment:', error);
  }
}

resetTestEnvironment().then(() => process.exit(0));