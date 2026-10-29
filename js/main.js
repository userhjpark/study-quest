// Entry point: owns the app state and connects storage, logic and screen.

import { load, save } from "./storage.js";
import {
  SAMPLE_CONCEPTS, ALL_SUBJECTS, addConcept, addMany, deleteConcept, sanitizeConcepts,
  listSubjects, filterBySubject, normalizeFilter, visibleGroups,
} from "./concepts.js";
import {
  canStartQuiz, pickOptions, recordAnswer, nextCombo, pointsForAnswer,
  buildRound, buildRetry, nextStep, progressLabel,
} from "./quiz.js";
import { buildRoundRecord, addRecord, sanitizeHistory } from "./history.js";
import { detectSeparator, parseLines, buildPreview } from "./importer.js";
import * as ui from "./ui.js";

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

function loadText(key, fallback) {
  const value = load(key, fallback);
  return typeof value === "string" ? value : fallback;
}

function loadCollapsed() {
  const saved = load("collapsedSubjects", []);
  return new Set(Array.isArray(saved) ? saved.filter((s) => typeof s === "string") : []);
}

const state = {
  tab: "notes",
  concepts: sanitizeConcepts(load("concepts", null)) ?? SAMPLE_CONCEPTS,
  missed: load("missed", {}),
  history: sanitizeHistory(load("history", [])), // newest 10 round records
  quizSubject: loadText("quizSubject", ALL_SUBJECTS), // a subject name or ALL_SUBJECTS
  notesFilter: loadText("notesFilter", ALL_SUBJECTS), // subject shown in the Notes list, or ALL_SUBJECTS
  collapsed: loadCollapsed(), // subjects whose group is collapsed in the Notes "전체" view
  run: freshRun(),
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
  if (name === state.tab) return;
  if (name === "notes") {
    leaveQuizThen(() => {
      resetQuiz();
      state.tab = "notes";
      ui.showTab("notes");
      refreshNotes(); // show updated "N번 틀림" badges
    });
  } else {
    state.tab = name;
    ui.showTab(name);
    resetQuiz();
  }
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
      message = "정답! (다시 풀기는 점수가 없어요)";
    }
  } else {
    run.combo = nextCombo(run.combo, correct);
    const points = pointsForAnswer(correct, run.combo);
    run.score += points;
    run.total += 1;
    if (correct) {
      run.correct += 1;
      message = `정답! +${points}점`;
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
  state.history = addRecord(state.history, record);
  save("history", state.history);
  ui.renderHistory(state.history);
  run.active = false;
  ui.setQuizSubjectEnabled(true);
  ui.showResult(record);
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
  onAdd: handleAdd,
  onBulkChange: handleBulkChange,
  onBulkSeparator: handleBulkSeparator,
  onBulkAdd: handleBulkAdd,
  onQuizSubject: handleQuizSubject,
  onStart: handleStart,
  onNext: handleNext,
  onEnd: () => leaveQuizThen(resetQuiz),
});
ui.setSubjectInput(loadText("lastSubject", ""));
refreshNotes();
refreshSubjects();
refreshBulk();
ui.renderHistory(state.history);
resetQuiz();
