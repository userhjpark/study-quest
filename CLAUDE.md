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

**Stage 2 (core)**
- Focus timer: 10 / 15 / 25 min, plus 1 min for demos. When it ends, a quiz starts.
- XP, levels, coins. Daily check-in and streak bonus.
- XP and coins come mainly from correct quiz answers. Finishing the timer gives only a small bonus, so leaving the timer running cannot be farmed for XP.
- Daily XP cap (limits leaderboard cheating).

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
- Approved the Stage 1 extensions above (Korean UI, subjects, bulk import) and the Stage 4 A/B choice. No code for them yet.

**Next (in order):**
1. Subjects in the logic (`concepts.js`, `quiz.js`) + tests.
2. `js/importer.js` (parsing, separator detection, preview) + tests.
3. Korean UI text everywhere, new screens (subject field, quiz subject picker, bulk import section), update `tests/manual-checklist.md`. Tell the user how to clear old site data before testing.
4. Commit in separate steps, push, then check the live site.
5. Then Stage 2. Stage 4 decision: Oct 30 evening.
