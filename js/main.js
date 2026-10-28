// Entry point: owns the app state and connects storage, logic and screen.

import { load, save } from "./storage.js";
import { SAMPLE_CONCEPTS, addConcept, deleteConcept, sanitizeConcepts } from "./concepts.js";
import {
  canStartQuiz, pickOptions, pickNextConcept, recordAnswer, nextCombo, pointsForAnswer, roundLength,
} from "./quiz.js";
import * as ui from "./ui.js";

function freshRun() {
  return {
    active: false, // true from "Start" until the result screen (or leaving)
    length: 0, // questions in this round
    score: 0, combo: 0, correct: 0, total: 0,
    lastId: null,
    current: null, // the question on screen, or null
    missedIds: [], // concepts answered wrong this round, in order, no duplicates
  };
}

const state = {
  tab: "notes",
  concepts: sanitizeConcepts(load("concepts", null)) ?? SAMPLE_CONCEPTS,
  missed: load("missed", {}),
  run: freshRun(),
};

function persist() {
  save("concepts", state.concepts);
  save("missed", state.missed);
}

function refreshNotes() {
  ui.renderConcepts(state.concepts, state.missed, handleDelete);
}

function handleAdd(term, definition) {
  const result = addConcept(state.concepts, term, definition);
  ui.setFormError(result.error);
  if (result.error) return;
  state.concepts = result.concepts;
  persist();
  ui.clearForm();
  refreshNotes();
}

function handleDelete(id) {
  state.concepts = deleteConcept(state.concepts, id);
  delete state.missed[id];
  persist();
  refreshNotes();
}

// Back to the quiz start screen (shows the "need 4 concepts" message if blocked).
function resetQuiz() {
  state.run = freshRun();
  ui.renderStats(state.run);
  ui.showQuizStart();
  const check = canStartQuiz(state.concepts);
  ui.showQuizMessage(check.ok ? "" : check.message);
  document.getElementById("start-btn").disabled = !check.ok;
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
      refreshNotes(); // show updated "Missed N×" badges
    });
  } else {
    state.tab = name;
    ui.showTab(name);
    resetQuiz();
  }
}

function askNext() {
  const concept = pickNextConcept(state.concepts, state.missed, Math.random, state.run.lastId);
  const picked = pickOptions(concept, state.concepts);
  if (!picked) {
    resetQuiz();
    return;
  }
  state.run.current = { concept, ...picked };
  state.run.lastId = concept.id;
  const progress = `Question ${state.run.total + 1} of ${state.run.length}`;
  ui.showQuestion(concept.term, picked.options, handleAnswer, progress);
}

function handleStart() {
  const check = canStartQuiz(state.concepts);
  ui.showQuizMessage(check.ok ? "" : check.message);
  if (!check.ok) return;
  state.run = freshRun();
  state.run.active = true;
  state.run.length = roundLength(state.concepts);
  ui.renderStats(state.run);
  askNext();
}

function handleAnswer(pickedIndex) {
  const { current } = state.run;
  if (!current) return;
  const correct = pickedIndex === current.correctIndex;

  state.run.combo = nextCombo(state.run.combo, correct);
  const points = pointsForAnswer(correct, state.run.combo);
  state.run.score += points;
  state.run.total += 1;
  if (correct) state.run.correct += 1;
  else if (!state.run.missedIds.includes(current.concept.id)) state.run.missedIds.push(current.concept.id);
  state.missed = recordAnswer(state.missed, current.concept.id, correct);
  persist();
  state.run.current = null;

  let message = "Not quite. The correct definition is highlighted.";
  if (correct) {
    message = `Correct! +${points} points`;
    if (state.run.combo >= 2) message += ` (combo x${state.run.combo})`;
  }
  ui.renderStats(state.run);
  ui.showAnswerResult({
    pickedIndex,
    correctIndex: current.correctIndex,
    message,
    good: correct,
    isLast: state.run.total >= state.run.length,
  });
}

function showResults() {
  const { score, correct, total, missedIds } = state.run;
  const missedTerms = missedIds
    .map((id) => state.concepts.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => c.term);
  state.run.active = false;
  ui.showResult({ score, correct, total, missedTerms });
}

function handleNext() {
  if (state.run.total >= state.run.length) showResults();
  else askNext();
}

ui.bindEvents({
  onTab: handleTab,
  onAdd: handleAdd,
  onStart: handleStart,
  onNext: handleNext,
  onEnd: () => leaveQuizThen(resetQuiz),
});
refreshNotes();
resetQuiz();
