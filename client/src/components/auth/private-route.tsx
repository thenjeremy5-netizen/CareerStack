import React from 'react';
import { Route } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { NavigationHelper } from '@/lib/navigationHelper';

interface PrivateRouteProps {
  path: string;
  component: React.ComponentType<any>;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ path, component: Component }) => {
  const { isAuthenticated, isLoading, isAuthChecked, error } = useAuth();
  const [, setLocation] = useLocation();
  const [hasRedirected, setHasRedirected] = React.useState(false);
  
  // Redirect logic that respects navigation and doesn't interfere with back button
  React.useEffect(() => {
    // Check if we should redirect - either auth is checked and user not authenticated,
    // or circuit breaker is open (which means we can't verify auth)
    const shouldRedirect = (isAuthChecked && !isAuthenticated) || 
                          (error?.message === 'CIRCUIT_BREAKER_OPEN');
    
    if (shouldRedirect && !hasRedirected) {
      // Don't redirect during navigation (back button, etc.)
      if (NavigationHelper.shouldPreventAuthRedirect()) {
        return;
      }
      
      const currentPath = window.location.pathname;
      
      // More conservative throttling - don't redirect if we just did
      const lastRedirect = localStorage.getItem('lastPrivateRedirect');
      const now = Date.now();
      
      // Throttle redirects to prevent loops (2 second cooldown)
      if (!lastRedirect || (now - parseInt(lastRedirect)) > 2000) {
        localStorage.setItem('lastPrivateRedirect', now.toString());
        // Don't store redirect path for dashboard to prevent redirect loops
        if (currentPath !== '/dashboard') {
          localStorage.setItem('redirectAfterLogin', currentPath);
        }
        setHasRedirected(true);
        setLocation('/login');
      }
    }
  }, [isAuthenticated, isAuthChecked, hasRedirected, setLocation, error]);

  return (
    <Route
      path={path}
      component={(props) => {
        // Fast path: if we know user is authenticated, render immediately
        if (isAuthenticated) {
          return <Component {...props} />;
        }
        
        // If circuit breaker is open, show loader and redirect
        if (error?.message === 'CIRCUIT_BREAKER_OPEN') {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          );
        }
        
        // Show minimal loader while checking auth
        if (isLoading || !isAuthChecked) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          );
        }

        // If auth is checked and user is not authenticated, show loader while redirecting
        if (!isAuthenticated) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          );
        }

        return <Component {...props} />;
      }}
    />
  );
};
