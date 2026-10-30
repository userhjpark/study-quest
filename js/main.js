// Entry point: owns the app state and connects storage, logic and screen.

import { load, save } from "./storage.js";
import {
  SAMPLE_CONCEPTS, ALL_SUBJECTS, addConcept, addMany, deleteConcept, sanitizeConcepts,
  listSubjects, filterBySubject, normalizeFilter, visibleGroups, hasOwnConcepts,
} from "./concepts.js";
import {
  canStartQuiz, pickOptions, recordAnswer, nextCombo, pointsForAnswer,
  buildRound, buildRetry, nextStep, progressLabel,
} from "./quiz.js";
import {
  DAILY_XP_CAP, sanitizeProfile, levelForXp, levelProgress, currentStreak, canCheckIn, applyCheckIn,
  applyRoundWithCheckIn, applyTimerWithCheckIn, xpEarnedToday, summarizeToday, focusMinutesLeftToday, DAILY_FOCUS_MINUTE_CAP,
} from "./rewards.js";
import {
  startTimer, remainingMs, isFinished, isPaused, pauseTimer, resumeTimer, progress, formatRemaining, sanitizeTimer, parseMinutes,
} from "./timer.js";
import { readPdfText, PdfError } from "./pdf-reader.js";
import { appendText } from "./pdf-text.js";
import { buildRoundRecord, addRecord, withPaidXp, sanitizeHistory } from "./history.js";
import { detectSeparator, parseLines, buildPreview } from "./importer.js";
import {
  sanitizeCharacter, hasAnimal, isOwned, pickFirstAnimal, buy, wearOrTakeOff, findAnimal, findItem,
} from "./character.js";
import * as ui from "./ui.js";
import * as charUi from "./ui-character.js";

function freshRun() {
  return {
    active: false, // true from "퀴즈 시작" until the result screen (or leaving)
    phase: "main", // "main" = the round, "retry" = 다시 풀기 (the wrong ones once more)
    round: [], // concepts of the main part, in the order they are asked
    queue: [], // questions of the current part
    index: 0, // position in `queue`
    score: 0, combo: 0, correct: 0, total: 0, // main part only; the retry part gives no points
    retryCorrect: 0, retryTotal: 0,
    current: null, // the question on screen, or null
    step: null, // what "next" does after this answer: "next" | "retry" | "results"
    missedIds: [], // concepts answered wrong in the main part, in order, no duplicates
  };
}

function idleFocus() {
  return {
    phase: "idle", // "idle" = choose a length, "running", "done" = finished, bonus on screen
    timer: null, // { startedAt, endAt, minutes } while running
    reward: null, // what the "집중 완료!" screen shows
  };
}

function loadFocus() {
  const timer = sanitizeTimer(load("timer", null)); // a timer still running when the page was closed
  return timer ? { ...idleFocus(), phase: "running", timer } : idleFocus();
}

function loadText(key, fallback) {
  const value = load(key, fallback);
  return typeof value === "string" ? value : fallback;
}

function loadCollapsed() {
  const saved = load("collapsedSubjects", []);
  return new Set(Array.isArray(saved) ? saved.filter((s) => typeof s === "string") : []);
}

// What the 캐릭터 tab is showing right now. Not saved: leaving the tab resets it.
function freshShop() {
  return {
    category: "color", // shop tab: animal | color | hat | face | prop
    previewId: null, // animal/item being tried on (not owned yet), or null
    message: "", good: null, // result of the last action; good true = green, false = red
  };
}

const state = {
  tab: "focus", // the page opens on the timer (also shows a timer that was running before a reload)
  concepts: sanitizeConcepts(load("concepts", null)) ?? SAMPLE_CONCEPTS,
  missed: load("missed", {}),
  history: sanitizeHistory(load("history", [])), // newest 10 round records
  profile: sanitizeProfile(load("profile", null)), // xp, coins, daily counters, check-in
  quizSubject: loadText("quizSubject", ALL_SUBJECTS), // a subject name or ALL_SUBJECTS
  notesFilter: loadText("notesFilter", ALL_SUBJECTS), // subject shown in the Notes list, or ALL_SUBJECTS
  collapsed: loadCollapsed(), // subjects whose group is collapsed in the Notes "전체" view
  run: freshRun(),
  focus: loadFocus(),
  character: sanitizeCharacter(load("character", null)), // animal, what is owned, what is worn
  shop: freshShop(),
};

