# CLAUDE.md

Guidance for Claude Code in this repository. Read fully at the start of every session.

## Project

**Study with Pet** (renamed from "Study Quest" on Oct 31; tagline "펫이랑 같이 공부해요"; the GitHub repo is still `study-quest` and the live URL is unchanged on purpose): a study-game website for a university assignment (deadline **November 1, 23:59 KST**). Students who struggle with motivation enter "concept - definition" pairs for any subject; the site turns them into quizzes and wraps studying in game mechanics. **No AI, no paid APIs. Everything must be free to run.**

All code must be written from scratch in this repo. No templates, no reused code from earlier projects, tutorials, or downloaded repositories. Do not copy anything from `../business-agent-lab` (and do not modify it).

## Technical rules

- Plain HTML, CSS, JavaScript only. No build tools, no bundlers, no npm dependencies.
- Deployed free on GitHub Pages (static files served from the repo).
- Stages 1-3 store data in localStorage. Wrap storage access in try/catch.
- Must work well on phones (mobile-first layout, large tap targets).
- UI language: Korean (use `<html lang="ko">`). The README stays in English.
- Timer must be timestamp-based (store the end time, compute remaining time), because mobile browsers throttle background tabs.
- Opening `index.html` by double-click (`file://`) may not work if scripts use ES modules (browsers block module imports from `file://`). Provide a simple way to run locally (e.g. `python3 -m http.server` from the repo root, then open `http://localhost:8000`) and document it in the README.
- Logic files are ES modules. Add a tiny `package.json` containing only `{"type":"module"}` so Node can import them for tests (no dependencies, so the no-npm rule still holds).
- Split files by role (one responsibility per file) so 5 key files can be chosen for grading.

## Build stages (in this order, one at a time)

**Stage 1 (core)**
- Concept notes: add/delete concept-definition pairs; a few sample concepts by default.
- Multiple-choice quiz: wrong options are *distinct* definitions of other concepts (skip any equal to the correct one). With fewer than 4 concepts, block the quiz and show a message.
- Missed concepts appear more often in later quizzes. Combo bonus (quiz points) for consecutive correct answers.

**Deploy step (right after Stage 1)**: publish to GitHub Pages so a working deployed URL exists early. Verify it loads and works there, record the URL, then continue to Stage 2. **Done Oct 28:** https://userhjpark.github.io/study-quest/ (Pages from `main`, `/ (root)`); all files return 200.

**Stage 1 extensions (approved Oct 28, built before Stage 2)**
- Subjects: every concept belongs to a subject (old data without one becomes "미분류"). The Quiz tab picks one subject or "전체 과목"; the fewer-than-4 rule and the wrong options use only the chosen subject. Duplicate = same concept within the same subject.
- Bulk import on the Notes tab: a collapsed "여러 개 한 번에 추가" section, one concept per line, one subject per import. Separator is auto-detected (Tab if the text contains a tab, otherwise ":"; full-width "：" counts as ":"), changeable with `:` `/` `Tab` buttons. Split only at the FIRST separator. A preview marks lines as ok / duplicate (skipped) / invalid (red, skipped) before saving. The single-entry form stays as is.
- Parsing lives in a pure logic file (`js/importer.js`, no DOM) and is tested in `tests/logic.test.js`. The preview accepts plain rows, so other sources (e.g. PDF) can feed it.
- Sample concepts: two subjects (생명과학, 한국사) with at least 4 concepts each, so subject switching can be demoed.

