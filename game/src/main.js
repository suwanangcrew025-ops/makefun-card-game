// Ember Duel — the game's entry point.
//
// This file wires the pieces together: it owns the current game, the
// player's selection, and the screens. The rules live in state.js, the
// opponent in ai.js, the drawing in render.js, the sounds in audio.js and
// the clicks in input.js; this file only decides what happens next.
//
// It also stages the four screenshots (?shot=start|play|win|lose with an
// optional ?seed=): each one builds a fixed state through the same
// functions a real game uses, and renders it through the same renderer, so
// every screenshot is a real render of the game's own code.

import { cardById, seededRandom } from './cards.js';
import {
  attack, endTurn, newGame, playCard, summonCreature,
} from './state.js';
import { planAiTurn } from './ai.js';
import {
  bindInput, boardCardAction, clearSelection, handCardAction,
  heroClickAction, newUiState,
} from './input.js';
import {
  ENEMY_NAME, flashBanner, floatText, renderEnd, renderTable, showScreen,
} from './render.js';
import { sounds, toggleMute } from './audio.js';

let game = null;
let ui = newUiState();
let aiTimer = null;

// Keep the harness flag current: the screenshot/play-test harness reads
// this to see the live phase, life totals and board sizes.
function syncEmberFlag() {
  if (!window.__ember) window.__ember = { shotReady: true, shotState: { phase: 'title' } };
  window.__ember.shotState = game
    ? {
        phase: game.phase,
        turn: game.turn,
        playerLife: game.player.life,
        enemyLife: game.enemy.life,
        playerBoard: game.player.board.length,
        enemyBoard: game.enemy.board.length,
        playerHand: game.player.hand.length,
        enemyHand: game.enemy.hand.length,
      }
    : { phase: 'title' };
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

function startNewGame(seed) {
  stopAiTimer();
  game = newGame(seed);
  ui = newUiState();
  showScreen('table');
  renderTable(game, ui);
  syncEmberFlag();
  flashBanner('Giliranmu — mainkan kartumu!');
  sounds.turn();
}

function stopAiTimer() {
  if (aiTimer !== null) {
    window.clearTimeout(aiTimer);
    aiTimer = null;
  }
}

// Run the opponent's planned turn one step at a time, pausing between
// steps so the player can watch each card land. A step that no longer
// applies (its card was spent, its attacker died) is simply skipped.
function runAiTurn() {
  if (!game || game.phase !== 'playing' || game.active !== 'enemy') return;
  const steps = planAiTurn(game);
  let i = 0;
  const step = () => {
    if (!game || game.phase !== 'playing') return;
    if (i >= steps.length) {
      endTurn(game);
      afterAction();
      return;
    }
    const current = steps[i++];
    if (current.type === 'play') {
      const handIndex = game.enemy.hand.indexOf(current.cardId);
      if (handIndex >= 0) {
        playCard(game, game.enemy, handIndex, current.target ?? null);
        sounds.play();
      }
    } else if (current.type === 'attack') {
      const before = game.player.life;
      attack(game, game.enemy, current.uid, current.target);
      if (game.player.life < before) sounds.hit();
    } else if (current.type === 'end') {
      endTurn(game);
      afterAction();
      return;
    }
    renderTable(game, ui);
    if (game.phase !== 'playing') {
      afterAction();
      return;
    }
    aiTimer = window.setTimeout(step, 650);
  };
  aiTimer = window.setTimeout(step, 700);
}

// After any action: redraw, and if the duel is over, show the end screen;
// if it is the enemy's turn, hand the table to the AI.
function afterAction() {
  if (!game) return;
  clearSelection(ui);
  syncEmberFlag();
  if (game.phase === 'won' || game.phase === 'lost') {
    renderTable(game, ui);
    renderEnd(game);
    showScreen('end');
    if (game.phase === 'won') sounds.win();
    else sounds.lose();
    return;
  }
  renderTable(game, ui);
  if (game.active === 'enemy') {
    flashBanner(`${ENEMY_NAME} berpikir…`, 900);
    runAiTurn();
  } else {
    flashBanner('Giliranmu!', 900);
    sounds.turn();
  }
}

// The screen position of a board creature or hero, for a floating damage
// number. Measured before the re-render replaces the element.
function centerOf(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

function doHandCard(handIndex) {
  if (!game || game.phase !== 'playing' || game.active !== 'player') return;
  const action = handCardAction(game, ui, handIndex);
  if (action.type === 'select-spell') {
    ui.handIndex = handIndex;
    ui.pendingSpell = handIndex;
    ui.attackerUid = undefined;
    flashBanner('Pilih target untuk mantra itu', 900);
    sounds.click();
    renderTable(game, ui);
    return;
  }
  if (action.type === 'play') {
    const card = cardById(game.player.hand[handIndex]);
    const before = game.player.life;
    playCard(game, game.player, handIndex);
    if (card.onPlay === 'heal-hero' || card.effect === 'heal') sounds.heal();
    else if (card.effect === 'draw') sounds.draw();
    else sounds.play();
    if (game.player.life > before) floatText(window.innerWidth / 2, window.innerHeight - 220, `+${game.player.life - before}`, 'heal');
    afterAction();
  }
}

function doBoardCard(side, uid) {
  if (!game || game.phase !== 'playing' || game.active !== 'player') return;
  const action = boardCardAction(game, ui, side, uid);
  if (action.type === 'select-attacker') {
    ui.attackerUid = uid;
    ui.handIndex = undefined;
    ui.pendingSpell = undefined;
    sounds.click();
    renderTable(game, ui);
  } else if (action.type === 'attack') {
    const point = centerOf(`.card[data-uid="${uid}"]`);
    const before = game.enemy.life;
    const attacker = game.player.board.find((c) => c.uid === action.uid);
    const dealt = attacker ? attacker.attack : 0;
    attack(game, game.player, action.uid, action.target);
    sounds.hit();
    if (point) floatText(point.x, point.y, `−${dealt}`, 'damage');
    if (game.enemy.life < before) {
      const heroPoint = centerOf('.hero.enemy');
      if (heroPoint) floatText(heroPoint.x, heroPoint.y, `−${before - game.enemy.life}`, 'damage');
    }
    afterAction();
  }
}

function doHeroClick(side) {
  if (!game || game.phase !== 'playing' || game.active !== 'player') return;
  const action = heroClickAction(game, ui, side);
  if (action.type === 'play') {
    const card = cardById(game.player.hand[action.handIndex]);
    const before = game.enemy.life;
    playCard(game, game.player, action.handIndex, action.target);
    sounds.hit();
    if (game.enemy.life < before) {
      const point = centerOf('.hero.enemy');
      if (point) floatText(point.x, point.y, `−${card.effectValue}`, 'damage');
    }
    afterAction();
  } else if (action.type === 'attack') {
    const before = game.enemy.life;
    attack(game, game.player, action.uid, action.target);
    sounds.hit();
    const point = centerOf('.hero.enemy');
    if (point) floatText(point.x, point.y, `−${before - game.enemy.life}`, 'damage');
    afterAction();
  }
}

function doEndTurn() {
  if (!game || game.phase !== 'playing' || game.active !== 'player') return;
  sounds.click();
  endTurn(game);
  afterAction();
}

// ---------------------------------------------------------------------------
// Staged screenshots (?shot=...)
// ---------------------------------------------------------------------------

// Build the fixed mid-game table the play screenshot shows: both sides
// with creatures on the board, hands in hand, life already dented, mana
// mid-turn. It is assembled with the same summon/draw helpers a real game
// uses, so the render path is identical.
function stagePlayShot() {
  const staged = newGame(20261123);
  staged.turn = 5;
  staged.stats.turns = 4;
  staged.stats.cardsPlayed = 9;
  staged.stats.damageDealt = 11;
  staged.player.life = 24;
  staged.enemy.life = 19;
  staged.player.maxMana = 6;
  staged.player.mana = 3;
  staged.enemy.maxMana = 6;
  staged.enemy.mana = 2;
  staged.player.hand = ['kancil', 'lahar', 'embun', 'gajah', 'pusaka'];
  staged.enemy.hand = ['kancil', 'kera', 'siluman', 'elang', 'naga', 'badai'];
  staged.player.board = [
    summonCreature(cardById('penjaga'), staged.player),
    summonCreature(cardById('siluman'), staged.player),
    summonCreature(cardById('elang'), staged.player),
  ];
  staged.player.board[0].sick = false;
  staged.player.board[0].canAttack = true;
  staged.player.board[1].sick = false;
  staged.player.board[1].canAttack = true;
  staged.player.board[2].canAttack = true;
  staged.enemy.board = [
    summonCreature(cardById('kera'), staged.enemy),
    summonCreature(cardById('gajah'), staged.enemy),
  ];
  staged.enemy.board[0].sick = false;
  staged.enemy.board[0].canAttack = false;
  staged.enemy.board[1].sick = false;
  staged.enemy.board[1].canAttack = false;
  // The staged board is mid-game, not mid-animation: nothing lands now.
  for (const creature of [...staged.player.board, ...staged.enemy.board]) {
    creature.justPlayed = false;
  }
  staged.player.deck = staged.player.deck.slice(0, 14);
  staged.enemy.deck = staged.enemy.deck.slice(0, 15);
  staged.log = [
    'Rana memainkan Gajah Perang.',
    'Kamu memainkan Elang Senja.',
    'Elang Senja menyerang Rana: 4 damage.',
    'Kamu memainkan Siluman Air.',
    'Rana memainkan Kera Sakti.',
  ];
  return staged;
}

function stageEndShot(won) {
  const staged = stagePlayShot();
  staged.phase = won ? 'won' : 'lost';
  staged.player.life = won ? 17 : 0;
  staged.enemy.life = won ? 0 : 12;
  staged.stats.turns = 9;
  staged.stats.cardsPlayed = 17;
  staged.stats.damageDealt = won ? 34 : 21;
  staged.log = [won ? 'Kamu memenangkan duel!' : 'Lawan memenangkan duel.'];
  return staged;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  bindInput({
    onHandCard: doHandCard,
    onBoardCard: doBoardCard,
    onHeroClick: doHeroClick,
    onEndTurn: doEndTurn,
    onCancel: () => { clearSelection(ui); if (game) renderTable(game, ui); },
    onMute: () => {
      const muted = toggleMute();
      const button = document.getElementById('mute-button');
      if (button) button.textContent = muted ? '🔇 Suara: Mati' : '🔊 Suara: Hidup';
    },
    onPlay: () => startNewGame(),
  });

  document.getElementById('play-button')?.addEventListener('click', () => startNewGame());
  document.getElementById('play-again-button')?.addEventListener('click', () => startNewGame());
  document.getElementById('mute-button')?.addEventListener('click', () => {
    const muted = toggleMute();
    const button = document.getElementById('mute-button');
    if (button) button.textContent = muted ? '🔇 Suara: Mati' : '🔊 Suara: Hidup';
  });

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');

  if (shot === 'start') {
    showScreen('title');
  } else if (shot === 'play') {
    game = stagePlayShot();
    ui = newUiState();
    showScreen('table');
    renderTable(game, ui);
  } else if (shot === 'win' || shot === 'lose') {
    game = stageEndShot(shot === 'win');
    ui = newUiState();
    showScreen('table');
    renderTable(game, ui);
    renderEnd(game);
    showScreen('end');
  } else {
    showScreen('title');
  }

  // Signal to the screenshot harness that the staged state is rendered.
  // The flag carries a small summary so the capture log shows what each
  // screenshot actually holds.
  window.__ember = { shotReady: true, shotState: { phase: 'title' } };
  syncEmberFlag();
}

document.addEventListener('DOMContentLoaded', boot);
