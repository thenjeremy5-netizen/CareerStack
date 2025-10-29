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
  const navigationManager = React.useMemo(() => new NavigationHelper(), []);

  // Redirect logic that respects navigation and doesn't interfere with back button
  React.useEffect(() => {
    // Check if we should redirect - either auth is checked and user not authenticated,
    // or circuit breaker is open (which means we can't verify auth)
    const shouldRedirect =
      (isAuthChecked && !isAuthenticated) || error?.message === 'CIRCUIT_BREAKER_OPEN';

    if (shouldRedirect && !hasRedirected) {
      const currentPath = window.location.pathname;

      // Use the navigation manager to handle redirect timing
      // Simple redirect without timing checks
      localStorage.setItem('redirectAfterLogin', currentPath !== '/dashboard' ? currentPath : '');
      setHasRedirected(true);
      setLocation('/login');
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

        // Show minimal loader only during initial auth check
        if (isLoading && !isAuthChecked) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          );
        }

        // If not authenticated or error, redirect without showing loader
        return null;
      }}
    />
  );
};
