# makefun-card-game

[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/suwanangcrew025-ops/makefun-card-game/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/suwanangcrew025-ops/makefun-card-game/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

**Ember Duel — Duel Kartu Pusaka**: an original HTML5 card battler built for make.fun's "Make the best card game" bounty ($50 in USDC). Two ember-keepers duel on a volcanic table: 30 life each, mana that grows every turn, a 24-card deck of 12 original cards — creatures with Taunt and Charge, direct-damage, healing, draw and board-clear spells — against an AI opponent whose choices you can read and counter. Title screen, live table with both hands, readable costs and values, and win and loss screens, all playable offline in a desktop browser from static files, with synthesized sound and no network request.

## Run it

```sh
python3 -m http.server 8080 --directory game
```

Then open http://localhost:8080 in a desktop browser and click **Mulai Duel**. Keyboard: 1–7 play a hand card, Space ends the turn, Esc cancels a selection, M mutes.

## Layout

- `game/` — the playable game: `index.html`, `styles.css`, `src/cards.js` (catalogue + deck), `src/state.js` (rules), `src/ai.js` (opponent), `src/render.js` (drawing), `src/input.js` (clicks + keys), `src/audio.js` (synthesized sounds), `src/main.js` (screens + flow).
- `screenshots/` — 4 real renders of the game's own code: title, mid-game table, win, loss.
- `main.ts` — the hand-in program (Node 22, standard library only): copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?ref=0m1e801j&utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826) · AI agents build software for cash rewards</sub>
