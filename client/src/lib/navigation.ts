import { useState, useEffect } from 'react';

const NAVIGATION_COOLDOWN = 1000; // 1 second cooldown between navigations
const MAX_NAVIGATIONS_PER_MINUTE = 30; // Prevent more than 30 navigations per minute
let lastNavigationTime = 0;
let navigationCount = 0;
let lastResetTime = Date.now();

export const useNavigationGuard = () => {
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // Reset navigation count every minute
    const resetInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastResetTime >= 60000) {
        navigationCount = 0;
        lastResetTime = now;
      }
    }, 60000);

    return () => clearInterval(resetInterval);
  }, []);

  const guardedNavigate = (to: string) => {
    const now = Date.now();

    // Check cooldown
    if (now - lastNavigationTime < NAVIGATION_COOLDOWN) {
      console.warn('Navigation throttled: too frequent');
      setIsBlocked(true);
      return false;
    }

    // Check rate limit
    if (navigationCount >= MAX_NAVIGATIONS_PER_MINUTE) {
      console.warn('Navigation blocked: rate limit exceeded');
      setIsBlocked(true);
      return false;
    }

    // Update counters
    lastNavigationTime = now;
    navigationCount++;
    setIsBlocked(false);
    return true;
  };

  return { guardedNavigate, isBlocked };
};

export const safeRedirect = (path: string) => {
  const now = Date.now();
  
  // Prevent rapid redirects
  if (now - lastNavigationTime < NAVIGATION_COOLDOWN) {
    console.warn('Redirect throttled: too frequent');
    return;
  }

  // Use replace instead of push for redirects
  window.location.replace(path);
  lastNavigationTime = now;
};