import { test, expect } from '@playwright/test';

test('circuit breaker should not trigger on normal auth flow', async ({ page }) => {
  const consoleMessages: string[] = [];
  
  // Capture console messages
  page.on('console', msg => {
    consoleMessages.push(msg.text());
  });

  // Clear state and test normal flow
  await page.context().clearCookies();
  await page.goto('http://localhost:5000/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Access protected page (should redirect without circuit breaker messages)
  await page.goto('http://localhost:5000/dashboard');
  await page.waitForTimeout(3000);

  // Check for circuit breaker messages
  const circuitBreakerMessages = consoleMessages.filter(msg => 
    msg.includes('circuit breaker opened') || msg.includes('circuit breaker auto-reset')
  );

  console.log('Circuit breaker messages found:', circuitBreakerMessages.length);
  if (circuitBreakerMessages.length > 0) {
    console.log('Messages:', circuitBreakerMessages);
  }

  // Should be 0 circuit breaker messages for normal auth flow
  expect(circuitBreakerMessages.length).toBe(0);
  console.log('✅ No circuit breaker messages - fix successful!');
});