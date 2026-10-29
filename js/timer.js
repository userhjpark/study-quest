// Focus timer logic. Pure, no DOM. The timer stores its END TIME and the remaining time is always
// computed from the clock, so it stays correct when a phone throttles a background tab (a counter
// that is incremented once per second would fall behind).

export const DURATIONS = [1, 10, 15, 25]; // minutes; 1 is for demos
const MINUTE = 60_000;

export function startTimer(now, minutes) {
  return { startedAt: now, endAt: now + minutes * MINUTE, minutes };
}

// Milliseconds left, never below 0. Never above the full length either: if the device clock is set
// backwards after starting, the timer does not get longer than it was.
export function remainingMs(timer, now) {
  const total = timer.minutes * MINUTE;
  return Math.max(0, Math.min(total, timer.endAt - now));
}

export function isFinished(timer, now) {
  return remainingMs(timer, now) === 0;
}

// 0..1 for a progress bar.
export function progress(timer, now) {
  return 1 - remainingMs(timer, now) / (timer.minutes * MINUTE);
}

// "MM:SS", rounded UP to the next second so the display shows 00:01 until the very end.
export function formatRemaining(ms) {
  const seconds = Math.ceil(ms / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

// Saved data may be missing or edited: accept only a timer whose length matches its minutes.
export function sanitizeTimer(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const { startedAt, endAt, minutes } = raw;
  if (!DURATIONS.includes(minutes)) return null;
  if (!Number.isFinite(startedAt) || !Number.isFinite(endAt)) return null;
  if (endAt - startedAt !== minutes * MINUTE) return null;
  return { startedAt, endAt, minutes };
}
