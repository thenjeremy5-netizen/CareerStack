import { test as base, expect } from '@playwright/test';

// Test user credentials
export const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
  firstName: 'Test',
  lastName: 'User',
  pseudoName: 'TestUser'
};

// Helper function to login
export async function loginUser(page: any) {
  await page.goto('/login');
  
  // Fill login form
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for successful login - check for dashboard or user menu
  try {
    await page.waitForSelector('[data-testid="button-logout"]', { timeout: 10000 });
  } catch (e) {
    // Alternative: wait for URL change
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  }
}

// Helper function to register user (if needed)
export async function registerUser(page: any) {
  await page.goto('/register');
  
  await page.fill('input[name="email"]', TEST_USER.email);
  await page.fill('input[name="password"]', TEST_USER.password);
  await page.fill('input[name="firstName"]', TEST_USER.firstName);
  await page.fill('input[name="lastName"]', TEST_USER.lastName);
  await page.fill('input[name="pseudoName"]', TEST_USER.pseudoName);
  
  await page.click('button[type="submit"]');
  
  // Wait for registration success
  await page.waitForSelector('text=Registration successful', { timeout: 10000 });
}

export { expect };