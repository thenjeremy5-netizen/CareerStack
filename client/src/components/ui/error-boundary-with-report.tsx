import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import { ErrorReportDialog } from '../error-report/error-report-dialog';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  isReportDialogOpen: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundaryWithReport extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isReportDialogOpen: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    // Log error details for debugging
    try {
      const errorLog = {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      };

      // Store error in localStorage for debugging
      const existingErrors = JSON.parse(localStorage.getItem('appErrors') || '[]');
      existingErrors.push(errorLog);
      // Keep only the last 10 errors
      const recentErrors = existingErrors.slice(-10);
      localStorage.setItem('appErrors', JSON.stringify(recentErrors));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleOpenReport = () => {
    this.setState({ isReportDialogOpen: true });
  };

  handleCloseReport = () => {
    this.setState({ isReportDialogOpen: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <>
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full mx-auto p-6">
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="flex justify-center mb-4">
                  <AlertTriangle className="h-12 w-12 text-red-500" />
                </div>

                <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>

                <p className="text-gray-600 mb-6">
                  We encountered an unexpected error. You can help us fix this by reporting the
                  issue.
                </p>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-left">
                    <p className="text-sm font-mono text-red-800 break-all">
                      {this.state.error.message}
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={this.handleReset}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>

                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>

                  <Button onClick={this.handleOpenReport} className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Report Issue
                  </Button>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Your feedback helps us improve the application.
                </p>
              </div>
            </div>
          </div>

          <ErrorReportDialog
            isOpen={this.state.isReportDialogOpen}
            onClose={this.handleCloseReport}
            error={this.state.error}
            componentStack={this.state.errorInfo?.componentStack || undefined}
          />
        </>
      );
    }

    return this.props.children;
  }
}
