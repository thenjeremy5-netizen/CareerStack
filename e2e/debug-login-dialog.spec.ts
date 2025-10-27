import { test, expect } from '@playwright/test';

test('debug login dialog', async ({ page }) => {
  // Clear everything
  await page.context().clearCookies();
  await page.goto('http://localhost:5000/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Go to login page
  await page.goto('http://localhost:5000/login');
  await page.waitForTimeout(2000);

  console.log('Current URL:', page.url());

  // Check if login dialog is open
  const dialogVisible = await page.locator('[role="dialog"]').isVisible();
  console.log('Login dialog visible:', dialogVisible);

  // Fill login form
  await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
  await page.fill('input[type="password"]', 'Rahulr@1234');

  // Listen for network requests
  page.on('response', response => {
    if (response.url().includes('/api/auth/login')) {
      console.log(`Login response: ${response.status()}`);
      response.json().then(data => {
        console.log('Login response data:', data);
      }).catch(() => {});
    }
  });

  // Submit form
  await page.click('button[type="submit"]');
  console.log('Login form submitted');

  // Wait and check for any error messages
  await page.waitForTimeout(3000);

  const errorMessages = await page.locator('[role="alert"], .text-red-500, .text-destructive').allTextContents();
  console.log('Error messages:', errorMessages);

  const currentUrl = page.url();
  console.log('URL after login attempt:', currentUrl);

  // Check if still on login page
  if (currentUrl.includes('/login')) {
    console.log('Still on login page - checking for issues...');
    
    // Check if login button is still visible
    const loginButtonVisible = await page.locator('button[type="submit"]').isVisible();
    console.log('Login button still visible:', loginButtonVisible);
    
    // Check if there are any toast messages
    const toastMessages = await page.locator('[data-sonner-toast]').allTextContents();
    console.log('Toast messages:', toastMessages);
  }
});