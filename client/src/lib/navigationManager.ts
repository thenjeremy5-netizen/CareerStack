const DEBOUNCE_TIME = 2000; // 2 seconds
const NAVIGATION_WINDOW = 500; // 500ms navigation window

class NavigationManager {
  private lastRedirectTime: number = 0;
  private navigationStartTime: number = 0;
  private redirectInProgress: boolean = false;

  public markNavigationStart(): void {
    this.navigationStartTime = Date.now();
  }

  public isWithinNavigationWindow(): boolean {
    return Date.now() - this.navigationStartTime < NAVIGATION_WINDOW;
  }

  public canRedirect(): boolean {
    const now = Date.now();
    if (this.redirectInProgress) return false;
    if (this.isWithinNavigationWindow()) return false;
    if (now - this.lastRedirectTime < DEBOUNCE_TIME) return false;
    return true;
  }

  public markRedirect(): void {
    this.lastRedirectTime = Date.now();
    this.redirectInProgress = true;
    setTimeout(() => {
      this.redirectInProgress = false;
    }, DEBOUNCE_TIME);
  }

  public reset(): void {
    this.lastRedirectTime = 0;
    this.navigationStartTime = 0;
    this.redirectInProgress = false;
  }
}

export const navigationManager = new NavigationManager();

// Set up navigation event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => navigationManager.markNavigationStart());
  window.addEventListener('beforeunload', () => navigationManager.reset());
}