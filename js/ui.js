// All DOM work lives here. No game rules: main.js decides, this file only shows.
// User text is always inserted with textContent (never innerHTML) so typed
// concepts cannot inject HTML.

const $ = (id) => document.getElementById(id);

export function bindEvents(h) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => h.onTab(btn.dataset.tab));
  });
  $("concept-form").addEventListener("submit", (e) => {
    e.preventDefault();
    h.onAdd($("term-input").value, $("definition-input").value);
  });
  $("start-btn").addEventListener("click", h.onStart);
  $("next-btn").addEventListener("click", h.onNext);
  $("end-btn").addEventListener("click", h.onEnd);
  $("again-btn").addEventListener("click", h.onStart);

  // Leave dialog: Stay (or Esc) just closes it; Leave closes it and runs the saved action.
  const dialog = $("leave-dialog");
  $("stay-btn").addEventListener("click", () => dialog.close());
  $("leave-btn").addEventListener("click", () => {
    const action = pendingLeave;
    pendingLeave = null;
    dialog.close();
    if (action) action();
  });
  dialog.addEventListener("close", () => { pendingLeave = null; });
}

let pendingLeave = null;

export function askLeave(onLeave) {
  pendingLeave = onLeave;
  $("leave-dialog").showModal();
}

export function showTab(name) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === name);
  });
  $("tab-notes").hidden = name !== "notes";
  $("tab-quiz").hidden = name !== "quiz";
}

export function renderConcepts(concepts, missed, onDelete) {
  const list = $("concept-list");
  list.replaceChildren();
  $("concept-count").textContent = String(concepts.length);

  if (concepts.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No concepts yet. Add your first one above.";
    list.append(li);
    return;
  }

  for (const c of concepts) {
    const li = document.createElement("li");
    li.className = "concept-item";

    const text = document.createElement("div");
    text.className = "concept-text";
    const term = document.createElement("div");
    term.className = "concept-term";
    term.textContent = c.term;
    const def = document.createElement("div");
    def.className = "concept-def";
    def.textContent = c.definition;
    text.append(term, def);

    if (missed[c.id] > 0) {
      const badge = document.createElement("span");
      badge.className = "missed-badge";
      badge.textContent = `Missed ${missed[c.id]}×`;
      text.append(badge);
    }

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.setAttribute("aria-label", "Delete " + c.term);
    del.addEventListener("click", () => onDelete(c.id));

    li.append(text, del);
    list.append(li);
  }
}

export function setFormError(message) {
  $("form-error").textContent = message || "";
}

export function clearForm() {
  $("term-input").value = "";
  $("definition-input").value = "";
  $("term-input").focus();
}

export function renderStats({ score, combo, correct, total }) {
  $("stat-score").textContent = String(score);
  $("stat-combo").textContent = String(combo);
  $("stat-correct").textContent = `${correct}/${total}`;
}

export function showQuizMessage(message) {
  const el = $("quiz-message");
  el.textContent = message || "";
  el.hidden = !message;
}

function showQuizPart(name) {
  $("quiz-start").hidden = name !== "start";
  $("quiz-question").hidden = name !== "question";
  $("quiz-result").hidden = name !== "result";
}

export function showQuizStart() {
  showQuizPart("start");
}

export function showResult({ score, correct, total, missedTerms }) {
  showQuizPart("result");
  $("result-score").textContent = String(score);
  $("result-correct").textContent = `${correct} of ${total} correct`;
  const list = $("result-missed");
  list.replaceChildren();
  if (missedTerms.length === 0) {
    const li = document.createElement("li");
    li.textContent = "None. Perfect round!";
    list.append(li);
    return;
  }
  for (const t of missedTerms) {
    const li = document.createElement("li");
    li.textContent = t;
    list.append(li);
  }
}

export function showQuestion(term, options, onPick, progressText) {
  showQuizPart("question");
  $("question-progress").textContent = progressText;
  $("question-term").textContent = term;
  $("feedback").textContent = "";
  $("feedback").className = "feedback";
  $("next-btn").hidden = true;

  const box = $("options");
  box.replaceChildren();
  options.forEach((text, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.textContent = text;
    btn.addEventListener("click", () => onPick(i));
    box.append(btn);
  });
}

export function showAnswerResult({ pickedIndex, correctIndex, message, good, isLast }) {
  const buttons = $("options").querySelectorAll(".option");
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIndex) btn.classList.add("is-correct");
    else if (i === pickedIndex) btn.classList.add("is-wrong");
  });
  $("feedback").textContent = message;
  $("feedback").className = "feedback " + (good ? "good" : "bad");
  $("next-btn").textContent = isLast ? "See results" : "Next question";
  $("next-btn").hidden = false;
  $("next-btn").focus();
}
