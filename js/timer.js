// Focus timer logic. Pure, no DOM. A running timer stores its END TIME and the remaining time is
// always computed from the clock, so it stays correct when a phone throttles a background tab (a
// counter that is incremented once per second would fall behind).
//
// A timer is { minutes, endAt, pausedMs }:
//   running: endAt is a timestamp, pausedMs is null
//   paused:  pausedMs is the time left (frozen), endAt is null -> the clock no longer matters,
//            so a paused timer can never finish and survives a reload unchanged.

export const PRESET_MINUTES = [1, 10, 15, 25]; // the quick buttons; 1 is for demos
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 120; // longest custom length
const MINUTE = 60_000;

// Whole minutes from MIN_MINUTES to MAX_MINUTES.
export function isValidMinutes(minutes) {
  return Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES;
}

// Checks what the user typed in the "직접 설정" field. Returns { minutes } or { error } (a message
// for the screen). Only plain digits are accepted: "12.5", "-5", "1e2" and "10분" are all errors.
export function parseMinutes(text) {
  const t = String(text ?? "").trim();
  if (t === "") return { error: "시간(분)을 입력해 주세요." };
  if (!/^\d+$/.test(t)) return { error: "분은 숫자만 입력할 수 있어요. 예: 30" };
  const minutes = Number(t);
  if (!isValidMinutes(minutes)) {
    return { error: `${MIN_MINUTES}분부터 ${MAX_MINUTES}분까지 설정할 수 있어요.` };
  }
  return { minutes };
}

export function startTimer(now, minutes) {
  return { minutes, endAt: now + minutes * MINUTE, pausedMs: null };
}

export function isPaused(timer) {
  return timer.pausedMs !== null;
}

// Milliseconds left, never below 0. Never above the full length either: if the device clock is set
// backwards while running, the timer does not get longer than it was.
export function remainingMs(timer, now) {
  if (isPaused(timer)) return timer.pausedMs;
  return Math.max(0, Math.min(timer.minutes * MINUTE, timer.endAt - now));
}

// A paused timer never finishes, however much time passes.
export function isFinished(timer, now) {
  return !isPaused(timer) && remainingMs(timer, now) === 0;
}

// Freezes the time left. A timer that is already paused or already over is returned as it is.
export function pauseTimer(timer, now) {
  if (isPaused(timer) || isFinished(timer, now)) return timer;
  return { minutes: timer.minutes, endAt: null, pausedMs: remainingMs(timer, now) };
}

// Continues from the frozen time left: a NEW end time, counted from `now`.
export function resumeTimer(timer, now) {
  if (!isPaused(timer)) return timer;
  return { minutes: timer.minutes, endAt: now + timer.pausedMs, pausedMs: null };
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

// Saved data may be missing or edited: accept only a well-formed running or paused timer.
export function sanitizeTimer(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const { minutes, endAt, pausedMs } = raw;
  if (!isValidMinutes(minutes)) return null;
  if (Number.isFinite(endAt) && (pausedMs === null || pausedMs === undefined)) {
    return { minutes, endAt, pausedMs: null };
  }
  const paused = Number.isInteger(pausedMs) && pausedMs >= 1 && pausedMs <= minutes * MINUTE;
  if (paused && (endAt === null || endAt === undefined)) return { minutes, endAt: null, pausedMs };
  return null;
}
