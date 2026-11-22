// Ember Duel — drawing the table.
//
// This file turns a game state into the page, and nothing else. It never
// changes the state and never decides a rule: input.js calls the rules,
// then asks for a re-render. Re-rendering rebuilds the hands and boards
// from the state each time, so the page can never drift away from the
// rules — whatever the state holds is exactly what the player sees.
//
// A card is one <div class="card">: a mana gem, an art panel in its
// element's colour and shape with a big glyph, its name, its text, and
// attack and health badges for creatures. Suits (elements) are told apart
// by colour and shape, never by text alone.

import { ELEMENTS, KEYWORDS, cardById } from './cards.js';
import { MAX_LIFE, MAX_MANA } from './state.js';

export const PLAYER_NAME = 'Aksa, Penjaga Ember';
export const ENEMY_NAME = 'Rana, Ratu Abu';

// ---------------------------------------------------------------------------
// Card elements
// ---------------------------------------------------------------------------

// One card face. `opts` says where it sits: a hand card can be selected
// and played, a board creature can attack, and a target glows when an
// attacker is waiting for one.
export function cardElement(card, opts = {}) {
  const el = ELEMENTS[card.element];
  const div = document.createElement('div');
  div.className = `card el-${card.element} ${card.kind}`;
  div.dataset.cardId = card.id;
  if (opts.handIndex !== undefined) div.dataset.handIndex = opts.handIndex;
  if (opts.uid !== undefined) div.dataset.uid = opts.uid;
  if (opts.side) div.dataset.side = opts.side;
  if (opts.selected) div.classList.add('selected');
  if (opts.playable) div.classList.add('playable');
  if (opts.canAttack) div.classList.add('can-attack');
  if (opts.targetable) div.classList.add('targetable');
  if (opts.justPlayed) div.classList.add('just-played');
  if (opts.dead) div.classList.add('dead');

  const keyword = card.keyword ? `<span class="keyword">${KEYWORDS[card.keyword]}</span>` : '';
  // Creatures show live attack and health; spells show a "Mantra" ribbon
  // instead, since they leave the table the moment they resolve.
  const stats = card.kind === 'creature'
    ? `<div class="stats"><span class="atk" title="Serangan">${opts.attack ?? card.attack}</span><span class="hp" title="Nyawa">${opts.health ?? card.health}</span></div>`
    : `<div class="stats spell-tag"><span>Mantra</span></div>`;

  div.innerHTML = `
    <div class="cost" title="Biaya mana">${card.cost}</div>
    <div class="art shape-${el.shape}" style="--el:${el.colour};--el-dark:${el.dark}">
      <span class="glyph">${el.glyph}</span>${keyword}
    </div>
    <div class="name">${card.name}</div>
    <div class="text">${card.text}</div>
    ${stats}`;
  return div;
}

// The back of a card: what the opponent's hand looks like from this side
// of the table. No values, only the ember pattern.
export function cardBackElement() {
  const div = document.createElement('div');
  div.className = 'card back';
  div.innerHTML = `<div class="art shape-flame"><span class="glyph">✦</span></div><div class="name">Kartu Lawan</div>`;
  return div;
}

// ---------------------------------------------------------------------------
// Heroes, mana and decks
// ---------------------------------------------------------------------------

function heroPanel(name, life, isPlayer) {
  const pct = Math.max(0, Math.min(100, (life / MAX_LIFE) * 100));
  const div = document.createElement('div');
  div.className = `hero ${isPlayer ? 'player' : 'enemy'}`;
  div.dataset.side = isPlayer ? 'player' : 'enemy';
  div.innerHTML = `
    <div class="portrait">${isPlayer ? 'A' : 'R'}</div>
    <div class="hero-info">
      <div class="hero-name">${name}</div>
      <div class="life-bar"><div class="life-fill" style="width:${pct}%"></div><span class="life-text">❤ ${life} / ${MAX_LIFE}</span></div>
    </div>`;
  return div;
}

function manaRow(duelist) {
  const div = document.createElement('div');
  div.className = 'mana';
  let dots = '';
  for (let i = 0; i < MAX_MANA; i++) {
    const state = i < duelist.mana ? 'full' : i < duelist.maxMana ? 'empty' : 'locked';
    dots += `<span class="crystal ${state}"></span>`;
  }
  div.innerHTML = `${dots}<span class="mana-text">${duelist.mana}/${duelist.maxMana}</span>`;
  return div;
}

