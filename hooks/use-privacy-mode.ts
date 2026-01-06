import { useState, useEffect } from 'react';

export function usePrivacyMode() {
  const [isPrivacyMode, setIsPrivacyMode] = useState(true); // Default to true (safe)
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('perfin_privacy_mode');
    if (stored !== null) {
      setIsPrivacyMode(stored === 'true');
    }
    setIsLoaded(true);
  }, []);

  const togglePrivacyMode = () => {
    const newState = !isPrivacyMode;
    setIsPrivacyMode(newState);
    localStorage.setItem('perfin_privacy_mode', String(newState));
  };

  return { isPrivacyMode, togglePrivacyMode, isLoaded };
}