// Separator the user picked by hand in bulk import. null = auto-detect.
const bulk = { manualSeparator: null };

function persist() {
  save("concepts", state.concepts);
  save("missed", state.missed);
}

/* ---------- Notes ---------- */

// Filter buttons + the list (grouped by subject in the "전체" view). A saved filter whose
// subject no longer exists falls back to "전체".
function refreshNotes() {
  const filter = normalizeFilter(state.concepts, state.notesFilter);
  if (filter !== state.notesFilter) {
    state.notesFilter = filter;
    save("notesFilter", filter);
  }
  ui.renderSubjectFilter(
    listSubjects(state.concepts), state.concepts.length, filter, ALL_SUBJECTS, handleNotesFilter
  );
  ui.renderConcepts({
    groups: visibleGroups(state.concepts, filter),
    total: state.concepts.length,
    showHeaders: filter === ALL_SUBJECTS,
    collapsed: state.collapsed,
    missed: state.missed,
    onDelete: handleDelete,
    onToggle: handleToggleGroup,
  });
}

function handleNotesFilter(value) {
  state.notesFilter = value;
  save("notesFilter", value);
  refreshNotes();
}

function handleToggleGroup(name) {
  if (state.collapsed.has(name)) state.collapsed.delete(name);
  else state.collapsed.add(name);
  save("collapsedSubjects", [...state.collapsed]);
  refreshNotes();
}

// After adding to a subject, make sure the new concepts are visible: expand its group, and
// if the list is filtered to a different subject, switch the filter to the one just used.
function revealSubject(name) {
  state.collapsed.delete(name);
  save("collapsedSubjects", [...state.collapsed]);
  if (state.notesFilter !== ALL_SUBJECTS && state.notesFilter !== name) {
    state.notesFilter = name;
    save("notesFilter", name);
  }
}

// Subject suggestions + the quiz subject picker. Falls back to "all" if the chosen subject is gone.
function refreshSubjects() {
  const subjects = listSubjects(state.concepts);
  const quizSubject = normalizeFilter(state.concepts, state.quizSubject);
  if (quizSubject !== state.quizSubject) {
    state.quizSubject = quizSubject;
    save("quizSubject", quizSubject);
  }
  ui.setOwnConceptsHint(!hasOwnConcepts(state.concepts)); // refreshed whenever concepts change
  ui.renderSubjectSuggestions(subjects);
  ui.renderQuizSubjects(subjects, state.concepts.length, state.quizSubject, ALL_SUBJECTS);
}

function handleAdd(term, definition, subject) {
  const result = addConcept(state.concepts, term, definition, subject);
  ui.setFormError(result.error);
  if (result.error) return;
  state.concepts = result.concepts;
  save("lastSubject", subject);
  persist();
  revealSubject(state.concepts[state.concepts.length - 1].subject);
  ui.clearForm();
  refreshNotes();
  refreshSubjects();
  refreshBulk();
}

function handleDelete(id) {
  state.concepts = deleteConcept(state.concepts, id);
  delete state.missed[id];
  persist();
  refreshNotes();
  refreshSubjects();
  refreshBulk();
}

/* ---------- Bulk import ---------- */

function currentPreview() {
  const { text, subject } = ui.getBulkInput();
  if (text.trim() === "") return null;
  const separator = bulk.manualSeparator ?? detectSeparator(text);
  return { separator, subject, preview: buildPreview(parseLines(text, separator), state.concepts, subject) };
}