**Round rules (decision changed Oct 29)**
- *Old rule (Oct 28):* a concept could appear twice in one round, so missed ones got drawn more often. *Why it was dropped:* in manual testing, a 5-question round over 5 concepts showed only 3 different ones (two repeated, two never asked), so small subjects could not be reviewed fully.
- *New rule:* in the main part each concept appears at most once. With 10 or fewer concepts, all of them are asked (random order). With more than 10, 10 distinct concepts are drawn, and frequently-missed ones are more likely to be drawn (weighting kept, weight = 1 + misses, capped).
- *Retry part ("다시 풀기"):* concepts answered wrong in the main part are asked once more at the end, shown clearly in the progress label. The retry gives no points, no combo, and does not change the saved miss counts (otherwise one correct retry would cancel the miss the weighting is based on). Wrong in the retry is not asked a third time.
- Verification evidence: `tests/logic.test.js` simulates 1000 rounds over 20 concepts and prints how often a missed concept is included vs a never-missed one.

**Stage 2 (core)**
- Focus timer: 10 / 15 / 25 min, plus 1 min for demos, plus a custom length of 1-120 minutes ("직접 설정"). When it ends, a "집중 완료!" screen offers a "퀴즈 시작" button (see Timer UI below).
- XP, levels, coins. Daily check-in and streak bonus.
- XP and coins come mainly from correct quiz answers. Finishing the timer gives only a small bonus, so leaving the timer running cannot be farmed for XP.
- Daily XP cap (limits leaderboard cheating).
- **Approved numbers (Oct 29)**: XP per round = main-part score (10 per correct + combo bonus); coins = 1 per correct answer + 5 for a perfect round; daily XP cap **600** (a perfect round with combos is almost 200 XP, so 300 would block after 2 rounds); timer bonus by length (see "Timer bonus change" below: 1 XP per finished minute, 1 coin per 5 finished minutes, at most 180 minutes per day), nothing if quit early; level L needs 50*L*(L-1) total XP; check-in 10 XP + 5 coins + 1 coin per streak day (max +7), check-in XP is outside the cap; **finishing a quiz round or a focus timer also does today's check-in automatically** (bonus only once per day, whichever way it happens; shown on the result screen); the profile bar also shows "오늘 N/600 XP"; a missed day resets the streak to 1.
- **Timer UI**: separate "집중" tab. When the timer ends, show a "집중 완료!" screen with the bonus and a "퀴즈 시작" button (no automatic quiz start); one tap starts a round in the selected subject, with the usual "need 4 concepts" message if needed.
- **Timer bonus change (decision Oct 29, after the pause retest):**
  - *Old rule:* a fixed bonus of 5 XP + 2 coins per finished timer, at most 3 per day.
  - *New rule:* 1 XP per finished minute and 1 coin per 5 finished minutes (coins are computed from the day's total minutes, so short timers do not lose the remainder). At most **180 minutes per day** count (so at most 180 XP and 36 coins a day from timers). A timer that crosses the limit counts only the minutes that are left; when none are left the finish screen says the day's bonus is used up. The XP still counts toward the **600 daily XP cap** (the minutes are used up even if the XP cap cuts the XP). Only finished timers pay; quitting gives nothing.
  - *Why:* with custom lengths (up to 120 min), a fixed bonus would pay the same for 1 minute and for 25. The minute cap, not a count limit, now stops farming.
  - Check-in still happens automatically when a timer finishes (also when the minute cap is used up).
  - The finish screen shows the minutes that counted and the bonus, and says so when the minute cap or the XP cap cut it.
  - Custom length: the field accepts only plain digits, 1-120 (`parseMinutes` in `timer.js`); otherwise a clear red message is shown and nothing starts.
- **Quiz subject from the focus tab (decision Oct 29):** a "공부할 과목" dropdown on the 집중 start screen and a "퀴즈 과목" dropdown on the "집중 완료!" screen, kept in sync with the 퀴즈 tab's dropdown (one shared choice, `quizSubject`, remembered; default is the last subject used). "퀴즈 시작" starts a round in that subject, with the usual "need 4 concepts" message. *Why:* after a timer the quiz always used the subject last picked on the 퀴즈 tab and the user could not choose it.
- **Pause on "그만하기" (decision Oct 29, after the step 5 test):** tapping "그만하기" pauses the timer (the remaining time is saved) and opens the in-page dialog "집중을 그만할까요?". "계속하기" (or Esc) resumes from the remaining time with a NEW end time counted from now; "그만하기" in the dialog ends the timer with no bonus. *Why:* with a running timer, the time kept going down while the dialog was open, so "계속하기" lost time. A paused timer stores `pausedMs` instead of an end time, so it can never finish and a reload keeps it paused ("일시정지됨" with 계속하기 / 그만하기; the "그만하기" there asks again). The logic is in `timer.js` (`pauseTimer`, `resumeTimer`, `isPaused`) with tests.
- **Tab order and default tab (decision Oct 29):** tabs are **집중 · 노트 · 퀴즈** and the page opens on **집중**. *Why:* the study flow is focus and study, review the notes, then test yourself with a quiz. Also, after a reload during a timer the app used to open on 노트 and the running timer looked like it had disappeared; opening on 집중 shows it.
- **"내 개념을 추가해보세요" hint (decision Oct 29):** while the user has no concepts of their own (only the built-in samples, ids `s1`-`s10`; computed by `hasOwnConcepts` in `concepts.js`, so it comes back if they delete their own again), the **퀴즈** start screen shows a small box with a "노트 열기" button. It was first on the 집중 tab as well, but the user removed it there (**Oct 29**): a timer screen does not need it. *Why it exists:* the app opens on 집중, so a new user might never see the Notes tab and would only practice with the samples.
- Stage 3 shop prices: set so the first item is affordable after 2-3 rounds (see Stage 3 below for the final prices).
- **Wording (decision Oct 30): no "점수/점" anywhere; the same number is shown as XP** (quiz top box "XP", "정답! +10 XP (콤보 x2)", result screen big line "N문제 중 M문제 정답" then "+N XP, +N 코인", history item "+N XP"). Internal names (`score`) are unchanged. The history item shows the XP really paid after the daily cap: the record gets an optional `xpPaid` (set in `showResults` after `rewards.js` ran; `xpShown` in `history.js` falls back to `score` for older records without it).
- **"최근 기록" section** under the Quiz tab (built Oct 29): shows the last 10 rounds with date, subject, score, correct count, and the missed concepts, saved in localStorage. It must share one **round-result record** with the XP/coin logic: when a round ends, `main.js` builds `{ finishedAt, subject, score, correct, total, retryCorrect, retryTotal, missedTerms }` (`finishedAt` as a timestamp; missed concepts as text so deleted concepts still show). `rewards.js` computes XP/coins from this record, and the history list stores the same record (keep the newest 10). Build the record in a pure function so it can be tested.

**Stage 3 (core, built Oct 30)**
- Character customization: buy and equip colors, hats, face items with coins.
- **Approved design (Oct 30):**
  - 4 animals: 고양이, 강아지, 햄스터, 카피바라, drawn as original simple SVG shapes in code (`avatar-art.js`; no images, nothing resembling a known character). Items are drawn once and placed on each animal through shared anchor points (crown, eyes, cheeks, ears, body), so every item fits every animal.
  - The first animal is free and is picked in the 4th tab **캐릭터** (a "?" avatar in the header and a dot on the tab until chosen; no popup). The other animals cost 60 coins and can be switched freely once owned. Colour items change the fur colour.
  - Catalog (`character.js`): colours 민트 25 / 하늘 25 / 분홍 25 / 노랑 35 / 금색 120; hats 비니 30 / 야구 모자 40 / 연필 머리띠 35 / 마법사 모자 70 / 왕관 150; face 동그란 안경 30 / 선글라스 50 / 볼터치 25; props 헤드폰 50 / 책가방 45. The cheapest items (25 coins) are affordable after about two rounds (a perfect round gives 15 coins). One item per slot; a new one replaces the old one (연필 머리띠 is in the hat slot).
  - **Try-on:** tapping something not owned shows it on the big picture (with what is worn) with "구매 (N코인)" and "원래대로". Only one thing is tried at a time; leaving the tab resets it; it never changes saved data or coins; the header avatar always shows what is really worn. Tapping something owned puts it on (or takes it off if it is on). Buying equips at once. Not enough coins: "코인이 N개 부족해요." and nothing changes.
  - Saving: the character has its own key `studyquest:character`; coins stay in the profile. A purchase saves the character first and the coins second (worst case a free item, never a lost purchase). Broken saved data is repaired on load (`sanitizeCharacter`).
  - Files: `character.js` (rules, pure), `avatar-art.js` (shape data, pure), `ui-character.js` (SVG drawing and the shop screen). `tests/avatar-gallery.html` shows every animal with every item (not linked from the app).

**Visual refresh (decision Oct 30 evening, "cute animal friends"), second round Oct 31 (1-hour time box, design only):**
- Palette as CSS variables in `:root`: apricot `--primary #F9A03F` (buttons use dark brown text, white on this apricot is only ~3:1), one teal accent `--accent`, warm brown text, cream panels. **Page background is a soft warm off-white `#FAF5EC`** (pure white was tiring on the eyes); inputs, options, dialogs and shop items use a slightly lighter `--surface #FFFDF8`, panels use `--cream #F5E4CC`. No purple anywhere.
- **Font: IBM Plex Sans KR only** (Google Fonts, SIL Open Font License; weights 400/500/700 only: 700 for headings, logo, timer digits and the result line). Replaced Jua + Noto Sans KR. Its digits are all 600 units wide (checked in the font file), so the timer does not jitter. List it as a third-party font in the README next to pdf.js.
- **Dark mode:** the same variable names with dark values (`:root[data-theme="dark"]`, and `@media (prefers-color-scheme: dark)` when nothing is chosen). Follows the system by default; a 🌙/☀️ button in the header overrides it and the choice is saved as `studyquest:theme` (`js/theme.js`, pure, tested). A tiny inline script in `<head>` applies the saved choice before the first paint. The character always sits on a light circle (`--avatar-bg`) so its outlines stay visible. Contrast was checked for both palettes (text, muted, ink, accent, good/bad on their backgrounds, text on apricot, all at least 4.5:1; the apricot button edge against the page is ~2.7:1 in light mode, the label text is what identifies the button).
- **Timer:** an SVG ring (`pathLength` 100) whose coloured arc shrinks as time passes, big digits in the middle, the character beside it (wraps below on very narrow screens). Pause/quit buttons and dialogs are unchanged; paused makes the arc grey. `prefers-reduced-motion` turns all transitions off.
- Flat sections instead of cards; boxes only for the today summary, PDF box, rewards, dialogs and shop items. Header avatar 64px; the character also shows on all three 집중 screens (`renderFocusAvatar`).
- Only CSS, `index.html`, `ui.js` (ring + theme button), `ui-character.js` and a few lines in `main.js` changed; game logic is untouched.

**Pet name and rename (decision Oct 31, built Oct 31):** the visible name is "Study with Pet" (logo, page title) with the tagline "펫이랑 같이 공부해요" under the logo. The user can name the pet: the first-pick screen asks "이름을 지어주세요" (optional, placeholders "감자, 콩이"; empty = the animal's own name, e.g. "고양이"); the 캐릭터 tab has a rename form later (empty saves back to the animal's name). Rules in `js/pet-name.js` (pure, tested): trimmed, inner spaces collapsed, control characters removed, at most 10 characters (an emoji counts as one), too long = error and nothing is saved. The name is stored in the character data (`character.name`, repaired by `sanitizeCharacter`) and belongs to the pet, so it stays when another animal is bought or worn. Korean particles are chosen from the last letter (`hasBatchim`: Hangul syllables decoded exactly, digits and l/m/n/r judged by how Korean says them, trailing punctuation skipped): 랑/이랑 ("감자랑", "별이랑") and 가/이 ("감자가", "별이"). Lines using the name: 집중 start ("감자랑 같이 집중해 볼까요?"), while the timer runs ("감자랑 같이 25분 집중!"), 집중 완료 ("감자가 기뻐해요!"), quiz result ("감자가 기뻐해요!", or "감자가 곁에서 응원해요!" when nothing was right). With no pet chosen the lines are hidden.

**After Stage 3 (planned Oct 29, card built Oct 30):**
- **"오늘의 공부" card at the top of the 집중 tab (decision Oct 30, built Oct 30):** shows today's focus minutes, quiz rounds, accuracy, and streak. *Changed from the first plan:* the numbers do NOT come from the bonus counter (it stops at 180) or from the 10-round history. `profile.daily` has its own counters that reset when the date changes: `focusTotal` (all finished timer minutes, no cap), `rounds`, `correct`, `questions` (main part of each finished round, retry not counted). `summarizeToday` in `rewards.js` is a pure function with tests; `accuracy` is `null` (shown as "-") when no question was answered. Quitting a timer adds nothing.
- **7-day focus chart: skipped by the user (Oct 30).** It would need a per-day record (date -> minutes, last 7 days). Future work.

**Stage 4 = PDF import (decision Oct 30).** The user chose Option A. The leaderboard (Option B) is dropped and goes to future work. PDF import is time-boxed to about 2 hours of work; if it is not working well by then, stop and list it as future work with what we learned.

*PDF import (Option A)*
- Read text-based PDFs only (no scanned/OCR) with pdf.js, loaded from a CDN at a pinned version (do not commit the library; mention it as a third-party library in the README).
- Size and page limits (e.g. a few MB, a few dozen pages; decide when building). Show a clear message for scanned or too-large files.
- Extracted text goes through the same `importer.js` parsing and the same preview as bulk import.
- **Built Oct 30:** `pdf-text.js` (pure, tested), `pdf-reader.js` (browser, pdf.js 6.4.299 legacy build from jsDelivr, loaded only when a file is chosen; 3.11.174 as a fallback, added Oct 30 after the iPhone report), a button at the top of the bulk import section (renamed "여러 개 한 번에 추가 (PDF 가능)") with a 3-line guide. Limits 10 MB / 50 pages; text is appended to the paste box (decision Oct 30).
- **Wrapped lines (fixed Oct 30 after the user's real test, 5 of 7 errors):** `joinWrappedLines` uses the position data from pdf.js. A line without a ":" is joined to the line above when that line has a ":", reaches close to the right edge of the text area (within max(5 letter heights, 12% of the width) of the page's right edge, ignoring the top 10% of line ends), and the vertical gap is at most 2 letter heights. Between two Hangul letters nothing is added (Korean breaks inside words), a space is kept if the break had one or a Latin word/number is involved. Only within a page.
- **Lessons:** (1) pdf.js 6 has no `doc.destroy()` (use the loading task); my code swallowed the real error behind a generic message, so every failure now logs its step with `console.error`. (2) Geometry beats guessing: PDF text arrives as pieces with positions, not as paragraphs.
- **Known limits:** two-column pages and tables can come out in odd order; a wrapped definition whose first line is short, or that continues on the next page, is not joined; a heading directly under a full-width concept line may be glued to it.

*Dropped (Oct 30): Firebase leaderboard* (future work). It would have been: a Firebase free-tier global ranking showing only players near me, plus teams via team code; anonymous sign-in with a nickname only; Firestore Security Rules so users can only write their own score doc and score jumps are bounded. No Firebase is used now, so there is no `firebase-config.js`. **Never commit** service-account JSON, Admin SDK keys, or any private key.

## Testing

- A small Node script (`tests/logic.test.js`, no npm packages, run with `node tests/logic.test.js`) tests pure logic: quiz option picking, weighting of missed concepts, combo, XP cap, streaks, levels. Logic files must therefore be importable by Node without a browser (keep DOM code out of logic modules).
- A short manual UI checklist in `tests/manual-checklist.md`.
- Verification must include one edge case or limitation (e.g. fewer than 4 concepts blocks the quiz).

## How we work

- The user is not familiar with the terminal or coding. Before running a command, explain in simple words what it does.
- **Do not write code right away.** Show the file structure and a step-by-step plan first and wait for approval.
- Build one stage at a time. After each stage: tell the user how to test it themselves, then make a git commit with a clear message.
- Commit messages end with the Co-Authored-By line given in the session's attribution reminder.
- Keep a meaningful commit history (no giant single commit).

## Planned key files (max 5 for grading)

`quiz.js` (quiz logic), `rewards.js` (XP / streak / coins logic), `character.js`, a fifth file chosen from `timer.js`, `importer.js` or the PDF file (the leaderboard is dropped), `ui.js`.

## Assignment requirements (summary)

**Submit via LMS:** one MP4 video (5-10 min; never upload it to GitHub), the public GitHub repo URL, the deployed project URL.

**Video must include:** what was built and for whom; main work steps and decisions; selected Claude Code evidence; a working demo; three effective practices; three difficulties (response or remaining problem); checks and known limitations. Verification uses representative cases plus one edge case, failure, or limitation. Do not submit a full conversation transcript.

**Repo:** new public repo, meaningful commit history, human-readable `README.md` of **at most 1,200 words** containing: purpose and intended user; how to run/use; short account of work process; selected Claude Code evidence and verification results; three effective practices and three difficulties; known limitations (include the items below); at most five key source files for grading. At most **six** agent excerpts or screenshots. The README must be accurate and in the user's own voice, not raw agent output.

**Never commit:** credentials, API keys, personal data, dependencies, build output, large raw data, video files.

**Grading (20):** purpose and scope 3; process and agent evidence 5; working project 4; verification 2; reflection on practices and difficulties 4; documentation and readability 2.

## Known limitations to list in README

- localStorage-based XP cap, coins, and streaks can be bypassed by editing browser data or changing the device clock. Only a server-side check (such as the dropped leaderboard idea) could limit this, and even that can only bound score jumps.
- Data lives per browser/device; clearing site data erases progress.
- Subjects cannot be renamed or deleted; a subject exists as long as it has concepts.
- If the site is open in two tabs at once, one tab can overwrite progress saved by the other, because each tab keeps its own copy in memory (seen on Oct 29: a finished round overwrote a value changed in the console without a reload). Use one tab at a time.
- XP and coins are given when a round finishes; quitting midway gives nothing.
- Coins are not limited by the daily cap (only XP is).
- Purchases are not undoable and items cannot be sold; only the coin check protects the shop, and coins live in editable localStorage like everything else.
- **PDF import works best for summary notes and word lists in "개념: 정의" form, not for unstructured lecture slides.** Real test (Oct 30, a 10-page 디지털창업 lecture PDF): 17 concepts added, 2 duplicates, 378 error lines; only about 12 of the 17 were usable concepts. Causes seen: (1) lines that are not concepts but contain a ":" ("Source: Airbnb Newsroom…", slide headings like "핵심: …" and "학생 창업 질문: …"); (2) text of the next item glued on ("(AFFORDABLE LOSS)" ends with "– 브리콜라주"); (3) missing spaces where one sentence ends and the next starts on a new line ("시작된다변화", "눈’같은"), because the no-space rule for Hangul joins also applies across sentence ends. Picking concepts out of free text would need AI, which this project avoids to stay free. That is why the preview step matters: the user checks and edits before adding, and can delete bad concepts later. Also: scanned PDFs are not supported (no OCR), pdf.js needs internet the first time (CDN), two-column pages and tables can come out in odd order, and a definition that continues on the next page is not joined.
- **iPhone Safari (reported Oct 30, resolved Oct 30):** the same 컴활 PDF that worked in desktop Chrome first failed on an iPhone ("파일이 깨졌을 수 있어요"). After the technical error line and the fallback to an older pdf.js (3.11.174, classic script) were added, **PDF import works on iPhone Safari** (the user's retest). The status line says "호환 모드" when the fallback is used. The fallback is less tested with Korean PDFs than 6.4.299; if text looks garbled, report it.
- (Add more as they are discovered.)

## Future work to list in the README

- A daily study to-do list (not part of this project).
- The Firebase leaderboard (global ranking near me, teams via team code, anonymous sign-in with a nickname, Security Rules bounding score jumps): dropped on Oct 30 in favour of PDF import.
- A 7-day focus-minutes bar chart (needs a per-day record that is not saved now): skipped on Oct 30.
- PDF import improvements (not built): keep sentence ends from being glued without a space, skip obvious non-concept lines (headings, "Source:"), stop glue-on of the next item, join definitions across pages, OCR for scans. Choosing concepts from free-text slides would need AI and is out of scope.
- More animals (돼지, 호랑이, 원숭이): the art system makes a new animal one more entry in `avatar-art.js` plus `character.js`, but it was not built.

## Status

**Oct 28 (done):**
- Rules finalized (deadline, local-run rule, `package.json` module decision, quiz-based XP/coins).
- Repo: https://github.com/userhjpark/study-quest (public, pushed).
- Stage 1 built, tested (24 Node tests + manual checklist) and committed: notes, 10-question quiz rounds with result screen, missed-concept weighting and "Missed N×" badge, combo points, in-page leave dialog. A concept may appear twice in one round (kept on purpose so weighting stays meaningful).
- GitHub Pages is live: https://userhjpark.github.io/study-quest/
- Approved the Stage 1 extensions above (Korean UI, subjects, bulk import) and the Stage 4 A/B choice.

**Oct 29:**
- Subjects, `js/importer.js`, the Korean UI, and the new round rules (each concept once + "다시 풀기" retry) passed the user's manual tests. Committed and pushed in three commits (up to `86458e7`).
- Notes tab change passed the user's retest (including phone size in DevTools), committed and pushed (`ca7c7f2`): subject filter buttons (전체 + one per subject, choice remembered), "전체" view grouped by subject with collapsible headers "과목 (개수)" (collapsed state remembered), subject tag and "N번 틀림" badge kept. Pure helpers `groupBySubject`, `visibleGroups`, `normalizeFilter` in `concepts.js`.
- Added the "최근 기록" plan to Stage 2 (see above).

**Stage 1 is complete** (including subjects, bulk import, Korean UI, round rules with retry, Notes filter/groups).

**Stage 2 is complete (Oct 29).** Built in six steps, each committed; steps 4 and 5 (UI) passed the user's manual tests:
- `js/history.js`: round-result record + "최근 기록" (newest 10).
- `js/rewards.js`: XP, levels (50*L*(L-1)), coins, daily XP cap 600, timer bonus by length (1 XP/min, 1 coin/5 min, max 180 min/day), daily check-in + streak, automatic check-in when a round or timer finishes (once per day in either order).
- `js/timer.js`: timestamp-based focus timer (1/10/15/25 min buttons or a custom 1-120 min) with pause/resume; "집중" tab with a "집중 완료!" screen and a "퀴즈 시작" button; the page title and a dot on the tab show the state; "그만하기" pauses the timer and asks for confirmation in an in-page dialog (see the Pause decision above).
- Header profile bar: level, XP bar, coins, streak, "오늘 N/600 XP", check-in button.
- Leaving a running quiz round for either 노트 or 집중 shows the in-page leave dialog.
- Tests: 147 Node tests pass (`node tests/logic.test.js`); manual checklist has a Stage 2 section and a section for the new-user hint.
- **After the Stage 2 commit (Oct 29):** pause-on-quit, the tab order 집중 · 노트 · 퀴즈 with 집중 as the default and the "내 개념을 추가해보세요" hint (passed the user's retest); then the custom timer length, the minute-based timer bonus with the 180-minute cap, and the quiz-subject dropdowns on the 집중 tab (see the decisions above). These passed the user's retest and were pushed (`f0e6ef4`, Oct 29).
- New known limitations were added above (two tabs, XP only given when a round ends, coins not capped). Also: no sound or notification when the timer ends.

Live site: https://userhjpark.github.io/study-quest/ (Stage 3 pushed Oct 30; files verified identical to local, and the user's phone check of the live site passed).

**Stage 3 is complete (Oct 30).** Built in five steps; the 캐릭터 tab passed the user's manual test and the gallery page was checked by the user:
- `js/character.js` (rules), `js/avatar-art.js` (4 animals + 15 items as shape data), `js/ui-character.js` (renderer + shop screen), `tests/avatar-gallery.html`.
- Header avatar, a dot on the 캐릭터 tab until the first friend is picked, first-pick screen, shop with category chips, try-on, buying, equipping.
- Tests: 191 Node tests pass; manual checklist has a "Stage 3: Character" section.

**Files now:** `index.html`, `css/style.css`, `js/main.js`, `js/ui.js`, `js/storage.js`, `js/concepts.js`, `js/quiz.js`, `js/importer.js`, `js/history.js`, `js/rewards.js`, `js/timer.js`, `js/character.js`, `js/avatar-art.js`, `js/ui-character.js`, `js/pdf-text.js`, `js/pdf-reader.js`, `package.json`, `tests/logic.test.js`, `tests/manual-checklist.md`, `tests/avatar-gallery.html`. No README yet (due before submission; max 1,200 words, English, user's own voice).

**Oct 30:** Stage 4 decided: PDF import (leaderboard dropped, 7-day chart skipped).
- "오늘의 공부" card on the 집중 tab (own daily counters in the profile), passed the user's test. Quiz wording changed from "점수" to XP everywhere; 최근 기록 shows the XP really paid after the daily cap (`xpPaid`). Committed (`da3804e`).
- **Stage 4 (PDF import) is complete (Oct 30).** Built in about 1.5 hours of the 2-hour time box: `pdf-text.js` (limits 10 MB / 50 pages, line rebuilding, wrapped-line joining, scan detection; pure, tested), `pdf-reader.js` (pdf.js 6.4.299 legacy build from jsDelivr, loaded only when a file is chosen), button in the bulk import. Text is appended to the paste box and goes through the usual preview. Bug found by the user: `doc.destroy()` does not exist in pdf.js 6 and the generic message hid it; fixed, and every failure now logs its step. The user's retests passed (ko.pdf, blank/not-a-PDF, own 컴활 PDF with 20 concepts, wrapped lines). A real lecture PDF showed the limits listed under "Known limitations".
- Tests: 220 Node tests pass; manual checklist has "오늘의 공부" and PDF sections. Pushed to main and the live site checked (see below).

**Next (in order), Oct 31:**
1. Final verification pass: `node tests/logic.test.js`, the manual checklist on the live site (phone too), and one edge case shown on purpose for the video (e.g. fewer than 4 concepts blocks the quiz, or the scanned PDF message).
2. README (English, max 1,200 words, the user's own voice): purpose and user, how to run (`python3 -m http.server`), work process, Claude Code evidence (max 6 excerpts/screenshots), verification results, three effective practices, three difficulties, known limitations, future work, third-party library (pdf.js from CDN), and the 5 key files (decide the 5th on Saturday: `timer.js`, `importer.js` or `pdf-text.js`).
3. Video (5-10 min, MP4, not in the repo), then submit on the LMS: video, repo URL, live URL. Deadline Nov 1, 23:59 KST.
