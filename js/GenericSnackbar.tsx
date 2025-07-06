import * as React from "react";
import { animated, useSpring, config } from "@react-spring/web";

const { useState, useEffect, useMemo } = React;

export interface SnackbarButtonProps {
  text: string | React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean; // Added disabled prop
}

export interface GenericSnackbarProps {
  id: string;
  message: string | React.ReactNode;
  buttons?: SnackbarButtonProps[];
  isVisible: boolean;
  onDismiss: (id: string) => void; // Called for explicit dismiss actions like timeout
  onAnimatedOut?: (id: string) => void; // Called after exit animation completes
  kind?: string;
  autoHideDuration?: number | null; // Duration in ms, null to disable auto-hide
}

export function GenericSnackbar({
  id,
  message,
  buttons,
  isVisible,
  onDismiss,
  onAnimatedOut,
  kind,
  autoHideDuration = 6000, // Default to 6 seconds
}: GenericSnackbarProps): React.ReactElement | null {
  const [isShown, setIsShown] = useState(false); // Internal state to help drive animation

  // Animation for the snackbar
  const animationProps = useSpring({
    from: { opacity: 0, transform: "translateY(100%)" },
    to: {
      opacity: isVisible ? 1 : 0, // Drive directly by isVisible for opacity
      transform: isVisible ? "translateY(0%)" : "translateY(100%)", // And transform
    },
    config: config.gentle,
    onRest: (result) => {
      // onRest can be called for both entry and exit animations.
      // We are interested when the snackbar has animated out.
      if (!isVisible && result.finished) { // Check if animation finished and snackbar is not visible
        onAnimatedOut?.(id);
      }
    },
  });

  useEffect(() => {
    // This effect manages the isShown state, primarily for initial mount.
    // The animation itself is now more directly driven by the isVisible prop.
    if (isVisible) {
      setIsShown(true);
    } else {
      // If isVisible is false from the start, or becomes false
      setIsShown(false);
    }
  }, [isVisible]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    if (isVisible && autoHideDuration) {
      timerId = setTimeout(() => {
        onDismiss(id);
      }, autoHideDuration);
    }
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [id, isVisible, autoHideDuration, onDismiss]);

  // Memoize buttons to prevent re-renders if props haven't changed
  const memoizedButtons = useMemo(() => {
    return buttons?.map((buttonProps, index) => (
      <button
        key={index}
        onClick={() => {
          if (buttonProps.disabled) return;
          buttonProps.onClick();
        }}
        className={`mdl-button mdl-js-button mdl-button--colored ${buttonProps.className || ""} ${buttonProps.disabled ? "mdl-button--disabled" : ""}`}
        disabled={buttonProps.disabled}
      >
        {buttonProps.text}
      </button>
    ));
  }, [buttons]);

  // Determine CSS classes
  const snackbarClasses = ["generic-snackbar"];
  if (kind) {
    snackbarClasses.push(`snackbar-kind-${kind}`);
  }
  // Add basic styling for visibility and layout
  // More specific styling should be handled by CSS files.
  const direction = localStorage.languageOption === "hebrew" ? "rtl" : "ltr";

  // Do not render if it's not supposed to be visible and not currently shown (e.g. already dismissed and animated out)
  // This is a slight adjustment to ensure that if isVisible is false from the start, nothing is rendered.
  // The main purpose of this component is to animate in/out based on isVisible.
  // If isVisible is false and isShown is also false (meaning it's fully dismissed or was never meant to show), return null.
  if (!isVisible && !isShown) {
    return null;
  }


  return (
    <animated.div
      style={animationProps}
      className={snackbarClasses.join(" ")}
      dir={direction}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="snackbar-text">{message}</div>
      {memoizedButtons && memoizedButtons.length > 0 && (
        <div className="snackbar-buttons">{memoizedButtons}</div>
      )}
    </animated.div>
  );
}