function refreshBulk() {
  const current = currentPreview();
  if (!current) {
    bulk.manualSeparator = null; // text was cleared: go back to auto-detect
    ui.renderBulk({ separator: ":", isManual: false, preview: null });
    return;
  }
  ui.renderBulk({
    separator: current.separator,
    isManual: bulk.manualSeparator !== null,
    preview: current.preview,
  });
}

function handleBulkChange() {
  ui.setBulkStatus("");
  refreshBulk();
}

function handleBulkSeparator(separator) {
  bulk.manualSeparator = separator;
  ui.setBulkStatus("");
  refreshBulk();
}

// PDF -> text -> the same box and preview as pasted text. The text is appended below what is
// already there. Expected problems (scan, too big, ...) come as PdfError with a Korean message.
let pdfBusy = false;

async function handlePdfFile(file) {
  if (pdfBusy) return;
  pdfBusy = true;
  ui.setBulkStatus("");
  ui.setPdfState({ status: "PDF를 읽는 중…", busy: true });
  let done = { status: "" };
  try {
    const { text, pages, usedFallback } = await readPdfText(file, (page, total) => {
      ui.setPdfState({ status: `PDF를 읽는 중… (${page}/${total}쪽)`, busy: true });
    });
    ui.setBulkText(appendText(ui.getBulkInput().text, text));
    refreshBulk();
    done = { status: `${pages}쪽을 읽었어요. 아래 미리보기를 확인하고 추가하세요.${usedFallback ? " (호환 모드로 읽었어요. 글자가 깨졌으면 알려 주세요.)" : ""}` };
  } catch (err) {
    if (!(err instanceof PdfError)) console.error("[PDF] unexpected error in the import handler:", err);
    done = err instanceof PdfError
      ? { error: err.message, detail: err.detail }
      : { error: "PDF를 읽지 못했어요.", detail: `예상 못 한 오류 · ${err && err.name}: ${String(err && err.message).slice(0, 160)}` };
  }
  pdfBusy = false;
  ui.setPdfState(done);
}

function handleBulkAdd() {
  const current = currentPreview();
  if (!current || current.preview.toAdd.length === 0) return;
  const { counts, toAdd } = current.preview;
  const result = addMany(state.concepts, toAdd, current.subject);
  state.concepts = result.concepts;
  save("lastSubject", current.subject);
  persist();
  revealSubject(state.concepts[state.concepts.length - 1].subject);
  ui.clearBulk();
  refreshNotes();
  refreshSubjects();
  refreshBulk();
  let message = `${result.added}개를 추가했어요.`;
  if (counts.duplicate + counts.invalid > 0) {
    message += ` (건너뜀: 중복 ${counts.duplicate}개, 오류 ${counts.invalid}개)`;
  }
  ui.setBulkStatus(message);
}

/* ---------- Profile ---------- */

function refreshProfile() {
  const { profile } = state;
  const now = Date.now();
  ui.renderProfile({
    ...levelProgress(profile.xp),
    coins: profile.coins,
    streak: currentStreak(profile, now),
    canCheckIn: canCheckIn(profile, now),
    todayXp: xpEarnedToday(profile, now),
    dailyCap: DAILY_XP_CAP,
  });
  charUi.setShopCoins(profile.coins);
  if (canCheckIn(profile, now)) ui.setCheckInNote(""); // a new day: drop yesterday's message
}

function levelUpText(before, after) {
  const from = levelForXp(before.xp);
  const to = levelForXp(after.xp);
  return to > from ? ` 레벨 업! Lv ${to}` : "";
}

function handleCheckIn() {
  const before = state.profile;
  const result = applyCheckIn(before, Date.now());
  if (!result.granted) return;
  state.profile = result.profile;
  save("profile", state.profile);
  const { gained } = result;
  ui.setCheckInNote(
    `출석 완료! 연속 ${gained.streak}일 · +${gained.xp} XP, +${gained.coins} 코인${levelUpText(before, state.profile)}`
  );
  refreshProfile();
}

