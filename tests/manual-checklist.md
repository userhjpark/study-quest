# Manual UI checklist

Run the site locally: in the repo folder run `python3 -m http.server 8000`, then open http://localhost:8000.
Start from clean data: open a private/incognito window, or clear site data
(DevTools F12 > Application > Storage > "Clear site data").
The UI is in Korean. The page opens on the 집중 tab; for the Stage 1 items below open the 노트 tab first.

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

## Stage 2: Profile bar, rewards, recent rounds (최근 기록)

Use clean data for the first items (private window or "Clear site data").

- [ ] Header (under "Study Quest") shows "Lv 1", an XP bar with "0/100 XP", "코인 0", "연속 0일", "오늘 0/600 XP" and a "출석 체크" button.
- [ ] **Button check-in:** tap "출석 체크": the note says "출석 완료! 연속 1일 · +10 XP, +6 코인", the button becomes the disabled "출석 완료", coins 6, XP 10. After a reload it stays disabled. The "오늘" line stays at 0 (check-in XP is outside the daily cap).
- [ ] **Automatic check-in:** with clean data (button NOT pressed), finish a quiz round. The result screen shows the reward line ("+N XP, +N 코인") and a second line "출석 체크 완료! 연속 1일 · +10 XP, +6 코인". The header button now says "출석 완료".
- [ ] **No double bonus (button first):** after pressing the button, finish a round: no "출석 체크 완료" line on the result screen, and XP/coins grow only by the round's reward.
- [ ] **No double bonus (round first):** after the automatic check-in, the button is already "출석 완료" and cannot be pressed again. A second round the same day shows no check-in line.
- [ ] Result screen reward: XP equals the round's points; coins = correct answers (+5 if every answer was correct). A correct answer in the retry part (다시 풀기) changes nothing.
- [ ] Quitting a round midway ("퀴즈 종료" > "나가기") gives no XP or coins and adds nothing to "최근 기록".
- [ ] The "오늘 N/600 XP" line goes up after each round by the XP gained.
- [ ] **Level up:** after passing 100 XP the result screen says "레벨 업! Lv 2" and the header shows Lv 2 with the bar restarted.
- [ ] **Edge case, daily cap:** in the DevTools console run
      `localStorage.setItem("studyquest:profile", JSON.stringify({xp:0,coins:0,daily:{date:new Date().toLocaleDateString("sv"),xp:590,timerBonuses:0},checkIn:{last:"",streak:0}}))`
      then **reload**. The header says "오늘 590/600 XP". The next round gives at most 10 XP and says the cap was reached ("일부만 받았어요"); the line then shows "오늘 600/600 XP · 한도 도달" (highlighted). A round after that gives 0 XP, still gives coins, and shows the red cap notice.
- [ ] **Streak:** console: `localStorage.setItem("studyquest:profile", JSON.stringify({xp:0,coins:0,daily:{date:"",xp:0,timerBonuses:0},checkIn:{last:new Date(Date.now()-864e5).toLocaleDateString("sv"),streak:3}}))` and reload. The header shows "연속 3일" and the button is enabled; check-in (or a round) says "연속 4일".
- [ ] Same with `last` set 2 days ago: the header shows "연속 0일" and check-in says "연속 1일".
- [ ] **최근 기록** (bottom of the Quiz tab): a new item per finished round (newest first) with date/time, subject, score, "N문제 중 M문제 정답" and "틀린 개념: …" (omitted if none). Only the newest 10 are kept. It is still there after a reload.
- [ ] A concept deleted after the round still shows in the history's missed list.
- [ ] **Known limitation (two tabs):** with the site open in two tabs, a finished round in one tab can overwrite progress saved by the other tab. Reload before testing after editing localStorage in the console.

## Stage 2: Focus timer (집중)

Use the 1-minute option ("1분 (데모)") for most of these. Reload with Ctrl+Shift+R first.

