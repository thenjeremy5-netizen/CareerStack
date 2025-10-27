import { db } from '../server/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function checkTestUser() {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, 'test@example.com'),
    });

    if (!user) {
      console.log('❌ Test user not found');
      return;
    }

    console.log('✅ Test user found:');
    console.log('- ID:', user.id);
    console.log('- Email:', user.email);
    console.log('- Email Verified:', user.emailVerified);
    console.log('- Approval Status:', user.approvalStatus);
    console.log('- Role:', user.role);
    console.log('- Failed Login Attempts:', user.failedLoginAttempts);
    console.log('- Account Locked Until:', user.accountLockedUntil);
    console.log('- Has Password:', !!user.password);
    console.log('- Created At:', user.createdAt);
  } catch (error) {
    console.error('Error checking test user:', error);
  }
}

checkTestUser().then(() => process.exit(0));