// Constants for storage keys
const AUTH_STORAGE_KEYS = {
  ACTIVE_TIME: 'lastActiveTime',
  REDIRECT_PATH: 'redirectAfterLogin',
  AUTH_LOOP: 'authLoopDetected',
  LOOP_RESET: 'lastAuthLoopReset',
  AUTH_REDIRECT: 'lastAuthRedirect',
  REDIRECT_ATTEMPTS: 'authRedirectAttempts',
  GLOBAL_REDIRECT: 'globalAuthRedirect',
  LOGIN_TIME: 'rcp_loginAt',
  PRIVATE_REDIRECT: 'lastPrivateRedirect',
} as const;

class AuthStateManager {
  private cleanupQueue: string[] = [];

  // Initialize storage with default values
  public initialize(): void {
    this.setLastActiveTime(Date.now());
  }

  // Activity tracking
  public setLastActiveTime(time: number): void {
    localStorage.setItem(AUTH_STORAGE_KEYS.ACTIVE_TIME, time.toString());
  }

  public getLastActiveTime(): number {
    return parseInt(localStorage.getItem(AUTH_STORAGE_KEYS.ACTIVE_TIME) || '0');
  }

  // Redirect management
  public setRedirectPath(path: string | null): void {
    if (path) {
      localStorage.setItem(AUTH_STORAGE_KEYS.REDIRECT_PATH, path);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.REDIRECT_PATH);
    }
  }

  public getRedirectPath(): string | null {
    return localStorage.getItem(AUTH_STORAGE_KEYS.REDIRECT_PATH);
  }

  // Auth loop detection
  public markAuthLoop(): void {
    localStorage.setItem(AUTH_STORAGE_KEYS.AUTH_LOOP, 'true');
    localStorage.setItem(AUTH_STORAGE_KEYS.LOOP_RESET, Date.now().toString());
  }

  public clearAuthLoop(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_LOOP);
    localStorage.removeItem(AUTH_STORAGE_KEYS.LOOP_RESET);
  }

  public isAuthLoopDetected(): boolean {
    return localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_LOOP) === 'true';
  }

  // Redirect attempt tracking
  public recordRedirectAttempt(): void {
    const attempts = parseInt(localStorage.getItem(AUTH_STORAGE_KEYS.REDIRECT_ATTEMPTS) || '0');
    localStorage.setItem(AUTH_STORAGE_KEYS.REDIRECT_ATTEMPTS, (attempts + 1).toString());
    localStorage.setItem(AUTH_STORAGE_KEYS.GLOBAL_REDIRECT, Date.now().toString());
  }

  public getRedirectAttempts(): number {
    return parseInt(localStorage.getItem(AUTH_STORAGE_KEYS.REDIRECT_ATTEMPTS) || '0');
  }

  // Clean up auth state
  public clearAuthState(): void {
    Object.values(AUTH_STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });

    // Clear any items in cleanup queue
    this.cleanupQueue.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    this.cleanupQueue = [];
  }

  // Add items to cleanup queue
  public addToCleanup(key: string): void {
    if (!this.cleanupQueue.includes(key)) {
      this.cleanupQueue.push(key);
    }
  }
}

export const authStateManager = new AuthStateManager();