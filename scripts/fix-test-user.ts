import { db } from '../server/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function fixTestUser() {
  try {
    const result = await db.update(users)
      .set({
        emailVerified: true,
        approvalStatus: 'approved',
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.email, 'test@example.com'))
      .returning({ id: users.id, email: users.email });

    if (result.length > 0) {
      console.log('✅ Test user fixed:', result[0]);
    } else {
      console.log('❌ Test user not found');
    }
  } catch (error) {
    console.error('Error fixing test user:', error);
  }
}

fixTestUser().then(() => process.exit(0));