// What the result screen says about the reward for the finished round. `checkIn` is the automatic
// check-in done by finishing the round (granted only if today's check-in was still open).
function rewardMessage(gained, checkIn, levelUp) {
  const checkInText = checkIn.granted
    ? `출석 체크 완료! 연속 ${checkIn.gained.streak}일 · +${checkIn.gained.xp} XP, +${checkIn.gained.coins} 코인`
    : "";
  if (gained.xp === 0 && gained.capped) {
    return {
      text: `오늘의 XP 한도(${DAILY_XP_CAP})에 도달했어요. XP는 내일부터 다시 받아요. 코인 +${gained.coins}은 받았어요.${levelUp}`,
      capped: true,
      checkInText,
    };
  }
  let text = `+${gained.xp} XP, +${gained.coins} 코인${levelUp}`;
  if (gained.capped) text += ` (오늘의 XP 한도 ${DAILY_XP_CAP}에 도달해서 일부만 받았어요)`;
  return { text, capped: gained.capped, checkInText };
}

/* ---------- Character ---------- */

function refreshCharacter() {
  const { character, shop } = state;
  charUi.renderHeaderAvatar(character);
  charUi.renderCharacterTab({
    character, coins: state.profile.coins, category: shop.category, previewId: shop.previewId,
    message: shop.message, good: shop.good,
  });
  ui.setCharacterAlert(!hasAnimal(character) && state.tab !== "character"); // dot until a friend is picked
}

function setShopMessage(message, good) {
  state.shop.message = message;
  state.shop.good = good;
}

function resetShop() {
  state.shop = { ...freshShop(), category: state.shop.category };
}

function saveCharacter() {
  save("character", state.character);
}

function handleCharCategory(category) {
  state.shop.category = category;
  setShopMessage("", null);
  refreshCharacter();
}

// Tapping a card: something owned is put on (or taken off if it is already on); something not
// owned is only tried on the big picture. Nothing is bought or saved by trying.
function handleCharPick(id) {
  const { character } = state;
  setShopMessage("", null);
  if (isOwned(character, id)) {
    state.character = wearOrTakeOff(character, id);
    state.shop.previewId = null;
    saveCharacter();
  } else {
    state.shop.previewId = id;
  }
  refreshCharacter();
}

function handleCharRevert() {
  state.shop.previewId = null;
  setShopMessage("", null);
  refreshCharacter();
}

// The free first friend.
function handleCharStart() {
  const id = state.shop.previewId;
  if (!id) return;
  const result = pickFirstAnimal(state.character, id);
  if (result.error) {
    setShopMessage(result.error, false);
    refreshCharacter();
    return;
  }
  state.character = result.character;
  state.shop.previewId = null;
  saveCharacter();
  const name = findAnimal(id).name;
  setShopMessage(`${name}, 잘 부탁해요!`, true);
  refreshCharacter();
}

// Buys what is being tried on. The character is saved first and the coins second: if saving stops
// in between, the worst case is a free item, never a lost purchase.
function handleCharBuy() {
  const id = state.shop.previewId;
  if (!id) return;
  const result = buy(state.character, state.profile.coins, id);
  if (result.error) {
    setShopMessage(result.error, false); // the try-on stays so the user can see what was missing
    refreshCharacter();
    return;
  }
  state.character = result.character;
  saveCharacter();
  state.profile = { ...state.profile, coins: result.coins };
  save("profile", state.profile);
  state.shop.previewId = null;
  const name = (findAnimal(id) ?? findItem(id)).name;
  setShopMessage(`구매 완료! ${name}`, true);
  refreshProfile();
  refreshCharacter();
}

/* ---------- Focus timer ---------- */

let tickHandle = null; // setInterval id while a timer is running

// Shows whatever the focus state says. Also puts a dot on the tab if a finished timer is waiting.
function refreshFocus() {
  const { focus } = state;
  ui.showFocus(focus.phase);
  if (focus.phase === "idle") {
    ui.renderToday(summarizeToday(state.profile, Date.now()));
    const left = focusMinutesLeftToday(state.profile, Date.now());
    ui.setFocusBonusInfo(`오늘 보너스를 받을 수 있는 시간: ${left}분 남음 (하루 ${DAILY_FOCUS_MINUTE_CAP}분까지)`);
  }
  if (focus.phase === "running") showTimerNow();
  if (focus.phase === "done") ui.showTimerDone({ reward: focus.reward });
  ui.setFocusAlert(focus.phase === "done" && state.tab !== "focus");
}

