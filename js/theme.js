// Light / dark choice: pure functions, no DOM and no storage.
// `saved` is "light", "dark" or null (no choice yet: follow the system setting).

export function sanitizeTheme(value) {
  return value === "light" || value === "dark" ? value : null;
}

// The theme that is shown: the saved choice, or the system setting when nothing is saved.
export function effectiveTheme(saved, systemIsDark) {
  return sanitizeTheme(saved) ?? (systemIsDark ? "dark" : "light");
}

export function otherTheme(theme) {
  return theme === "dark" ? "light" : "dark";
}
