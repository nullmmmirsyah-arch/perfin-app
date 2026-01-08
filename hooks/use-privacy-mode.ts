import { useState, useEffect } from 'react';

export function usePrivacyMode() {
  const [isPrivacyMode, setIsPrivacyMode] = useState(true); // Always default to true (safe)
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // We no longer read from localStorage to ensure it resets every session/navigation
    setIsLoaded(true);
  }, []);

  const togglePrivacyMode = () => {
    setIsPrivacyMode(!isPrivacyMode);
    // We no longer save to localStorage
  };

  return { isPrivacyMode, togglePrivacyMode, isLoaded };
}
