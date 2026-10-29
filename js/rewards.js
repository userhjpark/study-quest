// XP, levels, coins and the daily XP cap. Pure logic, no DOM, no storage.
// Rewards are computed from the round-result record built in history.js.

export const DAILY_XP_CAP = 600;
export const COINS_PER_CORRECT = 1;
export const PERFECT_ROUND_COINS = 5;
export const TIMER_BONUS_XP = 5;
export const TIMER_BONUS_COINS = 2;
export const TIMER_BONUS_MAX_PER_DAY = 3;

const MAX_STORED = 1_000_000_000; // keeps edited/broken saved numbers sane

export function freshProfile() {
  return { xp: 0, coins: 0, daily: { date: "", xp: 0, timerBonuses: 0 } };
}

function count(value) {
  return Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), MAX_STORED) : 0;
}

// Saved data can be missing or broken: rebuild a valid profile from whatever is usable.
export function sanitizeProfile(raw) {
  const p = raw !== null && typeof raw === "object" ? raw : {};
  const d = p.daily !== null && typeof p.daily === "object" ? p.daily : {};
  return {
    xp: count(p.xp),
    coins: count(p.coins),
    daily: {
      date: typeof d.date === "string" ? d.date : "",
      xp: count(d.xp),
      timerBonuses: count(d.timerBonuses),
    },
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
  return { ...profile, daily: { date: today, xp: 0, timerBonuses: 0 } };
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
  return grant(profile, now, xp, coins);
}

// Small bonus for a finished focus timer, at most TIMER_BONUS_MAX_PER_DAY times a day.
// `granted` is false once today's bonuses are used up.
export function applyTimerBonus(profile, now) {
  const today = forToday(profile, now);
  if (today.daily.timerBonuses >= TIMER_BONUS_MAX_PER_DAY) {
    return { profile: today, gained: { xp: 0, coins: 0, capped: false }, granted: false };
  }
  const result = grant(today, now, TIMER_BONUS_XP, TIMER_BONUS_COINS);
  result.profile.daily.timerBonuses += 1;
  return { ...result, granted: true };
}
