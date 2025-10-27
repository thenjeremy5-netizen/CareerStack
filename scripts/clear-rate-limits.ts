import { db } from '../server/db';
import { authRateLimits, emailRateLimits } from '@shared/schema';

async function clearRateLimits() {
  try {
    console.log('🔄 Clearing rate limits...');
    
    await db.delete(authRateLimits);
    await db.delete(emailRateLimits);
    
    console.log('✅ Rate limits cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing rate limits:', error);
  }
}

clearRateLimits().then(() => process.exit(0));