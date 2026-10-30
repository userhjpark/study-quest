// All DOM work lives here. No game rules: main.js decides, this file only shows.
// User text is always inserted with textContent (never innerHTML) so typed
// concepts cannot inject HTML.

import { xpShown } from "./history.js";

const $ = (id) => document.getElementById(id);

// The three subject drop-downs (quiz tab, 집중 start screen, 집중 finish screen).
const SUBJECT_SELECT_IDS = ["quiz-subject", "focus-subject-select", "done-subject-select"];

// Separator button names in the HTML -> the real character.
const SEP_BY_NAME = { ":": ":", "/": "/", tab: "\t" };

let pendingLeave = null;
let pendingDelete = null; // what "삭제" in the multi-delete dialog does
let quitHandlers = null; // { onQuit, onKeep } while the quit-timer dialog is open

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
  $("pdf-btn").addEventListener("click", () => $("pdf-input").click());
  $("pdf-input").addEventListener("change", () => {
    const file = $("pdf-input").files[0];
    $("pdf-input").value = ""; // so the same file can be chosen again later
    if (file) h.onPdfFile(file);
  });

  // Profile
  $("checkin-btn").addEventListener("click", h.onCheckIn);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) h.onVisible();
  });

  // Focus timer
  document.querySelectorAll(".duration-btn").forEach((btn) => {
    btn.addEventListener("click", () => h.onFocusStart(Number(btn.dataset.minutes)));
  });
  $("focus-custom-form").addEventListener("submit", (e) => {
    e.preventDefault();
    h.onFocusCustom($("focus-custom-input").value);
  });
  $("focus-custom-input").addEventListener("input", () => setFocusCustomError(""));
  $("focus-cancel-btn").addEventListener("click", h.onFocusCancel);
  $("focus-quit-btn").addEventListener("click", h.onFocusCancel);
  $("focus-resume-btn").addEventListener("click", h.onFocusResume);
  // Quit dialog (the timer is paused while it is open). "그만하기" runs onQuit. Any other way of
  // closing it ("계속하기", Esc) runs onKeep, which resumes the timer.
  const quitDialog = $("quit-focus-dialog");
  $("quit-focus-stay-btn").addEventListener("click", () => quitDialog.close());
  $("quit-focus-confirm-btn").addEventListener("click", () => {
    const handlers = quitHandlers;
    quitHandlers = null; // cleared first, so the "close" event below does not call onKeep
    quitDialog.close();
    if (handlers) handlers.onQuit();
  });
  quitDialog.addEventListener("close", () => {
    const handlers = quitHandlers;
    quitHandlers = null;
    if (handlers) handlers.onKeep();
  });

  // Notes: multi-select delete
  $("select-toggle-btn").addEventListener("click", h.onSelectToggle);
  $("select-all-btn").addEventListener("click", h.onSelectAll);
  $("select-delete-btn").addEventListener("click", h.onSelectDelete);
  const deleteDialog = $("delete-dialog");
  $("delete-cancel-btn").addEventListener("click", () => deleteDialog.close());
  $("delete-confirm-btn").addEventListener("click", () => {
    const action = pendingDelete;
    pendingDelete = null;
    deleteDialog.close();
    if (action) action();
  });
  deleteDialog.addEventListener("close", () => { pendingDelete = null; });

  document.querySelectorAll(".open-notes-btn").forEach((btn) => {
    btn.addEventListener("click", h.onOpenNotes);
  });
  $("focus-quiz-btn").addEventListener("click", h.onFocusQuiz);
  $("focus-back-btn").addEventListener("click", h.onFocusBack);

  // Quiz
  // The subject can be chosen on the quiz tab and on the 집중 start and finish screens; all three
  // show the same choice.
  for (const id of SUBJECT_SELECT_IDS) {
    $(id).addEventListener("change", () => h.onQuizSubject($(id).value));
  }
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

export function askDelete(count, onConfirm) {
  pendingDelete = onConfirm;
  $("delete-title").textContent = `${count}개를 삭제할까요?`;
  $("delete-dialog").showModal();
}

export function askQuitFocus(handlers) {
  const dialog = $("quit-focus-dialog");
  if (dialog.open) return;
  quitHandlers = handlers;
  dialog.showModal();
}

// Small "내 개념을 추가해보세요" box on the 집중 and 퀴즈 start screens.
export function setOwnConceptsHint(visible) {
  document.querySelectorAll(".own-hint").forEach((el) => { el.hidden = !visible; });
}

export function showTab(name) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === name);
  });
  $("tab-notes").hidden = name !== "notes";
  $("tab-focus").hidden = name !== "focus";
  $("tab-quiz").hidden = name !== "quiz";
  $("tab-character").hidden = name !== "character";
}

/* ---------- Notes ---------- */

// Buttons above the list. `picked` = how many visible concepts are selected, `visible` = how many
// are shown; the "전체 선택" button turns into "전체 해제" once all visible ones are selected.
export function renderSelectBar({ selecting, total, visible, picked }) {
  const toggle = $("select-toggle-btn");
  toggle.textContent = selecting ? "선택 끝내기" : "선택";
  toggle.disabled = total === 0;
  $("select-all-btn").hidden = !selecting;
  $("select-all-btn").disabled = visible === 0;
  $("select-all-btn").textContent = visible > 0 && picked === visible ? "전체 해제" : "전체 선택";
  const del = $("select-delete-btn");
  del.hidden = !selecting;
  del.disabled = picked === 0;
  del.textContent = `선택 삭제 (${picked}개)`;
}

