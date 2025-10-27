import { FC, ComponentType } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useNavigationGuard } from '@/lib/navigation';
import { PageLoader } from '@/components/ui/page-loader';

interface PrivateRouteProps {
  component: ComponentType<any>;
  path: string;
}

export const GuardedPrivateRoute: FC<PrivateRouteProps> = ({ component: Component, ...rest }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { guardedNavigate, isBlocked } = useNavigationGuard();

  if (isLoading) {
    return <PageLoader variant="branded" text="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    if (!isBlocked && guardedNavigate('/login')) {
      return <Redirect to="/login" />;
    }
    // If navigation is blocked, show a loader
    return <PageLoader variant="branded" text="Please wait..." />;
  }

  return <Component {...rest} />;
};
