import { db } from '../server/db';
import { users } from '@shared/schema';
import { AuthService } from '../server/services/authService';
import { eq } from 'drizzle-orm';

const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
  firstName: 'Test',
  lastName: 'User',
  pseudoName: 'TestUser'
};

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, TEST_USER.email),
    });

    if (existingUser) {
      console.log('Test user already exists');
      
      // Update user to ensure it's approved and verified
      await db.update(users).set({
        emailVerified: true,
        approvalStatus: 'approved',
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }).where(eq(users.id, existingUser.id));
      
      console.log('Test user updated and verified');
      return;
    }

    // Hash password
    const hashedPassword = await AuthService.hashPassword(TEST_USER.password);

    // Create user
    const result = await db.insert(users).values({
      email: TEST_USER.email,
      password: hashedPassword,
      pseudoName: TEST_USER.pseudoName,
      firstName: TEST_USER.firstName,
      lastName: TEST_USER.lastName,
      emailVerified: true, // Skip email verification for test user
      approvalStatus: 'approved', // Auto-approve test user
      role: 'user',
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({
      id: users.id,
      email: users.email,
    });

    console.log('Test user created successfully:', result[0]);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestUser().then(() => {
    console.log('Test user setup complete');
    process.exit(0);
  });
}

export { createTestUser, TEST_USER };