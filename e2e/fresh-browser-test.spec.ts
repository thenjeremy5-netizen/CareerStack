import { test, expect, chromium } from '@playwright/test';

test('fresh browser authentication test', async () => {
  // Create completely fresh browser instance
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🧪 Testing with completely fresh browser...');
    
    console.log('✅ Test 1: Access protected page without authentication');
    await page.goto('http://localhost:5000/dashboard');
    await page.waitForTimeout(3000);
    
    const redirectUrl = page.url();
    console.log('URL after accessing dashboard:', redirectUrl);
    expect(redirectUrl).toContain('/login');
    console.log('✅ Correctly redirected to login page');
    
    console.log('✅ Test 2: Login and verify redirect');
    
    // Listen for network responses
    page.on('response', response => {
      if (response.url().includes('/api/auth/login')) {
        console.log(`Login response: ${response.status()}`);
      }
    });
    
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    
    // Wait for navigation to dashboard after login
    const navigationPromise = page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.click('button[type="submit"]');
    
    try {
      await navigationPromise;
      console.log('Successfully navigated to dashboard');
    } catch (error) {
      console.log('Navigation timeout, checking current URL...');
      await page.waitForTimeout(2000);
    }
    
    const afterLoginUrl = page.url();
    console.log('URL after login:', afterLoginUrl);
    expect(afterLoginUrl).toContain('/dashboard');
    console.log('✅ Login redirects to dashboard correctly');
    
    console.log('✅ Test 3: Back button behavior');
    await page.goto('http://localhost:5000/editor');
    await page.waitForTimeout(1000);
    await page.goBack();
    await page.waitForTimeout(2000);
    
    const backUrl = page.url();
    console.log('URL after back button:', backUrl);
    expect(backUrl).toContain('/dashboard');
    expect(backUrl).not.toContain('/login');
    console.log('✅ Back button works correctly');
    
    console.log('🎉 ALL AUTHENTICATION REDIRECT BUGS ARE FIXED!');
    
  } finally {
    await browser.close();
  }
});