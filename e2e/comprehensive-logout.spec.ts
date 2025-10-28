import { test, expect, Page, BrowserContext } from '@playwright/test';

const TEST_USER = {
  email: '12shivamtiwari219@gmail.com',
  password: 'Rahulr@1234'
};

// Helper to login manually
async function loginUser(page: Page) {
  // Navigate to login page and wait for it to load
  await page.goto('http://localhost:5000/login', { waitUntil: 'networkidle' });
  
  // Wait for key form elements with a 5 second timeout
  await Promise.all([
    page.waitForSelector('input[type="email"]', { timeout: 5000 }),
    page.waitForSelector('input[type="password"]', { timeout: 5000 }),
    page.waitForSelector('button[type="submit"]', { timeout: 5000 })
  ]);
  
  // Fill form and submit
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  
  // Click submit and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }),
    page.click('button[type="submit"]')
  ]);
  
  // Additional wait for client-side rendering
  await page.waitForTimeout(1000);
}

test.describe('Comprehensive Logout Bug Detection', () => {
  
  test('🔍 Complete logout flow analysis', async ({ page, context }) => {
    console.log('\n=== STARTING COMPREHENSIVE LOGOUT BUG ANALYSIS ===\n');
    
    // Step 1: Login
    console.log('1. Testing login...');
    try {
      await loginUser(page);
      const currentUrl = page.url();
      console.log('✅ Login successful, URL:', currentUrl);
      
      if (!currentUrl.includes('dashboard') && !currentUrl.includes('home')) {
        console.log('🐛 BUG: Login did not redirect to expected page');
      }
    } catch (error) {
      console.log('❌ Login failed:', error);
      return;
    }

    // Step 2: Check session state before logout
    console.log('\n2. Analyzing session state before logout...');
    const cookiesBefore = await context.cookies();
    const sessionCookie = cookiesBefore.find(c => c.name === 'sid');
    const csrfCookie = cookiesBefore.find(c => c.name === 'csrf_token');
    
    console.log('Session cookie exists:', !!sessionCookie);
    console.log('CSRF cookie exists:', !!csrfCookie);
    
    if (!sessionCookie) {
      console.log('🐛 BUG: No session cookie found after login');
    }

    // Step 3: Check localStorage before logout
    const localStorageBefore = await page.evaluate(() => {
      return {
        keys: Object.keys(localStorage),
        authKeys: Object.keys(localStorage).filter(k => 
          k.includes('auth') || k.includes('user') || k.includes('session') || k.includes('token')
        )
      };
    });
    console.log('LocalStorage keys before logout:', localStorageBefore.keys.length);
    console.log('Auth-related keys:', localStorageBefore.authKeys);

    // Step 4: Test logout button visibility and functionality
    console.log('\n3. Testing logout button...');
    const logoutButton = page.locator('[data-testid="button-logout"]');
    const isLogoutVisible = await logoutButton.isVisible();
    console.log('Logout button visible:', isLogoutVisible);
    
    if (!isLogoutVisible) {
      console.log('🐛 BUG: Logout button not visible when logged in');
      return;
    }

    // Step 5: Monitor network requests during logout
    console.log('\n4. Monitoring logout network requests...');
    const networkRequests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/logout')) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
      }
    });

    page.on('response', response => {
      if (response.url().includes('/logout')) {
        console.log('Logout response status:', response.status());
        console.log('Logout response headers:', response.headers());
      }
    });

    // Step 6: Perform logout
    console.log('\n5. Performing logout...');
    const urlBeforeLogout = page.url();
    await logoutButton.click();
    
    // Wait and monitor the logout process
    await page.waitForTimeout(5000);
    
    const urlAfterLogout = page.url();
    console.log('URL before logout:', urlBeforeLogout);
    console.log('URL after logout:', urlAfterLogout);

    // Step 7: Check if redirect happened
    if (urlBeforeLogout === urlAfterLogout) {
      console.log('🐛 BUG: No redirect after logout');
    }

    if (!urlAfterLogout.match(/\/(login|register|$)/)) {
      console.log('🐛 BUG: Did not redirect to public page. Current URL:', urlAfterLogout);
    }

    // Step 8: Check session cleanup
    console.log('\n6. Checking session cleanup...');
    const cookiesAfter = await context.cookies();
    const sessionCookieAfter = cookiesAfter.find(c => c.name === 'sid');
    const csrfCookieAfter = cookiesAfter.find(c => c.name === 'csrf_token');
    
    console.log('Session cookie after logout:', sessionCookieAfter?.value?.substring(0, 10) + '...' || 'CLEARED');
    console.log('CSRF cookie after logout:', csrfCookieAfter?.value?.substring(0, 10) + '...' || 'CLEARED');

    if (sessionCookieAfter && sessionCookieAfter.value) {
      console.log('🐛 BUG: Session cookie not cleared after logout');
    }

    // Step 9: Check localStorage cleanup
    const localStorageAfter = await page.evaluate(() => {
      return {
        keys: Object.keys(localStorage),
        authKeys: Object.keys(localStorage).filter(k => 
          k.includes('auth') || k.includes('user') || k.includes('session') || k.includes('token')
        )
      };
    });
    
    console.log('LocalStorage keys after logout:', localStorageAfter.keys.length);
    console.log('Auth-related keys after logout:', localStorageAfter.authKeys);

    if (localStorageAfter.authKeys.length > 0) {
      console.log('🐛 BUG: Auth-related localStorage not cleared:', localStorageAfter.authKeys);
    }

    // Step 10: Test protected route access
    console.log('\n7. Testing protected route access after logout...');
    await page.goto('http://localhost:5000/dashboard');
    await page.waitForTimeout(2000);
    
    const protectedUrl = page.url();
    console.log('URL after accessing protected route:', protectedUrl);
    
    if (protectedUrl.includes('/dashboard')) {
      console.log('🐛 BUG: Can still access protected route after logout');
    }

    // Step 11: Test logout button visibility after logout
    const logoutButtonAfter = await page.locator('[data-testid="button-logout"]').isVisible().catch(() => false);
    if (logoutButtonAfter) {
      console.log('🐛 BUG: Logout button still visible after logout');
    }

    // Step 12: Test double logout
    console.log('\n8. Testing double logout scenario...');
    const response = await page.request.post('http://localhost:5000/api/auth/logout');
    console.log('Double logout response status:', response.status());
    
    if (![200, 401, 403].includes(response.status())) {
      console.log('🐛 BUG: Unexpected response for double logout:', response.status());
    }

    console.log('\n=== LOGOUT BUG ANALYSIS COMPLETE ===\n');
  });

  test('🔄 Race condition and timing bugs', async ({ page, context }) => {
    console.log('\n=== TESTING RACE CONDITIONS ===\n');
    
    await loginUser(page);
    
    // Test rapid multiple clicks
    console.log('1. Testing rapid multiple logout clicks...');
    const logoutButton = page.locator('[data-testid="button-logout"]');
    
    // Click multiple times rapidly
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(logoutButton.click().catch(() => {}));
    }
    
    await Promise.all(promises);
    await page.waitForTimeout(3000);
    
    const finalUrl = page.url();
    console.log('Final URL after rapid clicks:', finalUrl);
    
    if (!finalUrl.match(/\/(login|register|$)/)) {
      console.log('🐛 BUG: Race condition in logout - did not redirect properly');
    }
  });

  test('🌐 Network failure scenarios', async ({ page, context }) => {
    console.log('\n=== TESTING NETWORK FAILURE SCENARIOS ===\n');
    
    await loginUser(page);
    
    // Test server error during logout
    console.log('1. Testing server error during logout...');
    await page.route('**/api/auth/logout', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ message: 'Server error' })
      });
    });
    
    const logoutButton = page.locator('[data-testid="button-logout"]');
    await logoutButton.click();
    await page.waitForTimeout(3000);
    
    const urlAfterServerError = page.url();
    console.log('URL after server error:', urlAfterServerError);
    
    if (!urlAfterServerError.match(/\/(login|register|$)/)) {
      console.log('🐛 BUG: Did not handle server error gracefully during logout');
    }
    
    // Check if local cleanup still happened
    const localStorageAfterError = await page.evaluate(() => Object.keys(localStorage));
    console.log('LocalStorage keys after server error:', localStorageAfterError.length);
  });

  test('🔒 Security edge cases', async ({ page, context }) => {
    console.log('\n=== TESTING SECURITY EDGE CASES ===\n');
    
    await loginUser(page);
    
    // Test CSRF token handling
    console.log('1. Testing CSRF token handling...');
    
    // Clear CSRF cookie and try logout
    await context.clearCookies();
    await context.addCookies([{
      name: 'sid',
      value: 'fake-session-id',
      domain: 'localhost',
      path: '/'
    }]);
    
    const logoutButton = page.locator('[data-testid="button-logout"]');
    await logoutButton.click();
    await page.waitForTimeout(3000);
    
    console.log('Logout with invalid CSRF completed');
    
    // Test session hijacking scenario
    console.log('2. Testing session persistence after logout...');
    
    // Try to make authenticated request after logout
    const response = await page.request.get('http://localhost:5000/api/auth/user');
    console.log('Auth check after logout status:', response.status());
    
    if (response.status() === 200) {
      console.log('🐛 BUG: Session still valid after logout - potential security issue');
    }
  });
});