// XP, levels, coins and the daily XP cap. Pure logic, no DOM, no storage.
// Rewards are computed from the round-result record built in history.js.

export const DAILY_XP_CAP = 600;
export const COINS_PER_CORRECT = 1;
export const PERFECT_ROUND_COINS = 5;
export const XP_PER_FOCUS_MINUTE = 1; // a finished timer pays by its length
export const FOCUS_MINUTES_PER_COIN = 5; // 1 coin per 5 finished minutes
export const DAILY_FOCUS_MINUTE_CAP = 180; // minutes that count for the bonus per day
export const CHECKIN_XP = 10;
export const CHECKIN_COINS = 5;
export const CHECKIN_STREAK_COINS_MAX = 7; // +1 coin per streak day, up to this many

const MAX_STORED = 1_000_000_000; // keeps edited/broken saved numbers sane

// Counters that restart every day. `focusMinutes` is the capped bonus counter; `focusTotal` counts
// every finished timer minute (no cap) and is what the "오늘의 공부" card shows. `rounds`, `correct`
// and `questions` come from the main part of each finished round.
function freshDaily(date) {
  return { date, xp: 0, focusMinutes: 0, focusTotal: 0, rounds: 0, correct: 0, questions: 0 };
}

export function freshProfile() {
  return { xp: 0, coins: 0, daily: freshDaily(""), checkIn: { last: "", streak: 0 } };
}

function count(value) {
  return Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), MAX_STORED) : 0;
}

// Saved data can be missing or broken: rebuild a valid profile from whatever is usable.
export function sanitizeProfile(raw) {
  const p = raw !== null && typeof raw === "object" ? raw : {};
  const d = p.daily !== null && typeof p.daily === "object" ? p.daily : {};
  const c = p.checkIn !== null && typeof p.checkIn === "object" ? p.checkIn : {};
  return {
    xp: count(p.xp),
    coins: count(p.coins),
    daily: {
      date: typeof d.date === "string" ? d.date : "",
      xp: count(d.xp),
      focusMinutes: count(d.focusMinutes),
      focusTotal: count(d.focusTotal),
      rounds: count(d.rounds),
      correct: count(d.correct),
      questions: count(d.questions),
    },
    checkIn: { last: typeof c.last === "string" ? c.last : "", streak: count(c.streak) },
  };
}

// Local calendar day as "YYYY-MM-DD". Used for the daily cap (and later the streak).
export function dateKey(timestamp) {
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ---------- Levels ---------- */

// Total XP needed to reach level L (level 1 = 0 XP, level 2 = 100, level 3 = 300, ...).
export function xpForLevel(level) {
  return 50 * level * (level - 1);
}

export function levelForXp(xp) {
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2)); // estimate, fixed below
  while (xpForLevel(level + 1) <= xp) level += 1;
  while (level > 1 && xpForLevel(level) > xp) level -= 1;
  return level;
}

// For the XP bar: how far into the current level, and how much the level needs in total.
export function levelProgress(xp) {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  return { level, into: xp - start, needed: xpForLevel(level + 1) - start };
}

/* ---------- Daily window ---------- */

// The profile with the daily counters for `now`: a new day starts them at zero.
function forToday(profile, now) {
  const today = dateKey(now);
  if (profile.daily.date === today) return profile;
  return { ...profile, daily: freshDaily(today) };
}

// Numbers for the "오늘의 공부" card. `accuracy` is a whole percent, or null when no question was
// answered today (so the card never shows NaN).
export function summarizeToday(profile, now) {
  const { focusTotal, rounds, correct, questions } = forToday(profile, now).daily;
  return {
    focusMinutes: focusTotal,
    rounds,
    correct,
    questions,
    accuracy: questions > 0 ? Math.round((correct / questions) * 100) : null,
    streak: currentStreak(profile, now),
  };
}

// XP counted against today's cap so far (for the "오늘 N/600 XP" line).
export function xpEarnedToday(profile, now) {
  return forToday(profile, now).daily.xp;
}

export function xpLeftToday(profile, now) {
  return Math.max(0, DAILY_XP_CAP - forToday(profile, now).daily.xp);
}

// Adds XP (limited by what is left of today's cap) and coins. Returns the new profile and what
// was really gained. `capped` is true when the cap cut some of the XP off.
function grant(profile, now, wantedXp, coins) {
  const today = forToday(profile, now);
  const xp = Math.min(wantedXp, Math.max(0, DAILY_XP_CAP - today.daily.xp));
  return {
    profile: {
      ...today,
      xp: today.xp + xp,
      coins: today.coins + coins,
      daily: { ...today.daily, xp: today.daily.xp + xp },
    },
    gained: { xp, coins, capped: xp < wantedXp },
  };
}

/* ---------- Rewards ---------- */

// What a finished round is worth before the cap. XP is the main-part score (10 per correct plus the
// combo bonus). Coins: 1 per correct answer, plus a bonus for a perfect round. The retry part
// ("다시 풀기") gives nothing.
export function rewardsForRound(record) {
  if (record.total <= 0) return { xp: 0, coins: 0 };
  const perfect = record.correct === record.total;
  return {
    xp: record.score,
    coins: record.correct * COINS_PER_CORRECT + (perfect ? PERFECT_ROUND_COINS : 0),
  };
}

