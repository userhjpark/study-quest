// All DOM work lives here. No game rules: main.js decides, this file only shows.
// User text is always inserted with textContent (never innerHTML) so typed
// concepts cannot inject HTML.

const $ = (id) => document.getElementById(id);

// Separator button names in the HTML -> the real character.
const SEP_BY_NAME = { ":": ":", "/": "/", tab: "\t" };

let pendingLeave = null;
let pendingQuitFocus = null;

export function bindEvents(h) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => h.onTab(btn.dataset.tab));
  });
  $("concept-form").addEventListener("submit", (e) => {
    e.preventDefault();
    h.onAdd($("term-input").value, $("definition-input").value, $("subject-input").value);
  });

  // Bulk import
  $("bulk-text").addEventListener("input", h.onBulkChange);
  $("bulk-subject").addEventListener("input", h.onBulkChange);
  document.querySelectorAll(".sep-btn").forEach((btn) => {
    btn.addEventListener("click", () => h.onBulkSeparator(SEP_BY_NAME[btn.dataset.sep]));
  });
  $("bulk-add-btn").addEventListener("click", h.onBulkAdd);

  // Profile
  $("checkin-btn").addEventListener("click", h.onCheckIn);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) h.onVisible();
  });

  // Focus timer
  document.querySelectorAll(".duration-btn").forEach((btn) => {
    btn.addEventListener("click", () => h.onFocusStart(Number(btn.dataset.minutes)));
  });
  $("focus-cancel-btn").addEventListener("click", h.onFocusCancel);
  // Quit dialog: "계속하기" (or Esc) just closes it; "그만하기" closes it and runs the saved action.
  const quitDialog = $("quit-focus-dialog");
  $("quit-focus-stay-btn").addEventListener("click", () => quitDialog.close());
  $("quit-focus-confirm-btn").addEventListener("click", () => {
    const action = pendingQuitFocus;
    pendingQuitFocus = null;
    quitDialog.close();
    if (action) action();
  });
  quitDialog.addEventListener("close", () => { pendingQuitFocus = null; });
  $("focus-quiz-btn").addEventListener("click", h.onFocusQuiz);
  $("focus-back-btn").addEventListener("click", h.onFocusBack);

  // Quiz
  $("quiz-subject").addEventListener("change", () => h.onQuizSubject($("quiz-subject").value));
  $("start-btn").addEventListener("click", h.onStart);
  $("next-btn").addEventListener("click", h.onNext);
  $("end-btn").addEventListener("click", h.onEnd);
  $("again-btn").addEventListener("click", h.onStart);

  // Leave dialog: "계속하기" (or Esc) just closes it; "나가기" closes it and runs the saved action.
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

export function askLeave(onLeave) {
  pendingLeave = onLeave;
  $("leave-dialog").showModal();
}

export function askQuitFocus(onQuit) {
  pendingQuitFocus = onQuit;
  $("quit-focus-dialog").showModal();
}

// Closes the quit dialog without running its action (e.g. the timer finished meanwhile).
export function closeQuitFocus() {
  const dialog = $("quit-focus-dialog");
  if (dialog.open) dialog.close();
}

export function showTab(name) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === name);
  });
  $("tab-notes").hidden = name !== "notes";
  $("tab-focus").hidden = name !== "focus";
  $("tab-quiz").hidden = name !== "quiz";
}

/* ---------- Notes ---------- */

function createConceptItem(c, missed, onDelete) {
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

  const tag = document.createElement("span");
  tag.className = "subject-tag";
  tag.textContent = c.subject;
  text.append(tag);

  if (missed[c.id] > 0) {
    const badge = document.createElement("span");
    badge.className = "missed-badge";
    badge.textContent = `${missed[c.id]}번 틀림`;
    text.append(badge);
  }

  const del = document.createElement("button");
  del.type = "button";
  del.className = "delete-btn";
  del.textContent = "삭제";
  del.setAttribute("aria-label", `${c.term} 삭제`);
  del.addEventListener("click", () => onDelete(c.id));

  li.append(text, del);
  return li;
}

// Filter buttons above the list: "전체" + one per subject. `subjects` is [{ name, count }].
export function renderSubjectFilter(subjects, total, selected, allValue, onSelect) {
  const box = $("subject-filter");
  box.replaceChildren();
  const add = (value, label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = label;
    btn.setAttribute("aria-pressed", String(value === selected));
    btn.addEventListener("click", () => onSelect(value));
    box.append(btn);
  };
  add(allValue, `전체 ${total}`);
  for (const s of subjects) add(s.name, `${s.name} ${s.count}`);
}