export function setSelectStatus(message) {
  $("select-status").textContent = message || "";
}

function createConceptItem(c, missed, onDelete, pick) {
  const li = document.createElement("li");
  li.className = "concept-item";

  if (pick.selecting) {
    // Selection mode: a checkbox in front, the whole row toggles it, and there is no 삭제 button.
    const label = document.createElement("label");
    label.className = "pick";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = pick.selectedIds.has(c.id);
    box.setAttribute("aria-label", `${c.term} 선택`);
    box.addEventListener("change", () => pick.onSelect(c.id));
    label.append(box);
    li.classList.add("is-selectable");
    li.classList.toggle("is-selected", box.checked);
    li.append(label);
    li.addEventListener("click", (e) => {
      if (e.target === box || label.contains(e.target)) return; // the checkbox handles its own click
      box.checked = !box.checked;
      pick.onSelect(c.id);
    });
  }

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

  li.append(text);
  if (!pick.selecting) li.append(del);
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
export function renderConcepts({
  groups, total, showHeaders, collapsed, missed, onDelete, onToggle, selecting = false, selectedIds = new Set(), onSelect = () => {},
}) {
  const pick = { selecting, selectedIds, onSelect };
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
      for (const c of group.concepts) list.append(createConceptItem(c, missed, onDelete, pick));
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

// Puts text below what is already in the box (the caller decides the exact text).
export function setBulkText(text) {
  $("bulk-text").value = text;
}

// PDF line under the button: `status` is a progress/result text, `error` a red message.
export function setPdfState({ status = "", error = "", detail = "", busy = false }) {
  $("pdf-status").textContent = status;
  $("pdf-error").textContent = error;
  $("pdf-detail").textContent = detail; // small grey technical text (failed step, error name, message)
  $("pdf-btn").disabled = busy;
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
  for (const id of SUBJECT_SELECT_IDS) {
    const select = $(id);
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

export function showResult({ correct, total, missedTerms, retryTotal, retryCorrect }, reward) {
  showQuizPart("result");
  const rewardEl = $("result-reward");
  rewardEl.textContent = reward.text;
  rewardEl.classList.toggle("is-capped", reward.capped);
  $("result-checkin").textContent = reward.checkInText;
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
    score.textContent = `+${xpShown(r)} XP`;
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
// from another browser tab. A paused timer shows "일시정지됨" with 계속하기 / 그만하기.
export function renderTimer(timeText, fraction, paused) {
  const percent = Math.round(fraction * 100);
  $("focus-running").classList.toggle("is-paused", paused);
  $("focus-status").textContent = paused ? "일시정지됨" : "집중하는 중";
  $("focus-note").textContent = paused
    ? "타이머가 멈춰 있어요. 계속하기를 누르면 남은 시간부터 이어져요."
    : "다른 탭으로 옮겨도 타이머는 계속 돌아가요.";
  $("focus-cancel-btn").hidden = paused;
  $("focus-paused-actions").hidden = !paused;
  $("focus-time").textContent = timeText;
  $("focus-fill").style.width = `${percent}%`;
  $("focus-bar").setAttribute("aria-valuenow", String(percent));
  document.title = `${paused ? "일시정지 " : ""}${timeText} · ${BASE_TITLE}`;
}

export function setFocusCustomError(message) {
  $("focus-custom-error").textContent = message || "";
}

export function clearFocusCustom() {
  $("focus-custom-input").value = "";
  setFocusCustomError("");
}

// The "오늘의 공부" card. `s` is the object from summarizeToday (rewards.js).
export function renderToday(s) {
  $("today-focus").textContent = `${s.focusMinutes}분`;
  $("today-rounds").textContent = `${s.rounds}회`;
  $("today-accuracy").textContent = s.accuracy === null ? "-" : `${s.accuracy}%`;
  $("today-streak").textContent = `${s.streak}일`;
  $("today-note").textContent = s.focusMinutes === 0 && s.rounds === 0
    ? "아직 오늘 공부 기록이 없어요. 타이머나 퀴즈로 시작해 보세요!"
    : s.questions > 0 ? `오늘 ${s.questions}문제 중 ${s.correct}문제를 맞혔어요.` : "";
}

export function setFocusBonusInfo(text) {
  $("focus-bonus-info").textContent = text;
}

export function showTimerDone({ reward }) {
  $("focus-reward").textContent = reward.text;
  $("focus-reward").classList.toggle("is-capped", reward.capped);
  $("focus-checkin").textContent = reward.checkInText;
}

// Dot on the "집중" tab while a finished timer is waiting to be seen.
export function setFocusAlert(on) {
  document.querySelector('.tab[data-tab="focus"]').classList.toggle("has-alert", on);
}

// Dot on the "캐릭터" tab until the first animal has been picked.
export function setCharacterAlert(on) {
  document.querySelector('.tab[data-tab="character"]').classList.toggle("has-alert", on);
}
