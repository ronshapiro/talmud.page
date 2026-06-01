export interface CustomTheme {
  name: string;
  baseTheme: string; // "true" (Dark), "gray" (Gray), "false" (Light)
  overrides: Record<string, string>;
}

const CUSTOM_THEMES_KEY = "customThemes";

export function getCustomThemes(): CustomTheme[] {
  const stored = localStorage.getItem(CUSTOM_THEMES_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse custom themes", e);
    return [];
  }
}

export function saveCustomTheme(theme: CustomTheme): void {
  const themes = getCustomThemes();
  const index = themes.findIndex(t => t.name === theme.name);
  if (index !== -1) {
    themes[index] = theme;
  } else {
    themes.push(theme);
  }
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

export function deleteCustomTheme(themeName: string): void {
  const themes = getCustomThemes();
  const newThemes = themes.filter(t => t.name !== themeName);
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(newThemes));
  if (localStorage.darkMode === themeName) {
    localStorage.darkMode = "false";
  }
}

export function getCustomTheme(themeName: string): CustomTheme | undefined {
  return getCustomThemes().find(t => t.name === themeName);
}

export function isCustomTheme(themeName: string): boolean {
  return !["true", "gray", "false"].includes(themeName);
}
