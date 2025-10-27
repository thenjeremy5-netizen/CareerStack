import { test, expect, Page } from '@playwright/test';

async function loginAndNavigate(page: Page) {
  // Go to login page
  await page.goto('http://localhost:5000/login');
  
  // Fill login form
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'testpassword123');
  
  // Submit login
  await page.click('button[type="submit"]');
  
  // Wait for login to process
  await page.waitForTimeout(5000);
  
  // Check if we're redirected to dashboard
  const currentUrl = page.url();
  console.log('Current URL after login:', currentUrl);
  
  // If still on login page, try to navigate to dashboard manually
  if (currentUrl.includes('/login')) {
    console.log('Still on login page, navigating to dashboard manually...');
    await page.goto('http://localhost:5000/dashboard');
    await page.waitForTimeout(3000);
  }
  
  return page.url();
}

test.describe('Focused Logout Bug Analysis', () => {
  
  test('🎯 Identify exact logout bugs', async ({ page, context }) => {
    console.log('\n=== FOCUSED LOGOUT BUG ANALYSIS ===\n');
    
    // Step 1: Login and get to authenticated state
    console.log('1. Attempting login...');
    const finalUrl = await loginAndNavigate(page);
    console.log('Final URL after login process:', finalUrl);
    
    // Step 2: Check authentication state
    console.log('\n2. Checking authentication state...');
    
    // Check for any logout button on the page
    const allButtons = await page.locator('button').allTextContents();
    const allLinks = await page.locator('a').allTextContents();
    console.log('All buttons on page:', allButtons);
    console.log('All links on page:', allLinks);
    
    // Look for logout elements with different selectors
    const logoutSelectors = [
      '[data-testid="button-logout"]',
      'button:has-text("Logout")',
      'button:has-text("Log out")',
      'a:has-text("Logout")',
      'a:has-text("Log out")',
      '[aria-label*="logout" i]',
      '[title*="logout" i]'
    ];
    
    let logoutElement = null;
    for (const selector of logoutSelectors) {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible().catch(() => false);
      console.log(`Selector "${selector}" visible:`, isVisible);
      if (isVisible) {
        logoutElement = element;
        break;
      }
    }
    
    if (!logoutElement) {
      console.log('🐛 CRITICAL BUG: No logout button found anywhere on the page');
      
      // Check if we're actually logged in by checking cookies
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'sid');
      console.log('Session cookie exists:', !!sessionCookie);
      
      if (sessionCookie) {
        console.log('🐛 BUG: User has session cookie but no logout button visible');
      } else {
        console.log('🐛 BUG: No session cookie - login may have failed');
      }
      
      // Try to access user info endpoint
      const userResponse = await page.request.get('http://localhost:5000/api/auth/user');
      console.log('User endpoint status:', userResponse.status());
      
      if (userResponse.status() === 200) {
        const userData = await userResponse.json();
        console.log('User data:', userData);
        console.log('🐛 BUG: User is authenticated but UI doesn\'t show logout button');
      }
      
      return;
    }
    
    // Step 3: Test logout functionality
    console.log('\n3. Testing logout...');
    console.log('Found logout element, clicking...');
    
    // Monitor network requests
    const logoutRequests: any[] = [];
    page.on('request', req => {
      if (req.url().includes('/logout')) {
        logoutRequests.push({
          url: req.url(),
          method: req.method(),
          headers: req.headers()
        });
      }
    });
    
    page.on('response', res => {
      if (res.url().includes('/logout')) {
        console.log('Logout response:', res.status(), res.statusText());
      }
    });
    
    // Get state before logout
    const urlBefore = page.url();
    const cookiesBefore = await context.cookies();
    const sessionBefore = cookiesBefore.find(c => c.name === 'sid');
    
    console.log('URL before logout:', urlBefore);
    console.log('Session before logout:', sessionBefore?.value?.substring(0, 10) + '...');
    
    // Perform logout
    await logoutElement.click();
    
    // Wait for logout to complete
    await page.waitForTimeout(5000);
    
    // Check state after logout
    const urlAfter = page.url();
    const cookiesAfter = await context.cookies();
    const sessionAfter = cookiesAfter.find(c => c.name === 'sid');
    
    console.log('\n4. Post-logout analysis...');
    console.log('URL after logout:', urlAfter);
    console.log('Session after logout:', sessionAfter?.value?.substring(0, 10) + '...' || 'CLEARED');
    console.log('Logout requests made:', logoutRequests.length);
    
    // Bug checks
    if (urlBefore === urlAfter) {
      console.log('🐛 BUG: No URL change after logout');
    }
    
    if (!urlAfter.match(/\/(login|register|$)/)) {
      console.log('🐛 BUG: Did not redirect to public page after logout');
    }
    
    if (sessionAfter && sessionAfter.value && sessionAfter.value !== '') {
      console.log('🐛 BUG: Session cookie not cleared after logout');
    }
    
    if (logoutRequests.length === 0) {
      console.log('🐛 BUG: No logout request was made to server');
    }
    
    // Test protected route access
    console.log('\n5. Testing protected route access...');
    await page.goto('http://localhost:5000/dashboard');
    await page.waitForTimeout(2000);
    
    const protectedUrl = page.url();
    console.log('URL after accessing protected route:', protectedUrl);
    
    if (protectedUrl.includes('/dashboard')) {
      console.log('🐛 BUG: Can still access protected route after logout');
    }
    
    // Test authentication endpoint
    const authCheck = await page.request.get('http://localhost:5000/api/auth/user');
    console.log('Auth check status after logout:', authCheck.status());
    
    if (authCheck.status() === 200) {
      console.log('🐛 BUG: Still authenticated according to server after logout');
    }
    
    console.log('\n=== LOGOUT BUG ANALYSIS COMPLETE ===\n');
  });
});