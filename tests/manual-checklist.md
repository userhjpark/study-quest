# Manual UI checklist

Run the site locally: in the repo folder run `python3 -m http.server 8000`, then open http://localhost:8000.
Start from clean data: open a private/incognito window, or clear site data
(DevTools F12 > Application > Storage > "Clear site data").
The UI is in Korean.

## Stage 1: Notes (노트)

- [ ] First visit shows 10 sample concepts (생명과학 5, 한국사 5); the counter says 10; each has a subject tag.
- [ ] Add a concept with subject + concept + definition: it appears with the subject tag; concept/definition fields are cleared and the subject stays filled.
- [ ] Leave the subject empty: the concept gets the tag "미분류".
- [ ] Typing in the subject field suggests existing subjects.
- [ ] Submit with an empty concept or definition: a red error appears, nothing is added.
- [ ] Add the same concept in the same subject twice (any letter case): "이미 같은 개념이 있어요" error.
- [ ] Add the same concept name in a *different* subject: it is allowed.
- [ ] Delete a concept: it disappears and the counter goes down.
- [ ] Reload the page: your added and deleted concepts are still as you left them.

## Stage 1: Notes list: filter and groups

- [ ] Above the list there are buttons "전체 10", "생명과학 5", "한국사 5"; "전체" is highlighted.
- [ ] In 전체 the list is grouped: a header "생명과학 (5)" with its 5 concepts, then "한국사 (5)".
- [ ] Tap a group header: the group collapses (arrow ▸) and the other group stays open; tap again to expand (▾).
- [ ] Each concept still shows its subject tag and, after wrong quiz answers, its "N번 틀림" badge.
- [ ] Tap "한국사 5": only the 5 한국사 concepts are shown, without a group header. Tap "전체" to go back.
- [ ] Reload the page: the chosen filter and the collapsed groups are remembered.
- [ ] Add a concept to a subject while a different subject is selected: the filter switches to the subject you added to, so the new concept is visible.
- [ ] Add a concept to a collapsed group in 전체: that group opens.
- [ ] Add a concept with a new subject: a new button appears, and the list shows it as a new group.
- [ ] **Edge case:** select "한국사", delete all its concepts: the filter falls back to 전체 and the "한국사" button disappears.
- [ ] Bulk import into a subject also shows the new concepts (same rules as above).
- [ ] **Phone:** with 4+ subjects the buttons wrap onto several rows (no sideways scrolling); headers and buttons are easy to tap; long subject names wrap.

## Stage 1: Bulk import (여러 개 한 번에 추가)

- [ ] The section is collapsed by default; single-entry users see only its title. Tapping it opens it.
- [ ] Paste three lines like `광합성: 빛으로 양분을 만드는 과정`: preview shows "추가 3개", the `:` button is highlighted and the hint says the separator was chosen automatically.
- [ ] **First separator only:** paste `홍길동: 남자, 소설 속 인물: 의적`. Preview shows concept `홍길동` and definition `남자, 소설 속 인물: 의적`.
- [ ] Paste lines using `/` while `:` is selected: lines turn red ("구분 기호가 없어요"). Tap `/`: they become OK, and the hint says it was chosen by hand.
- [ ] Copy two columns from Excel or Google Sheets and paste: `Tab` is chosen automatically and the preview is correct.
- [ ] Empty lines in the paste are ignored (no red lines for them).
- [ ] A broken line (no separator, or empty concept/definition) is red with a reason and skipped; the other lines can still be added.
- [ ] A concept that already exists in that subject is gray "이미 있는 개념이에요" and skipped; a repeat inside the paste says "위에 같은 개념이 있어요".
- [ ] Press the add button: the count message appears, concepts show up in the list with the chosen subject, and the textarea is emptied.
- [ ] Clearing the textarea hides the preview and the button is disabled.
- [ ] **Limit:** the import adds at most 500 concepts at once (not worth hand-testing; covered by `node tests/logic.test.js`).

## Stage 1: Quiz (퀴즈)

- [ ] The subject dropdown lists "전체 과목 (10)", "생명과학 (5)", "한국사 (5)".
- [ ] Choose 생명과학 and start: every question and every wrong option is from 생명과학 only.
- [ ] Choose 전체 과목 and start: options may mix both subjects.
- [ ] The dropdown is disabled during a round and enabled again on the result screen.
- [ ] **Edge case:** delete concepts of one subject until only 3 remain, then choose that subject. A red message names the subject ("'…' 과목에는 3개예요") and the start button is disabled. The other subject (and 전체 과목) still work.
- [ ] **Edge case:** with fewer than 4 concepts in total, the quiz is blocked for 전체 과목 too.
- [ ] Pick a correct option: it turns green, points increase by 10, "다음 문제" appears.
- [ ] 3 correct in a row: combo shows 3 and bonus points appear (10, 15, 20).
- [ ] Pick a wrong option: it turns red, the right one turns green, combo resets to 0, no points.
- [ ] Options cannot be clicked again after answering.
- [ ] **Each concept once:** with 5 concepts in a subject, play a round answering everything correctly. The label counts "1 / 5" to "5 / 5" and all 5 different concepts appear exactly once (write them down to check). The last button says "결과 보기" and there is no retry part.
- [ ] With 10 or more concepts in the chosen subject, a round has 10 questions, all different.
- [ ] **Retry (다시 풀기):** answer 2 questions wrong on purpose. After the last main question the button says "틀린 문제 다시 풀기". The label then reads "다시 풀기 1 / 2" (shown in the highlight color), and the same 2 concepts come back in the order they were first asked. The last retry button says "결과 보기".
- [ ] In the retry part a correct answer shows "정답! (다시 풀기는 점수가 없어요)": points and combo do not change. A wrong answer in the retry is not asked a third time.
- [ ] The result screen shows points, "N문제 중 M문제 정답", a "다시 풀기: …" line (only if a retry happened), and the concepts missed in the main part (or "없어요. 완벽한 라운드예요!").
- [ ] "다시 하기" starts a fresh round with points and combo back at 0.
- [ ] After a wrong answer in the main part, that concept shows a red "N번 틀림" badge in the Notes list; the badge stays after a correct retry. Correct answers in later rounds lower the number until it disappears.
- [ ] Missed concepts are picked more often for big subjects (hard to see by eye; the numbers come from `node tests/logic.test.js`).
- [ ] **Leave dialog:** during a round, tap the 노트 tab. The in-page dialog "퀴즈에서 나갈까요?" appears (not the browser's own popup).
  - [ ] "계속하기" closes it; you are still on the same question.
  - [ ] Esc also keeps you in the quiz.
  - [ ] "나가기" goes to 노트; going back to 퀴즈 shows the start screen with points at 0.
- [ ] "퀴즈 종료" during a round shows the same dialog.
- [ ] On the start screen or result screen, switching to 노트 shows no dialog.
- [ ] The chosen quiz subject is remembered after reload.

## Phone

- [ ] On the phone (or DevTools phone mode): no sideways scrolling, buttons and the subject dropdown are easy to tap, Korean text wraps properly, the preview list scrolls inside its box.
