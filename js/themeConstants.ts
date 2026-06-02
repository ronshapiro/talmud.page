export function getColorVariables(): string[] {
  // Try to find dynamically from document stylesheets
  if (typeof document !== "undefined") {
    const variables = new Set<string>();
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            const selector = rule.selectorText?.toLowerCase() || "";
            if (selector.includes(":root") || selector.includes("html") || selector.includes("body")) {
              for (let i = 0; i < rule.style.length; i++) {
                const name = rule.style[i];
                if (name.startsWith("--")) {
                  variables.add(name);
                }
              }
            }
          }
        }
      } catch {
        // Ignore cross-origin security errors for external stylesheets
      }
    }

    const computed = getComputedStyle(document.documentElement || document.body);
    const nonColorVariables = new Set([
      "--max-width",
      "--snackbar-padding",
      "--table-cell-padding",
      "--font-size-multiplier",
    ]);

    const colorVariables = Array.from(variables).filter(variable => {
      if (nonColorVariables.has(variable)) {
        return false;
      }
      const val = computed.getPropertyValue(variable).trim();
      if (!val) {
        return false;
      }
      // A CSS variable qualifies as a color if it parses as a color in computed styles.
      // Standard browser computed colors are returned as rgb/rgba/hsl/hsla/hex/etc.
      return (
        val.startsWith("rgb")
        || val.startsWith("#")
        || val.startsWith("hsl")
        || ["white", "black", "transparent", "initial", "inherit"].includes(val.toLowerCase())
      );
    });

    if (colorVariables.length > 0) {
      colorVariables.sort();
      return colorVariables;
    }
  }

  // Fallback to static list if not running in browser or no variables found yet
  return [
    "--background-color",
    "--text-color",
    "--english-text-color",
    "--rashi-quotation-text-color",
    "--highlight-red",
    "--highlight-red-50",
    "--highlight-yellow",
    "--highlight-yellow-50",
    "--highlight-green",
    "--highlight-green-50",
    "--highlight-blue",
    "--highlight-blue-50",
    "--highlight-gray",
    "--highlight-gray-50",
    "--highlight-purple",
    "--highlight-purple-50",
    "--highlighted-commentary-indicator-red",
    "--highlighted-commentary-indicator-yellow",
    "--highlighted-commentary-indicator-green",
    "--highlighted-commentary-indicator-blue",
    "--highlighted-commentary-indicator-gray",
    "--snackbar-button-color",
    "--snackbar-disabled-button-color",
    "--snackbar-background-color",
    "--snackbar-text-color",
    "--modal-box-shadow-color",
    "--modal-button-color",
    "--mesorat-hashas-purple",
    "--commentary-header-orange",
    "--commentary-header-blue",
    "--commentary-header-gray",
    "--selection-background-color",
    "--mdl-major-color",
    "--mdl-accent-color",
  ];
}
