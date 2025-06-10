
'use client';

// Helper function to get item from localStorage
export function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

// Helper function to set item in localStorage
export function setToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    console.warn(`LocalStorage is not available. Cannot save key "${key}".`);
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
}