// groups: [{ name, concepts }]. With showHeaders (the "전체" view) each group gets a header
// "과목 (개수)" that collapses or expands it; `collapsed` is the set of collapsed subject names.
export function renderConcepts({ groups, total, showHeaders, collapsed, missed, onDelete, onToggle }) {
  $("concept-count").textContent = String(total);
  const box = $("concept-groups");
  box.replaceChildren();

  if (total === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "아직 개념이 없어요. 위에서 첫 개념을 추가해 보세요.";
    box.append(p);
    return;
  }

  for (const group of groups) {
    const section = document.createElement("div");
    section.className = "group";
    const isCollapsed = showHeaders && collapsed.has(group.name);

    if (showHeaders) {
      const head = document.createElement("button");
      head.type = "button";
      head.className = "group-header";
      head.setAttribute("aria-expanded", String(!isCollapsed));
      const arrow = document.createElement("span");
      arrow.className = "group-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = isCollapsed ? "▸" : "▾";
      const title = document.createElement("span");
      title.className = "group-title";
      title.textContent = `${group.name} (${group.concepts.length})`;
      head.append(arrow, title);
      head.addEventListener("click", () => onToggle(group.name));
      section.append(head);
    }

    if (!isCollapsed) {
      const list = document.createElement("ul");
      list.className = "concept-list";
      for (const c of group.concepts) list.append(createConceptItem(c, missed, onDelete));
      section.append(list);
    }
    box.append(section);
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

export function getSubjectInput() {
  return $("subject-input").value;
}

export function setSubjectInput(value) {
  $("subject-input").value = value;
}

// Suggestions shown while typing a subject (shared by the single form and bulk import).
export function renderSubjectSuggestions(subjects) {
  const list = $("subject-list");
  list.replaceChildren();
  for (const s of subjects) {
    const option = document.createElement("option");
    option.value = s.name;
    list.append(option);
  }
}

/* ---------- Bulk import ---------- */

export function getBulkInput() {
  return { text: $("bulk-text").value, subject: $("bulk-subject").value };
}

export function clearBulk() {
  $("bulk-text").value = "";
}

export function setBulkStatus(message) {
  $("bulk-status").textContent = message || "";
}

// Draws the separator buttons and the preview. `preview` is null when there is no text.
export function renderBulk({ separator, isManual, preview }) {
  document.querySelectorAll(".sep-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(SEP_BY_NAME[btn.dataset.sep] === separator));
  });

  const box = $("bulk-preview");
  const addBtn = $("bulk-add-btn");
  const hint = $("sep-hint");

  if (!preview) {
    box.hidden = true;
    addBtn.disabled = true;
    addBtn.textContent = "추가하기";
    hint.textContent = "";
    return;
  }

  hint.textContent = isManual
    ? "직접 고른 구분 기호예요."
    : "구분 기호를 자동으로 골랐어요. 미리보기가 이상할 때만 바꿔 보세요.";

  const { items, counts, toAdd } = preview;
  box.hidden = false;
  $("bulk-summary").textContent =
    `추가 ${counts.ok}개 · 중복 ${counts.duplicate}개 · 오류 ${counts.invalid}개 (중복과 오류는 건너뛰어요)`;

  const list = $("bulk-items");
  list.replaceChildren();
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "preview-item";
    li.textContent = "읽을 수 있는 줄이 없어요.";
    list.append(li);
  }
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "preview-item is-" + item.status;

    const line = document.createElement("span");
    line.className = "preview-line";
    line.textContent = `${item.line}줄`;

    const main = document.createElement("span");
    main.className = "preview-main";
    // Unreadable lines are shown as typed; readable ones as "concept → definition".
    main.textContent = item.error ? item.raw.trim() : `${item.term} → ${item.definition}`;

    const reason = document.createElement("span");
    reason.className = "preview-reason";
    reason.textContent = item.status === "ok" ? "추가돼요" : item.reason;
    main.append(reason);

    li.append(line, main);
    list.append(li);
  }

  addBtn.disabled = toAdd.length === 0;
  addBtn.textContent = toAdd.length > 0 ? `${toAdd.length}개 추가하기` : "추가할 개념이 없어요";
}

/* ---------- Quiz ---------- */

// subjects: [{ name, count }]. `selected` is a subject name or the "all" value.
export function renderQuizSubjects(subjects, total, selected, allValue) {
  const select = $("quiz-subject");
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = allValue;
  all.textContent = `전체 과목 (${total})`;
  select.append(all);
  for (const s of subjects) {
    const option = document.createElement("option");
    option.value = s.name;
    option.textContent = `${s.name} (${s.count})`;
    select.append(option);
  }
  select.value = selected;
}

