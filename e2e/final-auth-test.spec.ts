import { test, expect } from '@playwright/test';

test.describe('Final Authentication Test', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all storage and reset circuit breaker
    await page.context().clearCookies();
    await page.goto('http://localhost:5000/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Reset circuit breaker if it exists
      if ((window as any).authCircuitBreaker) {
        (window as any).authCircuitBreaker.reset();
      }
    });
  });

  test('should handle all authentication redirect scenarios', async ({ page }) => {
    // Listen for console messages to debug
    page.on('console', msg => {
      if (msg.text().includes('circuit breaker') || msg.text().includes('Login') || msg.text().includes('redirect')) {
        console.log(`BROWSER: ${msg.text()}`);
      }
    });

    console.log('=== Test 1: Access protected page without login ===');
    await page.goto('http://localhost:5000/dashboard');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('URL after accessing dashboard:', currentUrl);
    expect(currentUrl).toContain('/login');
    console.log('✅ Correctly redirected to login page');

    console.log('=== Test 2: Login and verify redirect ===');
    
    // Fill and submit login form
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    
    // Wait for any network requests to complete before submitting
    await page.waitForTimeout(1000);
    
    await page.click('button[type="submit"]');
    console.log('Login form submitted');
    
    // Wait for the redirect with a longer timeout
    try {
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      console.log('✅ Successfully redirected to dashboard');
    } catch (error) {
      // If waitForURL fails, check current URL
      const urlAfterLogin = page.url();
      console.log('URL after login attempt:', urlAfterLogin);
      
      if (urlAfterLogin.includes('/dashboard')) {
        console.log('✅ On dashboard page (manual check)');
      } else {
        // Check for any error messages
        const errorElements = await page.locator('[role="alert"], .text-red-500, .text-destructive').allTextContents();
        console.log('Error messages:', errorElements);
        throw new Error(`Login failed - still on: ${urlAfterLogin}`);
      }
    }

    console.log('=== Test 3: Back button behavior ===');
    
    // Navigate to editor
    await page.goto('http://localhost:5000/editor');
    await page.waitForTimeout(2000);
    console.log('Navigated to editor');
    
    // Use back button
    await page.goBack();
    await page.waitForTimeout(2000);
    
    const backUrl = page.url();
    console.log('URL after back button:', backUrl);
    expect(backUrl).toContain('/dashboard');
    expect(backUrl).not.toContain('/login');
    console.log('✅ Back button works correctly');

    console.log('=== Test 4: No unwanted redirects ===');
    
    // Wait to see if there are any unwanted redirects
    await page.waitForTimeout(10000);
    
    const finalUrl = page.url();
    console.log('Final URL after waiting:', finalUrl);
    expect(finalUrl).toContain('/dashboard');
    console.log('✅ No unwanted redirects detected');

    console.log('🎉 All authentication redirect tests passed!');
  });
});