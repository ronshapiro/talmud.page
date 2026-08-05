/**
 * `gtag` is a bare global loaded by a third-party script tag, which an ad blocker can prevent
 * from ever running -- a real production condition, not just a test-environment gap.
 */
export const trackEvent: typeof gtag = (...args) => {
  if (typeof gtag !== "undefined") {
    (gtag as any)(...args);
  }
};
