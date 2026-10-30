// The pet's name: validation, Korean particles and the short lines that use the name.
// Pure functions, no DOM and no storage. The name is stored with the character (character.js).

export const MAX_PET_NAME = 10;

// Letters of the name, counted as visible characters (an emoji counts as one).
function lengthOf(text) {
  return Array.from(text).length;
}

// Removes control characters and line breaks, collapses spaces, trims.
export function cleanPetName(text) {
  return String(text ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Checks a name typed by the user. An empty name is fine (the animal's own name is used then).
// Returns { name, error }: with an error the name must not be saved.
export function checkPetName(text) {
  const name = cleanPetName(text);
  if (lengthOf(name) > MAX_PET_NAME) {
    return { name: "", error: `이름은 ${MAX_PET_NAME}자까지 지을 수 있어요.` };
  }
  return { name, error: null };
}

// For saved data that was edited by hand: keep a usable name, cut it to the limit.
export function repairPetName(value) {
  if (typeof value !== "string") return "";
  return Array.from(cleanPetName(value)).slice(0, MAX_PET_NAME).join("").trim();
}

/* ---------- Korean particles ---------- */

// Whether the last sound of the name ends in a consonant (받침). Hangul syllables are decoded
// exactly. Digits and a few Latin letters are judged by how Korean says them (삼, 엘, 엠, 엔, 알).
// Trailing punctuation or spaces are skipped. Anything else counts as "no 받침".
const DIGIT_BATCHIM = new Set(["0", "1", "3", "6", "7", "8"]); // 영 일 삼 육 칠 팔
const LATIN_BATCHIM = new Set(["l", "m", "n", "r"]); // 엘 엠 엔 알

export function hasBatchim(name) {
  const letters = Array.from(String(name)).filter((ch) => /[\p{L}\p{N}]/u.test(ch));
  const last = letters[letters.length - 1];
  if (!last) return false;
  const code = last.codePointAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(last)) return DIGIT_BATCHIM.has(last);
  return LATIN_BATCHIM.has(last.toLowerCase());
}

// kind "and"     : 감자랑 / 별이랑   (랑 after a vowel, 이랑 after a consonant)
// kind "subject" : 감자가 / 별이     (가 after a vowel, 이 after a consonant)
const PARTICLES = { and: ["이랑", "랑"], subject: ["이", "가"] };

export function withParticle(name, kind) {
  const [after, without] = PARTICLES[kind];
  return name + (hasBatchim(name) ? after : without);
}

/* ---------- Lines that use the name ---------- */
// `name` is the pet's name (custom or the animal's). With no name (no pet chosen yet) every line
// is "" so the screen can simply hide it.

export function focusIdleLine(name) {
  return name ? `${withParticle(name, "and")} 같이 집중해 볼까요?` : "";
}

export function focusRunningLine(name, minutes) {
  return name ? `${withParticle(name, "and")} 같이 ${minutes}분 집중!` : "";
}

export function focusDoneLine(name) {
  return name ? `${withParticle(name, "subject")} 기뻐해요!` : "";
}

// After a quiz round: happy if anything was right, still cheering if nothing was.
export function quizResultLine(name, correct) {
  if (!name) return "";
  return correct > 0 ? `${withParticle(name, "subject")} 기뻐해요!` : `${withParticle(name, "subject")} 곁에서 응원해요!`;
}
