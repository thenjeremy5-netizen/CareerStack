import { test, expect } from '@playwright/test';

test('debug login process', async ({ page }) => {
  // Listen for console messages
  page.on('console', msg => {
    console.log(`BROWSER: ${msg.type()}: ${msg.text()}`);
  });

  // Listen for network requests
  page.on('request', request => {
    if (request.url().includes('/api/auth/')) {
      console.log(`REQUEST: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('/api/auth/')) {
      console.log(`RESPONSE: ${response.status()} ${response.url()}`);
    }
  });

  console.log('1. Going to login page...');
  await page.goto('http://localhost:5000/login');
  await page.waitForTimeout(2000);

  console.log('2. Filling login form...');
  await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
  await page.fill('input[type="password"]', 'Rahulr@1234');

  console.log('3. Submitting login form...');
  await page.click('button[type="submit"]');

  console.log('4. Waiting for response...');
  await page.waitForTimeout(5000);

  const currentUrl = page.url();
  console.log('5. Current URL after login:', currentUrl);

  // Check if there are any error messages on the page
  const errorMessages = await page.locator('[role="alert"], .text-red-500, .text-destructive').allTextContents();
  if (errorMessages.length > 0) {
    console.log('Error messages found:', errorMessages);
  }

  // Check if login button is still visible (indicating login failed)
  const loginButtonVisible = await page.locator('button[type="submit"]').isVisible();
  console.log('Login button still visible:', loginButtonVisible);

  // Check localStorage for any auth-related data
  const authData = await page.evaluate(() => {
    return {
      lastActiveTime: localStorage.getItem('lastActiveTime'),
      redirectAfterLogin: localStorage.getItem('redirectAfterLogin'),
      authLoopDetected: localStorage.getItem('authLoopDetected'),
      lastAuthRedirect: localStorage.getItem('lastAuthRedirect')
    };
  });
  console.log('Auth localStorage data:', authData);
});