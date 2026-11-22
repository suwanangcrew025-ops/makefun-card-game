// Ember Duel — the rules engine.
//
// State is plain data, and every rule lives in a function here. Nothing in
// this file touches the page: render.js reads a state and draws it, input.js
// calls these functions when the player acts, and ai.js asks them what the
// opponent may do. Keeping the rules separate from the drawing is what lets
// the same code run a real game, a scripted AI turn, and a staged
// screenshot without any of the three knowing about the others.

import { buildDeck, cardById, seededRandom } from './cards.js';

export const MAX_LIFE = 30;
export const MAX_MANA = 10;
export const HAND_LIMIT = 7;
export const BOARD_LIMIT = 7;
export const STARTING_HAND = 3;

let nextCreatureId = 1;

// A fresh duelist: life, mana, deck, hand and board. `isPlayer` only marks
// whose side of the table this is; the rules treat both sides the same.
export function newDuelist(isPlayer, random) {
  return {
    isPlayer,
    life: MAX_LIFE,
    mana: 0,
    maxMana: 0,
    deck: buildDeck(random),
    hand: [],
    board: [],
    fatigue: 0,
  };
}

// A fresh game. `seed` fixes the shuffle; leave it out for a new random one.
export function newGame(seed = (Math.random() * 0xffffffff) >>> 0) {
  const random = seededRandom(seed);
  const game = {
    seed,
    player: newDuelist(true, random),
    enemy: newDuelist(false, random),
    turn: 1,
    active: 'player', // whose turn it is right now
    phase: 'playing', // 'playing' | 'won' | 'lost'
    log: [],
    stats: { cardsPlayed: 0, damageDealt: 0, turns: 0 },
    random,
  };
  drawCards(game.player, STARTING_HAND, game);
  drawCards(game.enemy, STARTING_HAND + 1, game);
  startTurn(game, game.player);
  return game;
}

// A creature on the board. `sick` is summoning sickness: true until its
// owner's next turn, unless the card has charge. `canAttack` is recomputed
// every turn; a creature that already attacked this turn cannot go again.
export function summonCreature(card, owner) {
  return {
    uid: nextCreatureId++,
    cardId: card.id,
    attack: card.attack,
    health: card.health,
    maxHealth: card.health,
    keyword: card.keyword ?? null,
    sick: card.keyword !== 'charge',
    canAttack: card.keyword === 'charge',
    justPlayed: true,
  };
}

// Draw n cards for a duelist. An empty deck deals fatigue instead: 1 damage
// the first time, then 2, then 3, and so on. A hand past the limit burns
// the drawn card and says so in the log.
export function drawCards(duelist, n, game) {
  for (let i = 0; i < n; i++) {
    if (duelist.deck.length === 0) {
      duelist.fatigue += 1;
      duelist.life -= duelist.fatigue;
      addLog(game, `${sideName(duelist)} kehabisan kartu: ${duelist.fatigue} damage kelelahan.`);
      checkEnd(game);
      if (game.phase !== 'playing') return;
      continue;
    }
    const id = duelist.deck.pop();
    if (duelist.hand.length >= HAND_LIMIT) {
      addLog(game, `${sideName(duelist)} membuang ${cardById(id).name} (tangan penuh).`);
    } else {
      duelist.hand.push(id);
    }
  }
}

export function sideName(duelist) {
  return duelist.isPlayer ? 'Kamu' : 'Lawan';
}

// Open a duelist's turn: one more mana crystal (up to the cap), a full
// refill, one card drawn, and every creature on their board ready to act
// unless it is still sick from being played last turn.
export function startTurn(game, duelist) {
  duelist.maxMana = Math.min(MAX_MANA, duelist.maxMana + 1);
  duelist.mana = duelist.maxMana;
  for (const creature of duelist.board) {
    creature.justPlayed = false;
    if (!creature.sick) creature.canAttack = true;
    creature.sick = false;
  }
  drawCards(duelist, 1, game);
}

// Can this hand card be played right now? Creatures need a free board slot.
export function canPlayCard(game, duelist, handIndex) {
  const card = cardById(duelist.hand[handIndex]);
  if (!card || duelist.mana < card.cost) return false;
  if (card.kind === 'creature' && duelist.board.length >= BOARD_LIMIT) return false;
  return true;
}

// Play a card from a hand. `target` is what a targeted spell points at:
// { kind: 'hero', side } or { kind: 'creature', side, uid }. Board-wide and
// self spells need no target. Returns false when the play is illegal.
export function playCard(game, duelist, handIndex, target = null) {
  if (!canPlayCard(game, duelist, handIndex)) return false;
  const card = cardById(duelist.hand[handIndex]);
  // A targeted spell with no target is not played at all: the card stays
  // in hand and no mana is spent, so the UI can ask for a target first.
  if (card.kind === 'spell' && card.target === 'any' && !target) return false;
  duelist.hand.splice(handIndex, 1);
  duelist.mana -= card.cost;
  game.stats.cardsPlayed += 1;
  addLog(game, `${sideName(duelist)} memainkan ${card.name}.`);

  if (card.kind === 'creature') {
    duelist.board.push(summonCreature(card, duelist));
    if (card.onPlay === 'heal-hero') {
      healHero(game, duelist, card.onPlayValue);
    }
    return true;
  }

  applySpell(game, duelist, card, target);
  checkEnd(game);
  return true;
}

