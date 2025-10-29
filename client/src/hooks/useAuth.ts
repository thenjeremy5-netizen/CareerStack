import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { clearAllClientAuthData } from '@/lib/clearAuthData';
import { authCircuitBreaker } from '@/lib/authCircuitBreaker';
import { authGlobalState } from '@/lib/authGlobalState';

export interface User {
  id: string;
  email: string;
  pseudoName?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role?: string; // 'user' | 'marketing' | 'admin'
  createdAt: string;
  updatedAt: string;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDisabled, setIsDisabled] = React.useState(false);
  
  // Check if we should prevent auth requests (but don't return early)
  const shouldPreventAuth = authCircuitBreaker.isCircuitOpen() || authGlobalState.shouldPreventAuthRequest();

  // Cache key for unauthorized status
  const unauthorizedCacheKey = 'auth:unauthorized';
  const unauthorizedUntil = React.useRef<number>(0);

  // Track critical errors that should be reported
  const [criticalError, setCriticalError] = React.useState<Error | null>(null);

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        // Check if we're in unauthorized cooldown
        if (Date.now() < unauthorizedUntil.current) {
          throw new Error("UNAUTHORIZED");
        }

        // Record that we're making an auth request
        authGlobalState.recordAuthRequest();

        const response = await fetch("/api/auth/user", {
          credentials: "include",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Cache-Control": "no-cache"
          },
          redirect: 'manual' // Don't follow redirects automatically
        });

        // Handle redirects manually
        if (response.status === 302 || response.status === 301) {
          // Set unauthorized cooldown for 5 seconds
          unauthorizedUntil.current = Date.now() + 5000;
          throw new Error("UNAUTHORIZED");
        }

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // Set unauthorized cooldown for 5 seconds
            unauthorizedUntil.current = Date.now() + 5000;
            throw new Error("UNAUTHORIZED");
          }
          if (response.status === 404) {
            throw new Error("USER_NOT_FOUND");
          }
          throw new Error(`HTTP_${response.status}`);
        }

        const data = await response.json();
        authCircuitBreaker.recordSuccess();

        // Clear unauthorized status and auth loop flags on successful authentication
        unauthorizedUntil.current = 0;
        localStorage.removeItem('authLoopDetected');
        localStorage.removeItem('lastAuthLoopReset');
        localStorage.removeItem('lastAuthRedirect');
        localStorage.removeItem('lastPrivateRedirect');
        
        return data as User;
      } catch (error: any) {
        // For network errors, throw a specific error
        if (error.name === 'AbortError' || error.message === 'Failed to fetch') {
          throw new Error("NETWORK_ERROR");
        }
        
        // Record failures for network errors only
        if (error.message === 'NETWORK_ERROR') {
          authCircuitBreaker.recordFailure();
        }

        // Cache unauthorized status
        if (error.message === 'UNAUTHORIZED') {
          localStorage.setItem(unauthorizedCacheKey, 'true');
          // Clear after 5 seconds
          setTimeout(() => localStorage.removeItem(unauthorizedCacheKey), 5000);
        }
        
        throw error;
      }
    },
    retry: false, // Disable retries completely
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchOnMount: false, // Don't refetch on mount
    enabled: !isDisabled && 
             !shouldPreventAuth && 
             !localStorage.getItem(unauthorizedCacheKey), // Don't run if recently unauthorized
  });

  // Simplified error handling to prevent loops
  // Use a ref to track if we're already handling a redirect
  const isHandlingRedirect = React.useRef(false);

  React.useEffect(() => {
    if (error?.message === 'UNAUTHORIZED' && !isHandlingRedirect.current) {
      const path = window.location.pathname;
      const onAuthPages = ['/login', '/register', '/verify-email', '/', '/privacy'].includes(path);
      
      // Only handle unauthorized on non-auth pages
      if (!onAuthPages) {
        isHandlingRedirect.current = true;
        
        // Immediately disable query and clear state
        setIsDisabled(true);
        queryClient.setQueryData(["/api/auth/user"], null);
        
        // Save redirect path for non-dashboard pages
        if (path !== '/dashboard') {
          localStorage.setItem('redirectAfterLogin', path);
        } else {
          localStorage.removeItem('redirectAfterLogin');
        }

        // Implement throttled redirect with backoff
        const redirectAttempts = parseInt(localStorage.getItem('authRedirectAttempts') || '0');
        const now = Date.now();
        const lastRedirect = parseInt(localStorage.getItem('globalAuthRedirect') || '0');
        const backoffTime = Math.min(5000 * Math.pow(2, redirectAttempts), 30000); // Max 30s backoff

        if (now - lastRedirect > backoffTime) {
          // Increment redirect attempts
          localStorage.setItem('authRedirectAttempts', (redirectAttempts + 1).toString());
          localStorage.setItem('globalAuthRedirect', now.toString());
          
          // Clear attempts after 1 minute of no redirects
          setTimeout(() => {
            localStorage.removeItem('authRedirectAttempts');
          }, 60000);

          window.location.href = '/login';
        }

        // Reset handling flag after max backoff time
        setTimeout(() => {
          isHandlingRedirect.current = false;
        }, backoffTime);
      }
    }
  }, [error, queryClient]);

  // Define clearLocalSession outside of logout to make it reusable
  const clearLocalSession = async () => {
    try {
      queryClient.clear();
      
      // Clear all auth-related localStorage
      const keysToRemove = Object.keys(localStorage).filter(key =>
        key.includes('auth') || 
        key.includes('user') || 
        key.includes('session') || 
        key.includes('token') ||
        key.includes('lastActiveTime') ||
        key.includes('rcp_') ||
        key.includes('lastAuthRedirect') ||
        key.includes('authLoopDetected') ||
        key.includes('lastAuthLoopReset')
      );
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear session storage
      sessionStorage.clear();
      
      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      await clearAllClientAuthData({ preservePreferences: true });
    } catch (e) {
      console.error('Error clearing local session:', e);
      // Fallback cleanup
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
    }
  };

  const logout = async () => {
    try {
      // Immediately disable queries to prevent flashing
      setIsDisabled(true);
      queryClient.setQueryData(["/api/auth/user"], null);
      
      // Show logout message
      toast({
        title: "Logging out...",
        description: "Please wait a moment.",
        duration: 1000,
      });

      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      // Clear local session first to prevent UI flashing
      await clearLocalSession();
      
      // Clear all queries immediately
      queryClient.clear();

      // Call server logout in the background
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || "",
          },
          signal: controller.signal,
        });
      } catch (serverError) {
        console.warn("Server logout failed:", serverError);
      } finally {
        clearTimeout(timeoutId);
      }

      // Set a flag to prevent re-renders during navigation
      localStorage.setItem('isLoggingOut', 'true');
      
      // Redirect to home page
      window.location.replace("/");
      
    } catch (error) {
      console.error("Logout error:", error);
      
      // Selective cleanup on error - only clear auth-related data
      const authKeys = [
        'lastActiveTime',
        'redirectAfterLogin',
        'authLoopDetected',
        'lastAuthLoopReset',
        'lastAuthRedirect',
        'authRedirectAttempts',
        'globalAuthRedirect',
        'loginAttempts',
        'rcp_loginAt'
      ];
      authKeys.forEach(key => localStorage.removeItem(key));
      
      // Clear auth-related session storage
      Object.keys(sessionStorage)
        .filter(key => key.includes('auth') || key.includes('token'))
        .forEach(key => sessionStorage.removeItem(key));
      
      // Clear only auth-related queries
      queryClient.removeQueries({ queryKey: ["/api/auth/user"] });
      
      // Redirect using replace to prevent history entry
      window.location.replace("/");
    }
  };

  const refreshUser = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error) {
      console.error("Error refreshing user data:", error);
      toast({
        variant: "destructive",
        title: "Refresh Error",
        description: "Failed to refresh user data. Please try again.",
      });
    }
  };

  // Add an interval to check session activity
  React.useEffect(() => {
    const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes (match server session)
    const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minute

    // Check for existing session immediately
    const lastActiveTime = localStorage.getItem("lastActiveTime");
    if (lastActiveTime) {
      const inactiveTime = Date.now() - parseInt(lastActiveTime);
      if (inactiveTime > SESSION_TIMEOUT) {
        logout();
        return;
      }
    }

    // Only continue setting up listeners if user is authenticated
    if (!user) {
      return;
    }

    const checkSessionActivity = () => {
      const lastActiveTime = localStorage.getItem("lastActiveTime");
      if (lastActiveTime) {
        const inactiveTime = Date.now() - parseInt(lastActiveTime);
        if (inactiveTime > SESSION_TIMEOUT) {
          logout();
        }
      }
    };

    // Update last active time on user interaction
    const updateLastActiveTime = () => {
      localStorage.setItem("lastActiveTime", Date.now().toString());
    };

    // Set up activity listeners
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(event => {
      window.addEventListener(event, updateLastActiveTime);
    });

    // Initial setup - reset activity time for fresh authentication
    updateLastActiveTime();

    // Set up interval check
    const interval = setInterval(checkSessionActivity, ACTIVITY_CHECK_INTERVAL);

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateLastActiveTime);
      });
      clearInterval(interval);
    };
  }, [user]); // Depend on user so it resets when authentication state changes

  // Handle non-auth errors with recovery logic
  React.useEffect(() => {
    if (error && error.message !== 'UNAUTHORIZED' && error.message !== 'CIRCUIT_BREAKER_OPEN') {
      // Define recoverable errors
      const recoverableErrors = ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR'];
      const isRecoverable = recoverableErrors.some(e => error.message.includes(e));

      if (isRecoverable) {
        // Implement exponential backoff for retries
        const retryCount = parseInt(localStorage.getItem('authRetryCount') || '0');
        const maxRetries = 3;
        
        if (retryCount < maxRetries) {
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
          localStorage.setItem('authRetryCount', (retryCount + 1).toString());
          
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          }, backoffTime);
          
          return;
        }
        
        // Clear retry count after max retries or successful auth
        localStorage.removeItem('authRetryCount');
      }

      // For non-recoverable errors, report with context
      const errorWithContext = new Error(`Authentication Error: ${error.message}`);
      errorWithContext.stack = `${error.stack}\n\nContext:\nURL: ${window.location.href}\nTimestamp: ${new Date().toISOString()}\nUser Agent: ${navigator.userAgent}\nRetry Count: ${localStorage.getItem('authRetryCount') || '0'}`;
      
      // Report error through the provided mechanism
      reportError(errorWithContext);
    }
  }, [error, queryClient]);

  // If auth is prevented by circuit breaker, return unauthenticated state
  if (shouldPreventAuth) {
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAuthChecked: true,
      error: { message: 'CIRCUIT_BREAKER_OPEN' } as any,
      logout: async () => {},
      refreshUser: async () => {},
    };
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAuthChecked: !isLoading && (!!user || !!error),
    error,
    logout,
    refreshUser,
    reportError: async (errorToReport: Error) => {
      try {
        const response = await fetch('/api/error-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            errorMessage: errorToReport.message,
            errorStack: errorToReport.stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            userId: user?.id,
            userEmail: user?.email,
          }),
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to submit error report');
        }
      } catch (e) {
        console.error('Failed to submit error report:', e);
        throw e;
      }
    },
  };
}

