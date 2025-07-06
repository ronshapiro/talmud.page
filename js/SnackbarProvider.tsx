import * as React from "react";
import { GenericSnackbar, GenericSnackbarProps } from "./GenericSnackbar";

const { createContext, useContext, useState, useCallback, useMemo } = React;

export interface SnackbarConfig extends Omit<GenericSnackbarProps, "onDismiss" | "isVisible"> {
  // id is already in GenericSnackbarProps
  // message is in GenericSnackbarProps
  // buttons are in GenericSnackbarProps
  // kind is in GenericSnackbarProps
  // autoHideDuration is in GenericSnackbarProps
}

interface SnackbarContextType {
  showSnackbar: (config: SnackbarConfig) => string; // Returns the id of the snackbar
  hideSnackbar: (id: string) => void;
  updateSnackbar: (id: string, config: Partial<SnackbarConfig>) => void;
  activeSnackbars: GenericSnackbarProps[];
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export function useSnackbar(): SnackbarContextType {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}

interface SnackbarProviderProps {
  children: React.ReactNode;
}

let snackbarIdCounter = 0;

export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const [activeSnackbars, setActiveSnackbars] = useState<GenericSnackbarProps[]>([]);

  const showSnackbar = useCallback((config: SnackbarConfig): string => {
    const id = config.id || `snackbar-${snackbarIdCounter++}`;
    const newSnackbar: GenericSnackbarProps = {
      ...config,
      id,
      isVisible: true,
      onDismiss: () => hideSnackbar(id), // For auto-hide or other internal dismissals
      onAnimatedOut: () => removeFromActiveSnackbars(id), // For removal after animation
    };
    setActiveSnackbars(prevSnackbars => {
      // Prevent duplicate IDs if manually specified
      if (prevSnackbars.find(s => s.id === id)) {
        // Optionally update if exists, or throw error, or ignore. For now, let's add as new or replace.
        // To replace: filter out existing, then add.
        // For now, simple addition, assuming IDs are unique or managed by counter.
        // If allowing specified IDs that might collide, this logic needs refinement.
        // For now, if ID is specified and exists, this will add another one. Better to filter.
        const filtered = prevSnackbars.filter(s => s.id !==id);
        return [...filtered, newSnackbar];
      }
      return [...prevSnackbars, newSnackbar];
    });
    return id;
  }, []); // Empty dependency array for now, will be updated if hideSnackbar causes issues.

  const hideSnackbar = useCallback((id: string) => {
    setActiveSnackbars(prevSnackbars =>
      prevSnackbars.map(snackbar =>
        snackbar.id === id ? { ...snackbar, isVisible: false } : snackbar
      )
    );
    // Remove from DOM after animation: GenericSnackbar's onRest should handle this,
    // but we also need to remove it from the activeSnackbars array after animation.
    // For now, GenericSnackbar will animate out. We need a way to know when to remove it from the array.
    // This is now handled by the `onAnimatedOut` prop passed to GenericSnackbar.
    // The `onDismiss` prop for GenericSnackbar IS what gets called by autoHideDuration.
    // This `hideSnackbar` function sets `isVisible` to false, triggering animation.
    // `GenericSnackbar` will then call `onAnimatedOut` upon animation completion.
    // No more setTimeout needed here.
  }, []);

  const removeFromActiveSnackbars = useCallback((id: string) => {
    setActiveSnackbars(currentSnackbars => currentSnackbars.filter(s => s.id !== id));
  }, []);

  // Re-assign showSnackbar to include the correctly scoped hideSnackbar
  // This is a common pattern if functions depend on each other from useCallback.
  // However, the initial definition of showSnackbar should be fine if hideSnackbar is stable.
  // Let's ensure hideSnackbar is stable (it is, as it only depends on setActiveSnackbars).

  const updateSnackbar = useCallback((id: string, config: Partial<SnackbarConfig>) => {
    setActiveSnackbars(prevSnackbars =>
      prevSnackbars.map(snackbar =>
        snackbar.id === id ? { ...snackbar, ...config, id, isVisible: true } : snackbar
      )
    );
  }, []);

  const contextValue = useMemo(() => ({
    showSnackbar,
    hideSnackbar,
    updateSnackbar,
    activeSnackbars,
  }), [showSnackbar, hideSnackbar, updateSnackbar, activeSnackbars]);

  return (
    <SnackbarContext.Provider value={contextValue}>
      {children}
      <SnackbarContainer activeSnackbars={activeSnackbars} />
    </SnackbarContext.Provider>
  );
}

interface SnackbarContainerProps {
  activeSnackbars: GenericSnackbarProps[];
}

function SnackbarContainer({ activeSnackbars }: SnackbarContainerProps) {
  // Basic styling for the container itself.
  // Individual snackbars are styled by GenericSnackbar.css
  const containerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "20px", // Adjust as needed
    left: "50%",
    transform: "translateX(-50%)", // Center the container
    zIndex: 1000, // Ensure it's above most other content
    display: "flex",
    flexDirection: "column-reverse", // Stack new snackbars on top of old ones
    alignItems: "center", // Center snackbars horizontally if their width is less than container
    width: "auto", // Or a max-width
    maxWidth: "90%",
  };

  return (
    <div style={containerStyle} className="snackbar-container">
      {activeSnackbars.map(snackbarProps => (
        <GenericSnackbar
          key={snackbarProps.id}
          {...snackbarProps}
          // onDismiss is already set when snackbar is created by showSnackbar
        />
      ))}
    </div>
  );
}
