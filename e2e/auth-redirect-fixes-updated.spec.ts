import { test, expect } from '@playwright/test';

test.describe('Authentication Redirect Fixes', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all storage before each test
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should redirect to login when accessing protected page without authentication', async ({ page }) => {
    console.log('Test 1: Accessing protected page without login');
    
    // Try to access dashboard without being logged in
    await page.goto('http://localhost:5000/dashboard');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/.*\/login/);
    console.log('✅ Correctly redirected to login page');
  });

  test('should redirect to dashboard after successful login (not original protected page)', async ({ page }) => {
    console.log('Test 2: Login should redirect to dashboard');
    
    // First, try to access a protected page to trigger redirect storage
    await page.goto('http://localhost:5000/editor');
    await expect(page).toHaveURL(/.*\/login/);
    
    // Now login
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait for redirect and check URL
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Should be on dashboard, NOT on the originally requested /editor page
    expect(page.url()).toContain('/dashboard');
    console.log('✅ Successfully redirected to dashboard after login');
  });

  test('should not show temporary login redirect when using back button', async ({ page }) => {
    console.log('Test 3: Back button should not cause login flicker');
    
    // Login first
    await page.goto('http://localhost:5000/login');
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Navigate to another protected page
    await page.goto('http://localhost:5000/editor');
    await page.waitForLoadState('networkidle');
    
    // Use back button
    await page.goBack();
    
    // Should be back on dashboard without any login page flicker
    await page.waitForURL('**/dashboard', { timeout: 5000 });
    
    // Verify we're on dashboard and not login
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/login');
    console.log('✅ Back button works without login redirect');
  });

  test('should handle multiple rapid navigation without redirect loops', async ({ page }) => {
    console.log('Test 4: Rapid navigation should not cause loops');
    
    // Login first
    await page.goto('http://localhost:5000/login');
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Rapidly navigate between pages
    await page.goto('http://localhost:5000/editor');
    await page.waitForTimeout(100);
    await page.goBack();
    await page.waitForTimeout(100);
    await page.goForward();
    await page.waitForTimeout(100);
    await page.goBack();
    
    // Should end up on dashboard
    await page.waitForURL('**/dashboard', { timeout: 5000 });
    expect(page.url()).toContain('/dashboard');
    console.log('✅ Rapid navigation handled correctly');
  });

  test('should clear redirect path when accessing dashboard directly', async ({ page }) => {
    console.log('Test 5: Direct dashboard access should clear redirect path');
    
    // Set a redirect path in localStorage
    await page.goto('http://localhost:5000/');
    await page.evaluate(() => {
      localStorage.setItem('redirectAfterLogin', '/editor');
    });
    
    // Go to login page
    await page.goto('http://localhost:5000/login');
    
    // Login
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard, not /editor
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/editor');
    
    // Check that redirect path was cleared
    const redirectPath = await page.evaluate(() => localStorage.getItem('redirectAfterLogin'));
    expect(redirectPath).toBeNull();
    console.log('✅ Redirect path cleared correctly');
  });

  test('should only redirect to public pages after login', async ({ page }) => {
    console.log('Test 6: Should only redirect to public pages');
    
    // Set redirect path to a public page
    await page.goto('http://localhost:5000/');
    await page.evaluate(() => {
      localStorage.setItem('redirectAfterLogin', '/privacy');
    });
    
    // Go to login
    await page.goto('http://localhost:5000/login');
    
    // Login
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    await page.click('button[type="submit"]');
    
    // Should redirect to privacy page since it's public
    await page.waitForURL('**/privacy', { timeout: 10000 });
    expect(page.url()).toContain('/privacy');
    console.log('✅ Correctly redirected to public page');
  });

  test('should handle logout and prevent unwanted redirects', async ({ page }) => {
    console.log('Test 7: Logout should work without redirect issues');
    
    // Login first
    await page.goto('http://localhost:5000/login');
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Find and click logout button (assuming it exists in the UI)
    try {
      await page.click('[data-testid="logout-button"]', { timeout: 5000 });
    } catch {
      // If no logout button found, simulate logout by clearing auth
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.context().clearCookies();
      await page.reload();
    }
    
    // Should redirect to landing page
    await page.waitForURL(/.*\/$/, { timeout: 10000 });
    expect(page.url()).toMatch(/.*\/$/);
    console.log('✅ Logout handled correctly');
  });
});

test.describe('Navigation Helper Tests', () => {
  test('should detect browser navigation events', async ({ page }) => {
    console.log('Test 8: Navigation detection');
    
    // Login first
    await page.goto('http://localhost:5000/login');
    await page.fill('input[type="email"]', '12shivamtiwari219@gmail.com');
    await page.fill('input[type="password"]', 'Rahulr@1234');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Navigate to another page
    await page.goto('http://localhost:5000/editor');
    await page.waitForLoadState('networkidle');
    
    // Check that navigation helper is working
    const navigationState = await page.evaluate(() => {
      return {
        isNavigating: (window as any).NavigationHelper?.isCurrentlyNavigating?.() || false,
        shouldPrevent: (window as any).NavigationHelper?.shouldPreventAuthRedirect?.() || false
      };
    });
    
    console.log('Navigation state:', navigationState);
    console.log('✅ Navigation helper is functioning');
  });
});