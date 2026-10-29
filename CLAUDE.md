# CLAUDE.md

Guidance for Claude Code in this repository. Read fully at the start of every session.

## Project

**Study Quest**: a study-game website for a university assignment (deadline **November 1, 23:59 KST**). Students who struggle with motivation enter "concept - definition" pairs for any subject; the site turns them into quizzes and wraps studying in game mechanics. **No AI, no paid APIs. Everything must be free to run.**

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
- Focus timer: 10 / 15 / 25 min, plus 1 min for demos. When it ends, a "집중 완료!" screen offers a "퀴즈 시작" button (see Timer UI below).
- XP, levels, coins. Daily check-in and streak bonus.
- XP and coins come mainly from correct quiz answers. Finishing the timer gives only a small bonus, so leaving the timer running cannot be farmed for XP.
- Daily XP cap (limits leaderboard cheating).
- **Approved numbers (Oct 29)**: XP per round = main-part score (10 per correct + combo bonus); coins = 1 per correct answer + 5 for a perfect round; daily XP cap **600** (a perfect round with combos is almost 200 XP, so 300 would block after 2 rounds); timer bonus 5 XP + 2 coins per finished timer, at most 3 per day, nothing if quit early; level L needs 50*L*(L-1) total XP; check-in 10 XP + 5 coins + 1 coin per streak day (max +7), check-in XP is outside the cap; a missed day resets the streak to 1.
- **Timer UI**: separate "집중" tab. When the timer ends, show a "집중 완료!" screen with the bonus and a "퀴즈 시작" button (no automatic quiz start); one tap starts a round in the selected subject, with the usual "need 4 concepts" message if needed.
- Stage 3 shop prices: set so the first item is affordable after 2-3 rounds.
- **"최근 기록" section** under the Quiz tab (planned Oct 29, not built yet): shows the last 10 rounds with date, subject, score, correct count, and the missed concepts, saved in localStorage. It must share one **round-result record** with the XP/coin logic: when a round ends, `main.js` builds `{ finishedAt, subject, score, correct, total, retryCorrect, retryTotal, missedTerms }` (`finishedAt` as a timestamp; missed concepts as text so deleted concepts still show). `rewards.js` computes XP/coins from this record, and the history list stores the same record (keep the newest 10). Build the record in a pure function so it can be tested.

**Stage 3 (core)**
- Character customization: buy and equip colors, hats, face items with coins.

**Stage 4 (optional)**: decide on **Oct 30 evening** between two options (choose one). If Stages 1-3 are not done by then, drop it and list it as a future feature in the README.

*Option A: PDF import*
- Read text-based PDFs only (no scanned/OCR) with pdf.js, loaded from a CDN at a pinned version (do not commit the library; mention it as a third-party library in the README).
- Size and page limits (e.g. a few MB, a few dozen pages; decide when building). Show a clear message for scanned or too-large files.
- Extracted text goes through the same `importer.js` parsing and the same preview as bulk import.

*Option B: Firebase leaderboard*
- Firebase free-tier leaderboard: global ranking (show only players near me) + teams via team code and team rankings.
- Anonymous Firebase sign-in, nickname only. No email, real name, or other personal info.
- Firestore Security Rules so users can only write their own score doc and score jumps are bounded.

## Firebase config decision

`firebase-config.js` (Firebase *web* config) **is committed**. It is public by design; security comes from Security Rules plus restricting the API key by HTTP referrer to the GitHub Pages domain. The README must explain this. **Never commit** service-account JSON, Admin SDK keys, or any private key.

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

`quiz.js` (quiz logic), `rewards.js` (XP / streak / coins logic), `character.js`, `leaderboard.js` (only if Stage 4 happens; otherwise swap in `storage.js` or `timer.js`), `ui.js`.

## Assignment requirements (summary)

**Submit via LMS:** one MP4 video (5-10 min; never upload it to GitHub), the public GitHub repo URL, the deployed project URL.

**Video must include:** what was built and for whom; main work steps and decisions; selected Claude Code evidence; a working demo; three effective practices; three difficulties (response or remaining problem); checks and known limitations. Verification uses representative cases plus one edge case, failure, or limitation. Do not submit a full conversation transcript.

**Repo:** new public repo, meaningful commit history, human-readable `README.md` of **at most 1,200 words** containing: purpose and intended user; how to run/use; short account of work process; selected Claude Code evidence and verification results; three effective practices and three difficulties; known limitations (include the items below); at most five key source files for grading. At most **six** agent excerpts or screenshots. The README must be accurate and in the user's own voice, not raw agent output.

**Never commit:** credentials, API keys (beyond the public Firebase web config above), personal data, dependencies, build output, large raw data, video files.

**Grading (20):** purpose and scope 3; process and agent evidence 5; working project 4; verification 2; reflection on practices and difficulties 4; documentation and readability 2.

## Known limitations to list in README

- localStorage-based XP cap, coins, and streaks can be bypassed by editing browser data or changing the device clock. Only Stage 4 server-side rules can limit this, and even they can only bound score jumps.
- Data lives per browser/device; clearing site data erases progress.
- Subjects cannot be renamed or deleted; a subject exists as long as it has concepts.
- (Add more as they are discovered.)

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

**Stage 1 is complete** (including subjects, bulk import, Korean UI, round rules with retry, Notes filter/groups). 67 Node tests pass (`node tests/logic.test.js`); manual checklist passed by the user. Live site: https://userhjpark.github.io/study-quest/ (the Pages build of the latest push should be re-checked on a phone).

**Files now:** `index.html`, `css/style.css`, `js/main.js`, `js/ui.js`, `js/storage.js`, `js/concepts.js`, `js/quiz.js`, `js/importer.js`, `package.json`, `tests/logic.test.js`, `tests/manual-checklist.md`. No README yet (due before submission; max 1,200 words, English, user's own voice).

**Next (in order):**
1. **Oct 29 (today):** Stage 2 must be finished today. Plan approved. Steps: (1) `history.js` round record + "최근 기록", (2) `rewards.js`, (3) check-in + streak, (4) profile bar + result screen [user tests], (5) `timer.js` + "집중" tab [user tests], (6) docs/checklist. Steps 1-3 are logic only: run the Node tests and commit without waiting; stop for the user's manual test after steps 4 and 5.
2. **Oct 30:** Stage 3 (character shop). **Oct 30 evening:** decide Stage 4 (PDF import vs leaderboard), only if Stages 1-3 look on track.
3. After Stage 3: README, then the video (5-10 min, not in the repo). Deadline Nov 1, 23:59 KST.
