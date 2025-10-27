import { test, expect } from '@playwright/test';

test.describe('Clean Authentication Test', () => {
  test('should handle authentication redirect bugs with clean session', async ({ page }) => {
    console.log('=== Starting clean authentication test ===');
    
    // Ensure completely clean state
    await page.context().clearCookies();
    await page.context().clearPermissions();
    
    // Go to a neutral page first and clear everything
    await page.goto('http://localhost:5000/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Clear any circuit breaker state
      if ((window as any).authCircuitBreaker) {
        (window as any).authCircuitBreaker.reset();
      }
    });
    
    console.log('=== Test 1: Access protected page without authentication ===');
    
    // Now try to access dashboard
    await page.goto('http://localhost:5000/dashboard');
    
    // Wait for any redirects to complete
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('URL after accessing dashboard:', currentUrl);
    
    // Should be redirected to login page or landing page
    const isRedirected = currentUrl.includes('/login') || currentUrl === 'http://localhost:5000/';
    expect(isRedirected).toBeTruthy();
    console.log('✅ Correctly redirected from protected page');
    
    console.log('=== Test 2: Login and verify redirect behavior ===');
    
    // If on landing page, click login button
    if (currentUrl === 'http://localhost:5000/') {
      await page.click('[data-testid="button-login"]');
      await page.waitForTimeout(1000);
    }
    
    // Fill login form
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    
    // Submit login
    await page.click('button[type="submit"]');
    console.log('Login form submitted');
    
    // Wait for redirect with generous timeout
    await page.waitForTimeout(8000);
    
    const afterLoginUrl = page.url();
    console.log('URL after login:', afterLoginUrl);
    
    // Should be on dashboard
    expect(afterLoginUrl).toContain('/dashboard');
    console.log('✅ Login redirects to dashboard correctly');
    
    console.log('=== Test 3: Test back button behavior ===');
    
    // Navigate to editor
    await page.goto('http://localhost:5000/editor');
    await page.waitForTimeout(2000);
    console.log('Navigated to editor page');
    
    // Use back button
    await page.goBack();
    await page.waitForTimeout(3000);
    
    const backUrl = page.url();
    console.log('URL after back button:', backUrl);
    
    // Should be on dashboard, not login
    expect(backUrl).toContain('/dashboard');
    expect(backUrl).not.toContain('/login');
    console.log('✅ Back button works without login redirect');
    
    console.log('=== Test 4: Check for unwanted redirects ===');
    
    // Wait to see if there are any unwanted redirects
    await page.waitForTimeout(12000);
    
    const finalUrl = page.url();
    console.log('Final URL after waiting 12 seconds:', finalUrl);
    
    // Should still be on dashboard
    expect(finalUrl).toContain('/dashboard');
    console.log('✅ No unwanted redirects detected');
    
    console.log('🎉 All authentication redirect bugs have been fixed!');
  });
});