export function applyRound(profile, record, now) {
  const { xp, coins } = rewardsForRound(record);
  const result = grant(profile, now, xp, coins);
  const daily = result.profile.daily; // fresh object made by grant()
  daily.rounds += 1;
  daily.correct += record.correct;
  daily.questions += record.total;
  return result;
}

// Bonus minutes still available today (of DAILY_FOCUS_MINUTE_CAP), for the focus screen.
export function focusMinutesLeftToday(profile, now) {
  return Math.max(0, DAILY_FOCUS_MINUTE_CAP - forToday(profile, now).daily.focusMinutes);
}

// Bonus for a FINISHED focus timer of `minutes` minutes: 1 XP per minute and 1 coin per 5 minutes.
// At most DAILY_FOCUS_MINUTE_CAP minutes count per day, so leaving timers running cannot be
// farmed. The XP is part of the normal daily XP cap, so it can be cut by that as well.
//  - Coins are worked out from the day's total minutes, so short timers do not lose their
//    remainder (five 1-minute timers give 1 coin together).
//  - `minutes` in the result is how many minutes were counted; `minutesCapped` is true if the
//    minute cap cut it short. `granted` is false when nothing counted (cap already used up).
export function applyTimerBonus(profile, minutes, now) {
  const today = forToday(profile, now);
  const requested = Number.isInteger(minutes) && minutes > 0 ? minutes : 0;
  const used = today.daily.focusMinutes;
  const counted = Math.min(requested, Math.max(0, DAILY_FOCUS_MINUTE_CAP - used));
  const coins = Math.floor((used + counted) / FOCUS_MINUTES_PER_COIN) - Math.floor(used / FOCUS_MINUTES_PER_COIN);
  const result = grant(today, now, counted * XP_PER_FOCUS_MINUTE, coins);
  result.profile.daily.focusMinutes = used + counted; // fresh object made by grant()
  result.profile.daily.focusTotal += requested; // every finished minute, even past the bonus cap
  return { ...result, granted: counted > 0, minutes: counted, minutesCapped: counted < requested };
}

/* ---------- Daily check-in and streak ---------- */

// Whole days from day key `a` to day key `b` ("YYYY-MM-DD"). UTC is used only for the counting,
// so daylight-saving changes cannot shift the result.
function daysBetween(a, b) {
  const toDay = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return toDay(b) - toDay(a);
}

function hasCheckedIn(checkIn) {
  return /^\d{4}-\d{2}-\d{2}$/.test(checkIn.last);
}

// Days in a row, as shown to the user: the streak counts while the last check-in was today or
// yesterday. Anything older means it is broken (shown as 0 until the next check-in).
export function currentStreak(profile, now) {
  const { last, streak } = profile.checkIn;
  if (!hasCheckedIn(profile.checkIn)) return 0;
  const gap = daysBetween(last, dateKey(now));
  return gap <= 1 ? streak : 0;
}

// One check-in per calendar day. If the saved last check-in is later than today the device clock
// went backwards; that is treated as "already checked in", so setting the clock back cannot give
// repeated check-ins.
export function canCheckIn(profile, now) {
  if (!hasCheckedIn(profile.checkIn)) return true;
  return daysBetween(profile.checkIn.last, dateKey(now)) >= 1;
}

// Check-in gives CHECKIN_XP and coins (+1 coin per streak day). The XP is outside the daily cap.
// Yesterday's check-in continues the streak; any longer gap starts again at 1.
export function applyCheckIn(profile, now) {
  if (!canCheckIn(profile, now)) {
    return { profile, gained: { xp: 0, coins: 0, streak: currentStreak(profile, now) }, granted: false };
  }
  const gap = hasCheckedIn(profile.checkIn) ? daysBetween(profile.checkIn.last, dateKey(now)) : Infinity;
  const streak = gap === 1 ? profile.checkIn.streak + 1 : 1;
  const coins = CHECKIN_COINS + Math.min(streak, CHECKIN_STREAK_COINS_MAX);
  return {
    profile: {
      ...profile,
      xp: profile.xp + CHECKIN_XP,
      coins: profile.coins + coins,
      checkIn: { last: dateKey(now), streak },
    },
    gained: { xp: CHECKIN_XP, coins, streak },
    granted: true,
  };
}

/* ---------- Check-in as a side effect of playing ---------- */

// Finishing a round or a focus timer counts as today's check-in, so forgetting the button costs
// nothing. The check-in bonus is still given once a day, whichever way it happens: if the button
// was used first, `checkIn.granted` is false here (and the other way round).
function withCheckIn(profile, now, apply) {
  const checkIn = applyCheckIn(profile, now);
  const result = apply(checkIn.profile);
  return { ...result, checkIn: { granted: checkIn.granted, gained: checkIn.gained } };
}

export function applyRoundWithCheckIn(profile, record, now) {
  return withCheckIn(profile, now, (p) => applyRound(p, record, now));
}

export function applyTimerWithCheckIn(profile, minutes, now) {
  return withCheckIn(profile, now, (p) => applyTimerBonus(p, minutes, now));
}
