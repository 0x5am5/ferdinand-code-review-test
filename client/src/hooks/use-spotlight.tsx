import React, { createContext, useState, useCallback, useEffect, useMemo, useContext } from 'react';

interface SpotlightContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const SpotlightContext = createContext<SpotlightContextType | undefined>(
  undefined
);

export function SpotlightProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Add keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        toggle();
      } else if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, isOpen, toggle]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <SpotlightContext.Provider value={value}>
      {children}
    </SpotlightContext.Provider>
  );
}

export function useSpotlight() {
  const context = useContext(SpotlightContext);
  
  if (context === undefined) {
    throw new Error('useSpotlight must be used within a SpotlightProvider');
  }
  
  return context;
}