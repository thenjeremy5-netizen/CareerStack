// Simple circuit breaker to prevent infinite auth loops
class AuthCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private isOpen = false;
  private readonly maxFailures = 10; // Much higher threshold
  private readonly resetTimeout = 2000; // Quick reset

  shouldAllowRequest(): boolean {
    const now = Date.now();
    
    // Reset if enough time has passed
    if (this.isOpen && (now - this.lastFailureTime) > this.resetTimeout) {
      this.reset();
    }
    
    return !this.isOpen;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Only trigger for truly excessive failures
    if (this.failureCount >= this.maxFailures) {
      this.isOpen = true;
      console.warn('Auth circuit breaker opened - excessive failures detected');
      // Auto-reset quickly
      setTimeout(() => {
        this.reset();
      }, this.resetTimeout);
    }
  }

  recordSuccess(): void {
    this.reset();
  }

  reset(): void {
    this.failureCount = 0;
    this.isOpen = false;
    this.lastFailureTime = 0;
  }

  isCircuitOpen(): boolean {
    return this.isOpen;
  }
}

export const authCircuitBreaker = new AuthCircuitBreaker();