function showTimerNow() {
  const { timer } = state.focus;
  const now = Date.now();
  ui.renderTimer(formatRemaining(remainingMs(timer, now)), progress(timer, now), isPaused(timer));
}

function stopTicking() {
  if (tickHandle !== null) clearInterval(tickHandle);
  tickHandle = null;
}

function startTicking() {
  stopTicking();
  tickHandle = setInterval(tickTimer, 1000);
}

// Runs every second and when the page becomes visible again. The time shown always comes from the
// clock (timer.js), so a throttled background tab only delays this, it never makes the timer wrong.
function tickTimer() {
  const { focus } = state;
  if (focus.phase !== "running") return;
  if (isFinished(focus.timer, Date.now())) finishTimer();
  else showTimerNow();
}

// "직접 설정": check what was typed, show the problem on the screen if there is one.
function handleFocusCustom(text) {
  if (state.focus.phase !== "idle") return;
  const parsed = parseMinutes(text);
  if (parsed.error) {
    ui.setFocusCustomError(parsed.error);
    return;
  }
  ui.clearFocusCustom();
  handleFocusStart(parsed.minutes);
}

function handleFocusStart(minutes) {
  if (state.focus.phase !== "idle") return;
  state.focus = { ...idleFocus(), phase: "running", timer: startTimer(Date.now(), minutes) };
  save("timer", state.focus.timer);
  refreshFocus();
  startTicking();
}

// Stores a changed timer. A paused timer needs no ticking (its time is frozen).
function setTimer(timer) {
  state.focus.timer = timer;
  save("timer", timer);
  if (isPaused(timer)) stopTicking();
  else startTicking();
  refreshFocus();
}

// "그만하기" pauses the timer and asks first, so a stray tap cannot throw away a long session
// and no time runs off while the question is open. Also used by the "그만하기" button of an
// already paused timer (e.g. after a reload).
function handleFocusCancel() {
  const { focus } = state;
  if (focus.phase !== "running") return;
  if (isFinished(focus.timer, Date.now())) { // it ran out just now: no point in asking
    finishTimer();
    return;
  }
  if (!isPaused(focus.timer)) setTimer(pauseTimer(focus.timer, Date.now()));
  ui.askQuitFocus({ onQuit: quitFocus, onKeep: handleFocusResume });
}

// Continues from the time that was left: the new end time is counted from now.
function handleFocusResume() {
  const { focus } = state;
  if (focus.phase !== "running" || !isPaused(focus.timer)) return;
  setTimer(resumeTimer(focus.timer, Date.now()));
}

// Giving up (confirmed): no bonus.
function quitFocus() {
  if (state.focus.phase !== "running") return;
  stopTicking();
  state.focus = idleFocus();
  save("timer", null);
  refreshFocus();
}

// What the 집중 완료 screen says: the minutes that counted, then the XP/coin/cap text of
// rewardMessage. A used-up daily minute cap gets its own message.
function timerRewardMessage(result, base) {
  if (!result.granted) {
    return {
      text: `오늘의 집중 보너스(${DAILY_FOCUS_MINUTE_CAP}분)는 모두 받았어요. 퀴즈로 XP를 모아 보세요!`,
      capped: true,
      checkInText: base.checkInText,
    };
  }
  const prefix = result.minutesCapped
    ? `오늘 보너스 한도(${DAILY_FOCUS_MINUTE_CAP}분)에 도달해서 ${result.minutes}분만 인정됐어요. `
    : `${result.minutes}분 집중! `;
  return { ...base, text: prefix + base.text, capped: base.capped || result.minutesCapped };
}

