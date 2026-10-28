// localStorage wrapper. Storage can be blocked (private mode) or hold broken data,
// so every access is wrapped in try/catch and falls back to a default.

const PREFIX = "studyquest:";

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}