function deckPile(duelist, label) {
  const div = document.createElement('div');
  div.className = 'deck-pile';
  div.innerHTML = `<div class="deck-card"></div><span>${label}: ${duelist.deck.length} kartu</span>`;
  return div;
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

// Rebuild the whole table from the state. `ui` is the selection the
// player is holding: { handIndex } for a card picked from the hand, or
// { attackerUid } for a creature chosen to attack.
export function renderTable(game, ui) {
  const table = document.getElementById('table-screen');
  const enemy = game.enemy;
  const player = game.player;

  // Enemy hand: face-down backs, one per card.
  const enemyHand = table.querySelector('#enemy-hand');
  enemyHand.replaceChildren();
  for (let i = 0; i < enemy.hand.length; i++) enemyHand.append(cardBackElement());

  // Enemy hero, mana and deck.
  table.querySelector('#enemy-hero').replaceChildren(heroPanel(ENEMY_NAME, enemy.life, false));
  table.querySelector('#enemy-mana').replaceChildren(manaRow(enemy));
  table.querySelector('#enemy-deck').replaceChildren(deckPile(enemy, 'Dek lawan'));

  // Enemy board: its creatures, ready ones glowing on the enemy's turn.
  // A creature's justPlayed flag is consumed here: the landing animation
  // plays once, on the render right after it was played, and never again.
  const enemyBoard = table.querySelector('#enemy-board');
  enemyBoard.replaceChildren();
  for (const creature of enemy.board) {
    const card = cardById(creature.cardId);
    const justPlayed = creature.justPlayed;
    creature.justPlayed = false;
    const targetable = ui.attackerUid !== undefined && game.active === 'player'
      && (!enemy.board.some((c) => c.keyword === 'taunt') || creature.keyword === 'taunt');
    enemyBoard.append(cardElement(card, {
      uid: creature.uid, side: 'enemy', health: creature.health, attack: creature.attack,
      targetable, justPlayed,
    }));
  }

  // Player board.
  const playerBoard = table.querySelector('#player-board');
  playerBoard.replaceChildren();
  for (const creature of player.board) {
    const card = cardById(creature.cardId);
    const justPlayed = creature.justPlayed;
    creature.justPlayed = false;
    playerBoard.append(cardElement(card, {
      uid: creature.uid, side: 'player', health: creature.health, attack: creature.attack,
      canAttack: game.active === 'player' && creature.canAttack,
      justPlayed,
    }));
  }

  // Player hero, mana and deck.
  table.querySelector('#player-hero').replaceChildren(heroPanel(PLAYER_NAME, player.life, true));
  table.querySelector('#player-mana').replaceChildren(manaRow(player));
  table.querySelector('#player-deck').replaceChildren(deckPile(player, 'Dekmu'));

  // Player hand: playable cards lift, the selected one lifts higher.
  const hand = table.querySelector('#player-hand');
  hand.replaceChildren();
  player.hand.forEach((id, handIndex) => {
    const card = cardById(id);
    const playable = game.active === 'player' && player.mana >= card.cost
      && (card.kind !== 'creature' || player.board.length < 7);
    hand.append(cardElement(card, {
      handIndex, playable, selected: ui.handIndex === handIndex,
    }));
  });

  // Turn banner and the end-turn button.
  const banner = table.querySelector('#turn-banner');
  banner.textContent = game.active === 'player'
    ? `Giliran ${game.turn} — giliranmu, mainkan kartumu`
    : `Giliran ${game.turn} — ${ENEMY_NAME} sedang berpikir…`;
  banner.classList.toggle('enemy-turn', game.active !== 'player');
  const endButton = table.querySelector('#end-turn');
  endButton.disabled = game.active !== 'player';
  endButton.textContent = game.active === 'player' ? 'Akhiri Giliran (Spasi)' : 'Giliran Lawan…';

  renderLog(game);
}

export function renderLog(game) {
  const log = document.getElementById('game-log');
  if (!log) return;
  log.replaceChildren();
  for (const line of game.log) {
    const li = document.createElement('li');
    li.textContent = line;
    log.append(li);
  }
}

// ---------------------------------------------------------------------------
// Floating numbers and banners
// ---------------------------------------------------------------------------

// A floating number over the board: damage in red, healing in green.
// It is drawn on the fixed effects layer at the given page coordinates,
// so it survives the re-render that follows the action that caused it.
export function floatText(x, y, text, kind = 'damage') {
  const layer = document.getElementById('fx-layer');
  if (!layer) return;
  const span = document.createElement('span');
  span.className = `float-text ${kind}`;
  span.textContent = text;
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;
  layer.append(span);
  window.setTimeout(() => span.remove(), 1400);
}

// A big center flash: "Giliranmu", "Menang!" and the like.
export function flashBanner(text, ms = 1200) {
  const banner = document.getElementById('flash-banner');
  if (!banner) return;
  banner.textContent = text;
  banner.classList.add('show');
  window.setTimeout(() => banner.classList.remove('show'), ms);
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export function showScreen(name) {
  for (const screen of document.querySelectorAll('.screen')) {
    screen.classList.toggle('hidden', screen.id !== `${name}-screen`);
  }
}

// Fill the end screen after a win or a loss: a headline, the duel's
// numbers, and a button to play again.
export function renderEnd(game) {
  const end = document.getElementById('end-screen');
  const won = game.phase === 'won';
  end.querySelector('#end-title').textContent = won ? 'KEMENANGAN!' : 'KEKALAHAN';
  end.querySelector('#end-title').classList.toggle('won', won);
  end.querySelector('#end-subtitle').textContent = won
    ? 'Api kepulauan ini tetap menyala di tanganmu. Rana, Ratu Abu, tunduk pada duelmu.'
    : 'Rana, Ratu Abu, memenangkan duel ini. Asah lagi dekmu dan tantang ia sekali lagi.';
  end.querySelector('#end-stats').innerHTML = `
    <div><span class="stat-num">${game.stats.turns}</span><span class="stat-label">Giliran</span></div>
    <div><span class="stat-num">${game.stats.cardsPlayed}</span><span class="stat-label">Kartu dimainkan</span></div>
    <div><span class="stat-num">${game.stats.damageDealt}</span><span class="stat-label">Damage diberikan</span></div>
    <div><span class="stat-num">${game.player.life} / ${MAX_LIFE}</span><span class="stat-label">Nyawamu tersisa</span></div>`;
}
