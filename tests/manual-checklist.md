# Manual UI checklist

Run the site locally: in the repo folder run `python3 -m http.server 8000`, then open http://localhost:8000.
Tip: clear site data (DevTools > Application > Clear site data) to start fresh.

## Stage 1: Notes and quiz

- [ ] First visit shows 5 sample concepts and the counter says 5.
- [ ] Add a concept with both fields filled: it appears in the list; the form is cleared.
- [ ] Submit with an empty field: an error message appears and nothing is added.
- [ ] Add the same concept name twice (any letter case): "already in your list" error.
- [ ] Delete a concept: it disappears and the counter goes down.
- [ ] Reload the page: your added and deleted concepts are still as you left them.
- [ ] Quiz tab with 5 concepts: "Start quiz" works; 4 different options are shown.
- [ ] Pick a correct option: it turns green, points increase by 10, "Next question" appears.
- [ ] Get 3 correct in a row: combo shows 3 and bonus points appear (10, 15, 20).
- [ ] Pick a wrong option: it turns red, the right one turns green, combo resets to 0, no points.
- [ ] Options cannot be clicked again after answering.
- [ ] The question label shows "Question N of M". With 5 concepts a round has 5 questions;
      with 10 or more concepts a round has 10.
- [ ] On the last question the button says "See results" instead of "Next question".
- [ ] The result screen shows points, "X of Y correct", and the concepts you missed
      (or "None. Perfect round!" if there were none).
- [ ] "Play again" starts a fresh round with points and combo back at 0.
- [ ] After a wrong answer, the concept shows a red "Missed N×" badge in the Notes list.
      Answering it correctly in a later round lowers the number until the badge disappears.
- [ ] A concept you got wrong shows up again more often in later questions
      (hard to see by eye; the number evidence comes from `node tests/logic.test.js`).
- [ ] **Leave dialog:** during a round, click the Notes tab. A dialog says "Leave quiz? Your
      progress in this round will be lost." (not the browser's own popup).
  - [ ] "Stay" closes it; you are still on the same question, nothing lost.
  - [ ] Esc key also acts as Stay.
  - [ ] "Leave" goes to Notes; going back to Quiz shows the start screen with points at 0.
- [ ] "End quiz" during a round shows the same dialog; "Leave" returns to the start screen.
- [ ] On the start screen or the result screen, switching to Notes shows no dialog.
- [ ] **Edge case:** delete concepts until only 3 remain. The Quiz tab shows a red message
      ("You need at least 4 concepts...") and the Start button is disabled.
- [ ] **Edge case:** with 4+ concepts, give two of them identical definitions so fewer than
      4 different definitions exist. The quiz is blocked with a message.
- [ ] Phone check (or DevTools phone mode): no sideways scrolling, buttons are easy to tap.