export function setQuizSubjectEnabled(enabled) {
  $("quiz-subject").disabled = !enabled;
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

export function showQuizStart(canStart) {
  showQuizPart("start");
  $("start-btn").disabled = !canStart;
}

export function showResult({ score, correct, total, missedTerms, retryTotal, retryCorrect }, reward) {
  showQuizPart("result");
  const rewardEl = $("result-reward");
  rewardEl.textContent = reward.text;
  rewardEl.classList.toggle("is-capped", reward.capped);
  $("result-checkin").textContent = reward.checkInText;
  $("result-score").textContent = String(score);
  $("result-correct").textContent = `${total}문제 중 ${correct}문제 정답`;
  const retry = $("result-retry");
  retry.hidden = retryTotal === 0;
  retry.textContent = `다시 풀기: ${retryTotal}문제 중 ${retryCorrect}문제 정답`;
  const list = $("result-missed");
  list.replaceChildren();
  if (missedTerms.length === 0) {
    const li = document.createElement("li");
    li.textContent = "없어요. 완벽한 라운드예요!";
    list.append(li);
    return;
  }
  for (const t of missedTerms) {
    const li = document.createElement("li");
    li.textContent = t;
    list.append(li);
  }
}

export function showQuestion(term, options, onPick, progressText, isRetry) {
  showQuizPart("question");
  $("question-progress").textContent = progressText;
  $("question-progress").classList.toggle("is-retry", isRetry);
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

export function showAnswerResult({ pickedIndex, correctIndex, message, good, nextLabel }) {
  const buttons = $("options").querySelectorAll(".option");
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIndex) btn.classList.add("is-correct");
    else if (i === pickedIndex) btn.classList.add("is-wrong");
  });
  $("feedback").textContent = message;
  $("feedback").className = "feedback " + (good ? "good" : "bad");
  $("next-btn").textContent = nextLabel;
  $("next-btn").hidden = false;
  $("next-btn").focus();
}

const pad2 = (n) => String(n).padStart(2, "0");

function formatWhen(timestamp) {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "최근 기록": one item per finished round, newest first.
export function renderHistory(records) {
  $("history-empty").hidden = records.length > 0;
  const list = $("history-list");
  list.replaceChildren();
  for (const r of records) {
    const li = document.createElement("li");
    li.className = "history-item";

    const head = document.createElement("div");
    head.className = "history-head";
    const when = document.createElement("span");
    when.className = "stat-label";
    when.textContent = `${formatWhen(r.finishedAt)} · ${r.subject}`;
    const score = document.createElement("strong");
    score.textContent = `${r.score}점`;
    head.append(when, score);

    const detail = document.createElement("p");
    detail.className = "history-detail";
    detail.textContent = `${r.total}문제 중 ${r.correct}문제 정답`;
    li.append(head, detail);

    if (r.missedTerms.length > 0) {
      const missed = document.createElement("p");
      missed.className = "history-missed";
      missed.textContent = "틀린 개념: " + r.missedTerms.join(", ");
      li.append(missed);
    }
    list.append(li);
  }
}

// Header profile bar. `canCheckIn` false = already checked in today.
export function renderProfile({ level, into, needed, coins, streak, canCheckIn, todayXp, dailyCap }) {
  const percent = Math.min(100, Math.round((into / needed) * 100));
  $("profile-level").textContent = `Lv ${level}`;
  $("xp-fill").style.width = `${percent}%`;
  $("xp-bar").setAttribute("aria-valuenow", String(percent));
  $("profile-xp").textContent = `${into}/${needed} XP`;
  const today = $("profile-today");
  today.textContent = `오늘 ${todayXp}/${dailyCap} XP` + (todayXp >= dailyCap ? " · 한도 도달" : "");
  today.classList.toggle("is-full", todayXp >= dailyCap);
  $("profile-coins").textContent = String(coins);
  $("profile-streak").textContent = String(streak);
  const btn = $("checkin-btn");
  btn.disabled = !canCheckIn;
  btn.textContent = canCheckIn ? "출석 체크" : "출석 완료";
}

export function setCheckInNote(message) {
  $("checkin-note").textContent = message || "";
}

/* ---------- Focus timer ---------- */

const BASE_TITLE = document.title;

// phase: "idle" (choose a length) | "running" | "done" (finished, bonus shown)
export function showFocus(phase) {
  $("focus-idle").hidden = phase !== "idle";
  $("focus-running").hidden = phase !== "running";
  $("focus-done").hidden = phase !== "done";
  if (phase !== "running") document.title = BASE_TITLE;
}

// timeText is "MM:SS"; fraction is 0..1. The page title shows the time too, so it can be read
// from another browser tab.
export function renderTimer(timeText, fraction) {
  const percent = Math.round(fraction * 100);
  $("focus-time").textContent = timeText;
  $("focus-fill").style.width = `${percent}%`;
  $("focus-bar").setAttribute("aria-valuenow", String(percent));
  document.title = `${timeText} · ${BASE_TITLE}`;
}

export function showTimerDone({ reward, subjectLabel }) {
  $("focus-reward").textContent = reward.text;
  $("focus-reward").classList.toggle("is-capped", reward.capped);
  $("focus-checkin").textContent = reward.checkInText;
  $("focus-subject").textContent = `퀴즈 과목: ${subjectLabel} (바꾸려면 퀴즈 탭에서 고르세요)`;
}

// Dot on the "집중" tab while a finished timer is waiting to be seen.
export function setFocusAlert(on) {
  document.querySelector('.tab[data-tab="focus"]').classList.toggle("has-alert", on);
}
