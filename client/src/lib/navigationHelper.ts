// Navigation helper to preserve auth state during browser navigation
export class NavigationHelper {
  private static isNavigating = false;
  private static navigationTimer: NodeJS.Timeout | null = null;
  private static lastNavigationTime = 0;

  static markNavigationStart() {
    this.isNavigating = true;
    this.lastNavigationTime = Date.now();
    
    // Clear any existing timer
    if (this.navigationTimer) {
      clearTimeout(this.navigationTimer);
    }
    
    // Mark navigation as complete after a short delay
    this.navigationTimer = setTimeout(() => {
      this.isNavigating = false;
    }, 1000); // Increased to 1 second for better stability
  }

  static isCurrentlyNavigating(): boolean {
    return this.isNavigating;
  }

  static shouldPreventAuthRedirect(): boolean {
    // Don't redirect during navigation or shortly after (within 2 seconds)
    const timeSinceNavigation = Date.now() - this.lastNavigationTime;
    return this.isNavigating || timeSinceNavigation < 2000;
  }

  static reset() {
    this.isNavigating = false;
    this.lastNavigationTime = 0;
    if (this.navigationTimer) {
      clearTimeout(this.navigationTimer);
      this.navigationTimer = null;
    }
  }
}

// Listen for browser navigation events
if (typeof window !== 'undefined') {
  // Mark navigation start on popstate (back/forward buttons)
  window.addEventListener('popstate', () => {
    console.log('Navigation detected: popstate');
    NavigationHelper.markNavigationStart();
  });
  
  // Mark navigation start on beforeunload
  window.addEventListener('beforeunload', () => {
    NavigationHelper.markNavigationStart();
  });
  
  // Also listen for pushstate/replacestate (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    NavigationHelper.markNavigationStart();
    return originalPushState.apply(this, args);
  };
  
  history.replaceState = function(...args) {
    NavigationHelper.markNavigationStart();
    return originalReplaceState.apply(this, args);
  };
}
