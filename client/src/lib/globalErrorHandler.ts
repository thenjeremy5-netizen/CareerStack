// Global error handlers for non-React errors
export function setupGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // You could show a toast or redirect to error page here
  });

  // Handle JavaScript runtime errors
  window.addEventListener('error', (event) => {
    console.error('Global JavaScript error:', event.error);
    // You could show a toast or redirect to error page here
  });
}