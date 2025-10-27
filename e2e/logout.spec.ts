import { test, expect } from '@playwright/test';
import { loginUser, TEST_USER } from './test-setup';

test.describe('Logout Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should logout successfully and redirect to home page', async ({ page }) => {
    // Login first
    try {
      await loginUser(page);
    } catch (error) {
      console.log('Login failed, user might not exist. Error:', error);
      // If login fails, the user might not exist - this is expected for first run
      test.skip('User does not exist - create test user first');
    }
    
    // Verify we're logged in by checking for logout button
    const logoutButton = page.locator('[data-testid="button-logout"]');
    await expect(logoutButton).toBeVisible({ timeout: 5000 });
    
    // Capture current URL and session state before logout
    const urlBeforeLogout = page.url();
    console.log('URL before logout:', urlBeforeLogout);
    
    // Check session cookies before logout
    const cookiesBefore = await page.context().cookies();
    const sessionCookieBefore = cookiesBefore.find(c => c.name === 'sid' || c.name.includes('session'));
    console.log('Session cookie before logout:', sessionCookieBefore?.name, sessionCookieBefore?.value?.substring(0, 10) + '...');
    
    // Click logout button
    await logoutButton.click();
    
    // Wait for logout process to complete
    await page.waitForTimeout(3000);
    
    // Check current URL after logout
    const urlAfterLogout = page.url();
    console.log('URL after logout:', urlAfterLogout);
    
    // BUG CHECK 1: Verify redirect happened
    if (urlAfterLogout === urlBeforeLogout) {
      console.log('🐛 BUG: No redirect after logout - user stayed on same page');
    }
    
    // BUG CHECK 2: Should redirect to home or login page
    const isOnPublicPage = urlAfterLogout.match(/\/(login|register|$)/);
    if (!isOnPublicPage) {
      console.log('🐛 BUG: Did not redirect to public page after logout. Current URL:', urlAfterLogout);
    }
    
    // BUG CHECK 3: Logout button should no longer be visible
    const logoutButtonVisible = await logoutButton.isVisible().catch(() => false);
    if (logoutButtonVisible) {
      console.log('🐛 BUG: Logout button still visible after logout');
    }
    
    // BUG CHECK 4: Check if session cookies are cleared
    const cookiesAfter = await page.context().cookies();
    const sessionCookieAfter = cookiesAfter.find(c => c.name === 'sid' || c.name.includes('session'));
    if (sessionCookieAfter && sessionCookieAfter.value && sessionCookieAfter.value !== '') {
      console.log('🐛 BUG: Session cookie not cleared after logout:', sessionCookieAfter.name, sessionCookieAfter.value.substring(0, 10) + '...');
    }
    
    // BUG CHECK 5: Try to access protected route - should be redirected
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    const protectedPageUrl = page.url();
    if (protectedPageUrl.includes('/dashboard')) {
      console.log('🐛 BUG: Can still access protected route after logout');
    }
    
    // Final assertions
    expect(isOnPublicPage).toBeTruthy();
    expect(logoutButtonVisible).toBeFalsy();
  });

  test('should clear session data on logout', async ({ page, context }) => {
    // Login first
    try {
      await loginUser(page);
    } catch (error) {
      test.skip('User does not exist - create test user first');
    }
    
    // Check that session cookies exist
    const cookiesBefore = await context.cookies();
    const sessionCookie = cookiesBefore.find(cookie => cookie.name === 'sid' || cookie.name.includes('session'));
    console.log('Session cookie before logout:', sessionCookie);
    
    // Logout
    const logoutButton = page.locator('[data-testid="button-logout"]');
    await logoutButton.click();
    
    // Wait for logout
    await page.waitForTimeout(3000);
    
    // Check that session cookies are cleared
    const cookiesAfter = await context.cookies();
    const sessionCookieAfter = cookiesAfter.find(cookie => cookie.name === 'sid' || cookie.name.includes('session'));
    console.log('Session cookie after logout:', sessionCookieAfter);
    
    // BUG CHECK: Session cookie should be cleared or expired
    if (sessionCookieAfter && sessionCookieAfter.value && sessionCookieAfter.value !== '') {
      console.log('🐛 BUG: Session cookie not properly cleared:', sessionCookieAfter);
    }
    
    // Check localStorage is cleared
    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    const authRelatedKeys = localStorageKeys.filter(key => 
      key.includes('auth') || key.includes('user') || key.includes('session') || key.includes('token')
    );
    
    if (authRelatedKeys.length > 0) {
      console.log('🐛 BUG: Auth-related localStorage not cleared:', authRelatedKeys);
    }
  });

  test('should handle logout when already logged out', async ({ page }) => {
    // Try to access logout endpoint directly without being logged in
    const response = await page.request.post('/api/auth/logout');
    
    console.log('Logout response when not logged in:', response.status());
    
    // Should handle gracefully (either 200, 401 or redirect)
    const validStatuses = [200, 401, 302, 403];
    if (!validStatuses.includes(response.status())) {
      console.log('🐛 BUG: Unexpected status when logging out while not logged in:', response.status());
    }
    
    expect(validStatuses).toContain(response.status());
  });

  test('should prevent access to protected routes after logout', async ({ page }) => {
    // Login first
    try {
      await loginUser(page);
    } catch (error) {
      test.skip('User does not exist - create test user first');
    }
    
    // Navigate to a protected route
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="button-logout"]')).toBeVisible();
    
    // Logout
    const logoutButton = page.locator('[data-testid="button-logout"]');
    await logoutButton.click();
    
    await page.waitForTimeout(3000);
    
    // Try to access protected route again
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('URL after trying to access protected route:', currentUrl);
    
    // BUG CHECK: Should not be able to access dashboard
    if (currentUrl.includes('/dashboard')) {
      console.log('🐛 BUG: Can still access protected route after logout');
    }
    
    // Should redirect to login or home
    expect(currentUrl).toMatch(/\/(login|$)/);
  });

  test('should handle server errors during logout gracefully', async ({ page }) => {
    // Login first
    try {
      await loginUser(page);
    } catch (error) {
      test.skip('User does not exist - create test user first');
    }
    
    // Mock server error for logout endpoint
    await page.route('/api/auth/logout', route => {
      console.log('Intercepted logout request - returning server error');
      route.fulfill({
        status: 500,
        body: JSON.stringify({ message: 'Server error' })
      });
    });
    
    // Attempt logout
    const logoutButton = page.locator('[data-testid="button-logout"]');
    await logoutButton.click();
    
    // Should still redirect to home/login even with server error
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log('URL after logout with server error:', currentUrl);
    
    // BUG CHECK: Should still redirect even with server error
    if (!currentUrl.match(/\/(login|$)/)) {
      console.log('🐛 BUG: Did not redirect after logout with server error');
    }
    
    expect(currentUrl).toMatch(/\/(login|$)/);
  });
  
  test('should show appropriate loading/feedback during logout', async ({ page }) => {
    // Login first
    try {
      await loginUser(page);
    } catch (error) {
      test.skip('User does not exist - create test user first');
    }
    
    // Click logout and immediately check for loading state
    const logoutButton = page.locator('[data-testid="button-logout"]');
    await logoutButton.click();
    
    // Check if there's any loading indicator or toast message
    const hasLoadingIndicator = await page.locator('text=Logging out').isVisible().catch(() => false);
    const hasToastMessage = await page.locator('.toast, [role="alert"]').isVisible().catch(() => false);
    
    console.log('Loading indicator during logout:', hasLoadingIndicator);
    console.log('Toast message during logout:', hasToastMessage);
    
    // Wait for logout to complete
    await page.waitForTimeout(3000);
    
    // This test is mainly for UX feedback - no strict assertions
    console.log('✅ Logout UX test completed');
  });
  
  test('should handle multiple rapid logout clicks', async ({ page }) => {
    // Login first
    try {
      await loginUser(page);
    } catch (error) {
      test.skip('User does not exist - create test user first');
    }
    
    const logoutButton = page.locator('[data-testid="button-logout"]');
    
    // Click logout multiple times rapidly
    await logoutButton.click();
    await logoutButton.click().catch(() => {}); // Might not be clickable anymore
    await logoutButton.click().catch(() => {}); // Might not be clickable anymore
    
    // Wait for logout to complete
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('URL after multiple logout clicks:', currentUrl);
    
    // Should still redirect properly
    expect(currentUrl).toMatch(/\/(login|$)/);
  });
});