// The timer ran out: bonus by its length (and today's check-in), then the "집중 완료!" screen.
// The saved timer is removed first so a reload cannot give the bonus twice.
function finishTimer() {
  stopTicking();
  const { minutes } = state.focus.timer;
  save("timer", null);
  const before = state.profile;
  const result = applyTimerWithCheckIn(before, minutes, Date.now());
  state.profile = result.profile;
  save("profile", state.profile);

  const base = rewardMessage(result.gained, result.checkIn, levelUpText(before, state.profile));
  state.focus = { ...idleFocus(), phase: "done", reward: timerRewardMessage(result, base) };
  refreshProfile();
  refreshFocus();
}

function handleFocusBack() {
  state.focus = idleFocus();
  refreshFocus();
}

// One tap: go to the Quiz tab and start a round in the selected subject. If the subject has
// fewer than 4 concepts the usual message is shown there instead.
function handleFocusQuiz() {
  state.focus = idleFocus();
  refreshFocus();
  handleTab("quiz");
  handleStart();
}

function handleVisible() {
  refreshProfile();
  refreshFocus(); // e.g. the "bonus minutes left today" line after midnight
  tickTimer();
}

/* ---------- Quiz ---------- */

// The concepts the quiz uses: the chosen subject, or everything.
function quizPool() {
  return filterBySubject(state.concepts, state.quizSubject);
}

function scopeLabel() {
  return state.quizSubject === ALL_SUBJECTS ? null : state.quizSubject;
}

// Back to the quiz start screen (shows the "need 4 concepts" message if blocked).
function resetQuiz() {
  state.run = freshRun();
  refreshSubjects();
  ui.renderStats(state.run);
  const check = canStartQuiz(quizPool(), scopeLabel());
  ui.showQuizStart(check.ok);
  ui.showQuizMessage(check.ok ? "" : check.message);
  ui.setQuizSubjectEnabled(true);
}

// Runs `action` right away, or after the user confirms when a round is in progress.
function leaveQuizThen(action) {
  if (state.run.active) ui.askLeave(action);
  else action();
}

function handleTab(name) {
  refreshProfile(); // the day may have changed since the page was opened
  if (name === state.tab) return;
  const enter = () => {
    if (state.tab === "quiz") resetQuiz(); // leaving the quiz drops an unfinished round
    if (state.tab === "character") resetShop(); // a try-on does not outlive the tab
    state.tab = name;
    ui.showTab(name);
    if (name === "quiz") resetQuiz();
    if (name === "notes") refreshNotes(); // show updated "N번 틀림" badges
    refreshFocus(); // the dot on the 집중 tab, and the subject shown on the finish screen
    refreshCharacter(); // the tab content, and the dot on the 캐릭터 tab
  };
  if (state.tab === "quiz") leaveQuizThen(enter);
  else enter();
}

function handleQuizSubject(value) {
  state.quizSubject = value;
  save("quizSubject", value);
  resetQuiz();
}

// Shows the question at run.index of the current part.
function askNext() {
  const { run } = state;
  const concept = run.queue[run.index];
  const picked = pickOptions(concept, quizPool());
  if (!picked) {
    resetQuiz();
    return;
  }
  run.current = { concept, ...picked };
  const label = progressLabel({ phase: run.phase, index: run.index, length: run.queue.length });
  ui.showQuestion(concept.term, picked.options, handleAnswer, label, run.phase === "retry");
}

function handleStart() {
  const pool = quizPool();
  const check = canStartQuiz(pool, scopeLabel());
  ui.showQuizMessage(check.ok ? "" : check.message);
  if (!check.ok) return;
  state.run = freshRun();
  state.run.active = true;
  state.run.round = buildRound(pool, state.missed);
  state.run.queue = state.run.round;
  ui.setQuizSubjectEnabled(false);
  ui.renderStats(state.run);
  askNext();
}

