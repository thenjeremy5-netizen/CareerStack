import { test, expect } from '@playwright/test';

test.describe('Simple Authentication Redirect Test', () => {
  test('should handle the reported redirect bugs', async ({ page }) => {
    console.log('Testing authentication redirect behavior...');
    
    // Test 1: Access protected page without login
    console.log('1. Accessing /dashboard without login...');
    await page.goto('http://localhost:5000/dashboard');
    
    // Should redirect to login (either directly or via landing page)
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log('Current URL after accessing dashboard:', currentUrl);
    
    // Should be on login page or landing page with login dialog
    const isOnLoginPage = currentUrl.includes('/login') || currentUrl.includes('/?auth=login') || currentUrl === 'http://localhost:5000/';
    expect(isOnLoginPage).toBeTruthy();
    
    // Test 2: Login and check redirect behavior
    console.log('2. Logging in...');
    
    // If we're on landing page, open login dialog
    if (currentUrl === 'http://localhost:5000/') {
      await page.click('[data-testid="button-login"]');
      await page.waitForTimeout(1000);
    }
    
    // Fill login form
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    await page.click('button[type="submit"]');
    
    // Wait for redirect - the login form uses a 100ms delay before redirect
    await page.waitForTimeout(5000);
    
    let afterLoginUrl = page.url();
    console.log('URL after login:', afterLoginUrl);
    
    // If still on login page, wait a bit more for the redirect
    if (afterLoginUrl.includes('/login')) {
      await page.waitForTimeout(3000);
      afterLoginUrl = page.url();
      console.log('Final URL after additional wait:', afterLoginUrl);
    }
    
    // Should be on dashboard, not the originally requested page
    expect(afterLoginUrl).toContain('/dashboard');
    console.log('✅ Login redirects to dashboard correctly');
    
    // Test 3: Navigate to another page and test back button
    console.log('3. Testing back button behavior...');
    
    // Go to editor page
    await page.goto('http://localhost:5000/editor');
    await page.waitForTimeout(2000);
    console.log('Navigated to editor page');
    
    // Use back button
    await page.goBack();
    await page.waitForTimeout(3000);
    
    const backButtonUrl = page.url();
    console.log('URL after back button:', backButtonUrl);
    
    // Should be on dashboard, not login page
    expect(backButtonUrl).toContain('/dashboard');
    expect(backButtonUrl).not.toContain('/login');
    console.log('✅ Back button works without login redirect');
    
    // Test 4: Wait 10+ seconds to see if there's any unwanted redirect
    console.log('4. Waiting 12 seconds to check for unwanted redirects...');
    await page.waitForTimeout(12000);
    
    const finalUrl = page.url();
    console.log('URL after waiting 12 seconds:', finalUrl);
    
    // Should still be on dashboard
    expect(finalUrl).toContain('/dashboard');
    console.log('✅ No unwanted redirects after waiting');
    
    console.log('All tests passed! Authentication redirect bugs appear to be fixed.');
  });
});