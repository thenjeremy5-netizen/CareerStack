import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getCsrfToken } from '@/lib/csrf';
import { useQueryClient } from '@tanstack/react-query';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Helper functions for managing login attempts
const getStoredAttempts = () => {
  try {
    const stored = localStorage.getItem('loginAttempts');
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
};

const setStoredAttempts = (attempts: number) => {
  try {
    localStorage.setItem('loginAttempts', attempts.toString());
  } catch {
    // Ignore errors if localStorage is unavailable
  }
};

const formSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'), // Simplified for login - validation should be on server side
});

type FormData = z.infer<typeof formSchema>;

interface LoginFormProps {
  onForgotPassword?: () => void;
  onSuccess?: () => void;
}

export function LoginForm({ onForgotPassword, onSuccess }: LoginFormProps = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [attemptCount, setAttemptCount] = useState(() => getStoredAttempts());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [requiresVerification, setRequiresVerification] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: FormData) {
    console.log('Login form submitted with data:', {
      email: data.email,
      passwordLength: data.password.length,
    });

    if (attemptCount >= 5) {
      toast({
        variant: 'destructive',
        title: 'Account Locked',
        description: 'Too many failed attempts. Please try again after 15 minutes.',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Get and validate CSRF token
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error('Security token missing. Please refresh the page and try again.');
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include', // Important for handling cookies
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.log('Login error response:', { status: response.status, error });

        if (response.status === 403 && error?.requiresVerification) {
          setRequiresVerification(true);
        }

        // Ensure we throw an error to trigger the catch block
        const errorMessage = error.message || error.error || 'Failed to login';
        throw new Error(errorMessage);
      }

      // Clear attempt count on successful login
      setAttemptCount(0);

      // Hint the app that a fresh login just happened (used by useAuth retry heuristics)
      try {
        localStorage.setItem('lastActiveTime', Date.now().toString());
        // Record the login timestamp for auto-logout enforcement
        localStorage.setItem('rcp_loginAt', Date.now().toString());
        localStorage.removeItem('authErrorHandledAt');
        localStorage.removeItem('authLastRedirectAt');

        // Force refresh the auth query to pick up the new authentication state
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      } catch (e) {}

      // Get any saved redirect URL
      const redirectUrl = localStorage.getItem('redirectAfterLogin');
      localStorage.removeItem('redirectAfterLogin'); // Clear it after reading

      // Clear attempt count on successful login
      setAttemptCount(0);

      // Close dialog if callback provided
      onSuccess?.();

      toast({
        title: 'Welcome back!',
        description: "You've been successfully logged in.",
      });

      // Clear any auth error flags
      localStorage.removeItem('authLoopDetected');
      localStorage.removeItem('lastAuthLoopReset');
      localStorage.removeItem('authErrorHandledAt');
      localStorage.removeItem('lastAuthRedirect');

      // Only redirect to saved URL if it's a public page, otherwise go to dashboard
      const publicPages = ['/', '/privacy'];
      const targetUrl =
        redirectUrl && publicPages.includes(redirectUrl) ? redirectUrl : '/dashboard';

      // Wait for auth state to be fully updated before redirect
      const handleLoginSuccess = async () => {
        try {
          await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          // Additional wait to ensure state is settled
          await new Promise((resolve) => setTimeout(resolve, 500));
          window.location.href = targetUrl;
        } catch (error) {
          console.error('Error updating auth state:', error);
          // Fallback to immediate redirect if query invalidation fails
          window.location.href = targetUrl;
        }
      };
      handleLoginSuccess();
    } catch (error: any) {
      console.error('Login error caught:', error);
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      setStoredAttempts(newAttemptCount);

      let errorMessage = error.message || 'Login failed. Please try again.';
      if (newAttemptCount >= 1) {
        const remainingAttempts = 5 - newAttemptCount;
        errorMessage += ` (${remainingAttempts} attempts remaining)`;
      }

      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
      });

      // Fallback alert for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('Showing error toast:', errorMessage);
      }

      // If this was the fifth failed attempt, set a timeout
      if (attemptCount + 1 >= 5) {
        setTimeout(() => {
          setAttemptCount(0);
          toast({
            title: 'Account Unlocked',
            description: 'You can now try logging in again.',
          });
        }, 15 * 60 * 1000); // 15 minutes
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {requiresVerification && (
          <div className="rounded border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
            Please verify your email address. Didn't receive the email? ;
            <button
              type="button"
              className="font-semibold text-amber-900 hover:underline"
              onClick={async () => {
                const email = form.getValues('email').trim();
                if (!email || !/.+@.+\..+/.test(email)) {
                  toast({
                    variant: 'destructive',
                    title: 'Invalid email',
                    description: 'Enter your email above first.',
                  });
                  return;
                }
                try {
                  // Get CSRF token
                  const csrfToken = getCsrfToken();

                  const res = await fetch('/api/auth/resend-verification', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Requested-With': 'XMLHttpRequest',
                      'X-CSRF-Token': csrfToken || '',
                    },
                    body: JSON.stringify({ email }),
                  });
                  if (!res.ok) {
                    if (res.status === 429) {
                      const retryAfter = res.headers.get('Retry-After');
                      const seconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
                      toast({
                        variant: 'destructive',
                        title: 'Too many requests',
                        description: `Please try again in ${
                          Number.isFinite(seconds) ? seconds + ' seconds' : 'a few seconds'
                        }.`,
                      });
                      return;
                    }
                    const data = await res
                      .json()
                      .catch(() => ({ message: 'Failed to resend verification email' }));
                    throw new Error(data.message || 'Failed to resend verification email');
                  }
                  toast({
                    title: 'Verification email sent',
                    description: 'Please check your inbox (and spam/junk folder).',
                  });
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: e.message || 'Failed to resend verification email',
                  });
                }
              }}
            >
              Resend verification
            </button>
            . Also check your spam folder.
          </div>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your email"
                  autoComplete="email"
                  type="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <LoadingButton
          type="submit"
          className="w-full"
          loading={isLoading}
          loadingText="Logging in..."
          disabled={attemptCount >= 5}
        >
          {attemptCount >= 5 ? 'Too many attempts' : 'Login'}
        </LoadingButton>

        {/* Forgot Password Link */}
        {onForgotPassword && (
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={onForgotPassword}
            >
              Forgot your password?
            </button>
          </div>
        )}
        {attemptCount >= 5 && (
          <p className="text-sm text-red-600 text-center">
            Account temporarily locked. Please try again later.
          </p>
        )}
      </form>
    </Form>
  );
}
