// Ember Duel — the opponent's brain.
//
// The AI plays the same rules as the player, one decision at a time, and
// its choices are meant to be readable: it protects itself when hurt, it
// spends its mana on the biggest thing it can afford, it removes the
// player's most dangerous creature when it can, and it goes for the hero
// when the way is clear. A player who watches it can predict it — and
// counter it by hiding behind a taunt or holding removal for its big play.
//
// Every decision is a plain function of the state, so the same game state
// always produces the same AI turn, which is what makes the staged
// screenshots deterministic.

import { cardById } from './cards.js';

// How much a card is worth to the AI, in rough mana terms: a creature is
// worth its attack plus its health, a taunt is worth more because it
// guards the hero, and charge is worth more because it acts at once.
export function cardValue(card) {
  if (card.kind === 'spell') {
    if (card.effect === 'damage') return card.effectValue + 1;
    if (card.effect === 'damage-all-enemy') return 4;
    if (card.effect === 'draw') return 3;
    if (card.effect === 'heal') return 3;
    return 1;
  }
  let value = card.attack + card.health;
  if (card.keyword === 'taunt') value += 2;
  if (card.keyword === 'charge') value += 1;
  return value;
}

// Plan one whole AI turn as a list of steps. The caller (main.js) runs
// them one by one on a timer so the player can watch the opponent's cards
// land, and the turn ends when the steps run out. A play step names its
// card by id, not by hand index, because earlier plays shift the hand;
// the caller looks the card up again when the step runs.
export function planAiTurn(game) {
  const steps = [];
  const me = game.enemy;
  const foe = game.player;
  let manaLeft = me.mana;

  // 1. One spell first, while the board is still as it was: a board clear
  // when the player has two or more creatures, a heal when hurt, a draw
  // when the hand is thin, and direct damage at the biggest threat — or
  // at the hero when that would nearly end the duel.
  for (let i = 0; i < me.hand.length; i++) {
    const card = cardById(me.hand[i]);
    if (card.kind !== 'spell' || me.mana < card.cost) continue;
    if (card.effect === 'damage-all-enemy' && foe.board.length >= 2) {
      steps.push({ type: 'play', cardId: card.id });
      manaLeft -= card.cost;
      break;
    }
    if (card.effect === 'heal' && me.life <= 18) {
      steps.push({ type: 'play', cardId: card.id });
      manaLeft -= card.cost;
      break;
    }
    if (card.effect === 'draw' && me.hand.length <= 3) {
      steps.push({ type: 'play', cardId: card.id });
      manaLeft -= card.cost;
      break;
    }
    if (card.effect === 'damage') {
      const threat = [...foe.board].sort((a, b) => b.attack - a.attack)[0];
      if (threat && threat.attack >= 4) {
        steps.push({ type: 'play', cardId: card.id, target: { kind: 'creature', side: foe, creature: threat } });
        manaLeft -= card.cost;
        break;
      }
      if (foe.life <= card.effectValue + 2) {
        steps.push({ type: 'play', cardId: card.id, target: { kind: 'hero', side: foe } });
        manaLeft -= card.cost;
        break;
      }
    }
  }

  // 2. Creatures, biggest value first, while mana lasts. The mana check
  // here is a local forecast: the real check happens again when the step
  // runs, so a miscount only skips a play, never breaks the turn.
  const affordable = me.hand
    .map((id) => ({ id, card: cardById(id) }))
    .filter((c) => c.card.kind === 'creature' && c.card.cost <= manaLeft)
    .sort((a, b) => cardValue(b.card) - cardValue(a.card));
  for (const pick of affordable) {
    if (pick.card.cost <= manaLeft && me.board.length < 7) {
      steps.push({ type: 'play', cardId: pick.card.id });
      manaLeft -= pick.card.cost;
    }
  }

  // 3. Attacks: every ready creature goes. A taunt on the player's side
  // must be cleared first; otherwise the AI trades with the player's
  // biggest attacker when it can kill it without dying, and otherwise
  // hits the hero — except when the player is one hit from losing, when
  // it always goes for the hero.
  const taunt = foe.board.find((c) => c.keyword === 'taunt');
  for (const creature of [...me.board]) {
    if (!creature.canAttack) continue;
    if (taunt) {
      steps.push({ type: 'attack', uid: creature.uid, target: { kind: 'creature', side: foe, creature: taunt } });
    } else if (foe.life <= creature.attack) {
      steps.push({ type: 'attack', uid: creature.uid, target: { kind: 'hero', side: foe } });
    } else {
      const victim = [...foe.board]
        .filter((c) => c.health <= creature.attack && c.attack <= creature.health)
        .sort((a, b) => b.attack - a.attack)[0];
      if (victim) {
        steps.push({ type: 'attack', uid: creature.uid, target: { kind: 'creature', side: foe, creature: victim } });
      } else {
        steps.push({ type: 'attack', uid: creature.uid, target: { kind: 'hero', side: foe } });
      }
    }
  }

  steps.push({ type: 'end' });
  return steps;
}