function handleAnswer(pickedIndex) {
  const { current } = state.run;
  if (!current) return;
  const { run } = state;
  const correct = pickedIndex === current.correctIndex;
  const inRetry = run.phase === "retry";

  let message = "아쉬워요. 정답이 초록색으로 표시돼요.";
  if (inRetry) {
    // 다시 풀기: review only. No points, no combo, and the saved miss counts stay as they are
    // (otherwise one correct retry would cancel the miss that the weighting is based on).
    run.retryTotal += 1;
    if (correct) {
      run.retryCorrect += 1;
      message = "정답! (다시 풀기는 XP가 없어요)";
    }
  } else {
    run.combo = nextCombo(run.combo, correct);
    const points = pointsForAnswer(correct, run.combo);
    run.score += points;
    run.total += 1;
    if (correct) {
      run.correct += 1;
      message = `정답! +${points} XP`;
      if (run.combo >= 2) message += ` (콤보 x${run.combo})`;
    } else if (!run.missedIds.includes(current.concept.id)) {
      run.missedIds.push(current.concept.id);
    }
    state.missed = recordAnswer(state.missed, current.concept.id, correct);
    persist();
  }
  run.current = null;
  run.step = nextStep({
    phase: run.phase, index: run.index, length: run.queue.length, missedCount: run.missedIds.length,
  });

  const nextLabel = { next: "다음 문제", retry: "틀린 문제 다시 풀기", results: "결과 보기" }[run.step];
  ui.renderStats(run);
  ui.showAnswerResult({ pickedIndex, correctIndex: current.correctIndex, message, good: correct, nextLabel });
}

function showResults() {
  const { run } = state;
  const record = buildRoundRecord({
    run, concepts: state.concepts, subject: scopeLabel(), now: Date.now(),
  });
  const before = state.profile;
  const reward = applyRoundWithCheckIn(before, record, record.finishedAt);
  state.profile = reward.profile;
  save("profile", state.profile);
  refreshProfile();

  // the history keeps the XP really paid (after the daily cap), so it is saved after the reward
  state.history = addRecord(state.history, withPaidXp(record, reward.gained.xp));
  save("history", state.history);
  ui.renderHistory(state.history);

  run.active = false;
  ui.setQuizSubjectEnabled(true);
  ui.showResult(record, rewardMessage(reward.gained, reward.checkIn, levelUpText(before, state.profile)));
}

function handleNext() {
  const { run } = state;
  if (run.step === "next") {
    run.index += 1;
    askNext();
  } else if (run.step === "retry") {
    run.phase = "retry";
    run.queue = buildRetry(run.round, run.missedIds);
    run.index = 0;
    askNext();
  } else {
    showResults();
  }
}

ui.bindEvents({
  onTab: handleTab,
  onCheckIn: handleCheckIn,
  onVisible: handleVisible,
  onFocusStart: handleFocusStart,
  onFocusCustom: handleFocusCustom,
  onFocusCancel: handleFocusCancel,
  onFocusResume: handleFocusResume,
  onOpenNotes: () => handleTab("notes"),
  onFocusQuiz: handleFocusQuiz,
  onFocusBack: handleFocusBack,
  onAdd: handleAdd,
  onBulkChange: handleBulkChange,
  onBulkSeparator: handleBulkSeparator,
  onBulkAdd: handleBulkAdd,
  onPdfFile: handlePdfFile,
  onQuizSubject: handleQuizSubject,
  onStart: handleStart,
  onNext: handleNext,
  onEnd: () => leaveQuizThen(resetQuiz),
});
charUi.bindCharacterEvents({
  onPick: handleCharPick,
  onCategory: handleCharCategory,
  onBuy: handleCharBuy,
  onRevert: handleCharRevert,
  onStart: handleCharStart,
  onOpen: () => handleTab("character"),
});
ui.setSubjectInput(loadText("lastSubject", ""));
refreshNotes();
refreshSubjects();
refreshBulk();
ui.renderHistory(state.history);
refreshProfile();
resetQuiz();
refreshFocus();
refreshCharacter();
if (state.focus.phase === "running") {
  tickTimer(); // may already be over (page closed while it ran): then the finish screen shows
  if (state.focus.phase === "running" && !isPaused(state.focus.timer)) startTicking();
}
