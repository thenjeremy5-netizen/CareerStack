interface LoginAttempts {
  count: number;
  timestamp: number;
}

const LOGIN_ATTEMPTS_KEY = 'loginAttempts';
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

export const getStoredAttempts = (): number => {
  try {
    const stored = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!stored) return 0;

    const { count, timestamp }: LoginAttempts = JSON.parse(stored);
    // Reset if lockout period has passed
    if (Date.now() - timestamp > LOCKOUT_DURATION) {
      localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
      return 0;
    }
    return count;
  } catch (error) {
    console.error('Error reading login attempts:', error);
    return 0;
  }
};

export const setStoredAttempts = (count: number): void => {
  try {
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({
      count,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error storing login attempts:', error);
  }
};

export const clearStoredAttempts = (): void => {
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
};

export const isAccountLocked = (): boolean => {
  const attempts = getStoredAttempts();
  return attempts >= 5;
};