function applySpell(game, caster, card, target) {
  if (card.effect === 'draw') {
    drawCards(caster, card.effectValue, game);
  } else if (card.effect === 'heal') {
    healHero(game, caster, card.effectValue);
  } else if (card.effect === 'damage') {
    if (!target) return;
    dealDamage(game, target, card.effectValue, caster);
  } else if (card.effect === 'damage-all-enemy') {
    const foe = opponentOf(game, caster);
    for (const creature of [...foe.board]) {
      damageCreature(game, foe, creature, card.effectValue, caster);
    }
  }
}

function healHero(game, duelist, amount) {
  const before = duelist.life;
  duelist.life = Math.min(MAX_LIFE, duelist.life + amount);
  const healed = duelist.life - before;
  if (healed > 0) addLog(game, `${sideName(duelist)} pulih ${healed} nyawa.`);
}

// One creature attacks another creature, or a hero. Both sides deal their
// attack to each other when creatures clash; attacking a hero only hurts
// the hero. Taunt forces the attacker to pick a taunt creature first.
export function attack(game, attackerSide, creatureUid, target) {
  const attacker = attackerSide.board.find((c) => c.uid === creatureUid);
  if (!attacker || !attacker.canAttack) return false;
  if (target.kind === 'creature') {
    const foe = opponentOf(game, attackerSide);
    if (foe.board.some((c) => c.keyword === 'taunt') && target.creature.keyword !== 'taunt') {
      return false;
    }
    attacker.canAttack = false;
    damageCreature(game, foe, target.creature, attacker.attack, attackerSide);
    damageCreature(game, attackerSide, attacker, target.creature.attack, foe);
  } else {
    const foe = opponentOf(game, attackerSide);
    if (foe.board.some((c) => c.keyword === 'taunt')) return false;
    attacker.canAttack = false;
    dealDamage(game, { kind: 'hero', side: foe }, attacker.attack, attackerSide);
  }
  checkEnd(game);
  return true;
}

// Damage to a hero, or to a creature wrapped as { kind, creature, side }.
export function dealDamage(game, target, amount, sourceSide) {
  if (target.kind === 'hero') {
    const hero = target.side;
    hero.life -= amount;
    if (sourceSide?.isPlayer) game.stats.damageDealt += amount;
    addLog(game, `${sideName(hero)} menerima ${amount} damage.`);
  } else {
    damageCreature(game, target.side, target.creature, amount, sourceSide);
  }
}

function damageCreature(game, owner, creature, amount, sourceSide) {
  creature.health -= amount;
  if (sourceSide?.isPlayer) game.stats.damageDealt += amount;
  if (creature.health <= 0) {
    owner.board = owner.board.filter((c) => c.uid !== creature.uid);
    addLog(game, `${cardById(creature.cardId).name} hancur.`);
  }
}

export function opponentOf(game, duelist) {
  return duelist.isPlayer ? game.enemy : game.player;
}

// A creature that may legally be attacked right now: it must be able to
// attack, and if the enemy hides behind taunts, only a taunt is a target.
export function legalTargets(game, attackerSide) {
  const foe = opponentOf(game, attackerSide);
  const taunts = foe.board.filter((c) => c.keyword === 'taunt');
  const creatures = taunts.length > 0 ? taunts : foe.board;
  const targets = creatures.map((c) => ({ kind: 'creature', side: foe, creature: c }));
  if (taunts.length === 0) targets.push({ kind: 'hero', side: foe });
  return targets;
}

// End the active side's turn and open the other side's. The game counts a
// full round once the player has had their turn.
export function endTurn(game) {
  if (game.phase !== 'playing') return;
  game.active = game.active === 'player' ? 'enemy' : 'player';
  if (game.active === 'player') {
    game.turn += 1;
    game.stats.turns += 1;
  }
  startTurn(game, game.active === 'player' ? game.player : game.enemy);
}

function checkEnd(game) {
  if (game.phase !== 'playing') return;
  if (game.enemy.life <= 0 && game.player.life <= 0) {
    game.phase = game.player.life >= game.enemy.life ? 'won' : 'lost';
  } else if (game.enemy.life <= 0) {
    game.phase = 'won';
  } else if (game.player.life <= 0) {
    game.phase = 'lost';
  }
  if (game.phase !== 'playing') {
    addLog(game, game.phase === 'won' ? 'Kamu memenangkan duel!' : 'Lawan memenangkan duel.');
  }
}

export function addLog(game, text) {
  game.log.unshift(text);
  if (game.log.length > 30) game.log.length = 30;
}