- [ ] The tabs are in this order: 집중, 노트, 퀴즈 (focus, review the notes, then quiz). All fit on a phone-width screen.
- [ ] **Default tab:** a fresh page load (and a reload) opens on 집중, not on 노트.
- [ ] **Reload during a timer:** start a timer, reload: the app opens on 집중 and the countdown is visible and correct.
- [ ] The 집중 tab shows four buttons: 1분 (데모), 10분, 15분, 25분.
- [ ] Tap "1분 (데모)": the timer starts at once and counts down (01:00, 00:59, ...), the bar fills, and the browser tab title shows the time too.
- [ ] Switch to 노트 and back to 집중: the time is still correct (the timer was not reset).
- [ ] Reload the page while it runs: the timer continues with the right remaining time.
- [ ] **Background:** start a timer, switch to another browser tab for about 30 seconds, come back: the time matches the real elapsed time.
- [ ] **Finish on the 집중 tab:** the screen changes to "집중 완료!" with "+5 XP, +2 코인" (and the green "출석 체크 완료!" line if it is the first activity today). The header XP/coins went up.
- [ ] **Finish on another tab:** start a timer, go to 노트, wait for the end. A yellow dot appears on the 집중 tab. Opening it shows "집중 완료!" and the dot disappears.
- [ ] **Closed page:** start a timer, close the page, reopen it after the end time. The "집중 완료!" screen is there once; after another reload the tab is back to the start (no second bonus).
- [ ] **퀴즈 시작:** one tap goes to the 퀴즈 tab and a round starts in the subject shown on the finish screen ("퀴즈 과목: …").
- [ ] **Edge case:** choose a subject with fewer than 4 concepts in the 퀴즈 tab, finish a timer, tap "퀴즈 시작": you land on the 퀴즈 tab with the red "need 4 concepts" message and no round starts.
- [ ] "타이머로 돌아가기" returns to the four buttons without starting a quiz.
- [ ] **그만하기 pauses the timer:** while running, tap "그만하기 (보너스 없음)". The in-page dialog "집중을 그만할까요?" appears (not the browser's own popup). Behind it the screen says "일시정지됨" and the time stops. Wait about 10 seconds with the dialog open.
  - [ ] "계속하기" (or Esc) closes the dialog and the timer continues from the time it showed when paused (the 10 seconds were not lost).
  - [ ] "그만하기" in the dialog goes back to the four buttons, XP and coins unchanged, nothing saved (a reload shows no timer).
- [ ] **Paused state:** pause (open the dialog), then reload the page while it is open. The dialog is gone, but the 집중 tab shows "일시정지됨" with the same remaining time, and two buttons "계속하기" and "그만하기" (no countdown, the page title says "일시정지"). Wait a while: the time does not change.
  - [ ] "계속하기" continues from the same remaining time.
  - [ ] "그만하기" asks "집중을 그만할까요?" again; "계속하기" there resumes, "그만하기" ends the timer.
- [ ] **Edge case:** a paused 1-minute timer never finishes: leave it paused for over a minute, no "집중 완료!" appears and no bonus is given.
- [ ] While paused, switching to 노트 and back keeps it paused with the same time.
- [ ] **Daily limit:** finish four timers on the same day: the first three give +5 XP, +2 코인; the fourth says the day's timer bonus is used up and gives nothing.
- [ ] **Not farmable:** leaving a timer running forever gives nothing; only finishing it gives the small bonus, at most 3 times a day.
- [ ] **Leave dialog:** during a quiz round, tap the 집중 tab: the "퀴즈에서 나갈까요?" dialog appears (like for 노트). "계속하기" stays in the round.
- [ ] The "오늘 N/600 XP" line in the header includes the timer's 5 XP.
- [ ] Known limitation: no sound or notification when the timer ends; the page only shows the dot and the title. A phone may pause the page in the background, but the remaining time is right as soon as you return.

## Hint for new users ("내 개념을 추가해보세요")

- [ ] With clean data (only the 10 samples): the 집중 tab (start screen, below the time buttons) and the 퀴즈 tab (start screen, above the start button) each show a dashed box "내 개념을 추가해보세요 / 지금은 예시 개념만 있어요." with a "노트 열기" button.
- [ ] "노트 열기" opens the 노트 tab from both tabs.
- [ ] The box is not shown while a timer runs, on the "집중 완료!" screen, during a quiz round or on the quiz result screen.
- [ ] Add one concept of your own in 노트: the box disappears on both tabs (also after a reload).
- [ ] Delete your own concept again (only samples left): the box comes back.
- [ ] Bulk import counts as adding your own concepts (box disappears).

## Phone

- [ ] On the phone (or DevTools phone mode): no sideways scrolling, buttons and the subject dropdown are easy to tap, Korean text wraps properly, the preview list scrolls inside its box.
