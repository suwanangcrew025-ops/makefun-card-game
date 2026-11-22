// Ember Duel — pointer and keyboard input.
//
// One listener on the whole table, reading data attributes off the card or
// button that was clicked, so the controls keep working no matter how
// often render.js rebuilds the board. Keyboard shortcuts mirror the same
// actions: number keys play hand cards, Space ends the turn, Escape
// cancels a selection, M mutes.
//
// The selection flow is a small state machine kept in `ui`:
//   - click a hand card → it is selected (and a targeted spell waits for
//     a target; any other card plays at once);
//   - click one of your ready creatures → it is the attacker;
//   - click an enemy creature or hero while an attacker is chosen → attack;
//   - click anywhere else, or press Escape → cancel the selection.

import { cardById } from './cards.js';
import { canPlayCard, legalTargets } from './state.js';

// The selection the player is holding right now. main.js reads it when it
// re-renders, and clears it when a turn ends or a play resolves.
export function newUiState() {
  return { handIndex: undefined, attackerUid: undefined, pendingSpell: undefined };
}

export function clearSelection(ui) {
  ui.handIndex = undefined;
  ui.attackerUid = undefined;
  ui.pendingSpell = undefined;
}

// Wire the table's clicks and the page's keys to the callbacks main.js
// provides. Every callback receives plain data, never a DOM node.
export function bindInput(hooks) {
  const table = document.getElementById('table-screen');

  table.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action], .card, .hero');
    if (!target) {
      hooks.onCancel();
      return;
    }
    if (target.dataset.action === 'end-turn') {
      hooks.onEndTurn();
      return;
    }
    if (target.dataset.action === 'mute') {
      hooks.onMute();
      return;
    }
    if (target.classList.contains('hero')) {
      hooks.onHeroClick(target.dataset.side);
      return;
    }
    if (!target.classList.contains('card') || target.classList.contains('back')) return;
    if (target.dataset.handIndex !== undefined) {
      hooks.onHandCard(Number(target.dataset.handIndex));
      return;
    }
    if (target.dataset.uid !== undefined) {
      hooks.onBoardCard(target.dataset.side, Number(target.dataset.uid));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (document.getElementById('title-screen')?.classList.contains('hidden') === false) {
      if (event.key === 'Enter') hooks.onPlay();
      return;
    }
    if (event.key === 'Escape') {
      hooks.onCancel();
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      hooks.onEndTurn();
    } else if (event.key.toLowerCase() === 'm') {
      hooks.onMute();
    } else if (/^[1-7]$/.test(event.key)) {
      hooks.onHandCard(Number(event.key) - 1);
    }
  });
}

// What a click on a hand card should do, given the state and the current
// selection. Returns an action for main.js to carry out.
export function handCardAction(game, ui, handIndex) {
  const card = cardById(game.player.hand[handIndex]);
  if (!card) return { type: 'none' };
  if (game.active !== 'player' || game.phase !== 'playing') return { type: 'none' };
  if (!canPlayCard(game, game.player, handIndex)) return { type: 'none' };
  // A targeted spell is selected first and waits for its target.
  if (card.kind === 'spell' && card.target === 'any') {
    return { type: 'select-spell', handIndex };
  }
  return { type: 'play', handIndex };
}

// What a click on a board creature should do. A click on your own ready
// creature selects it as the attacker; a click on an enemy creature while
// one is selected attacks it.
export function boardCardAction(game, ui, side, uid) {
  if (game.active !== 'player' || game.phase !== 'playing') return { type: 'none' };
  if (side === 'player') {
    const creature = game.player.board.find((c) => c.uid === uid);
    if (!creature || !creature.canAttack) return { type: 'none' };
    return { type: 'select-attacker', uid };
  }
  if (ui.attackerUid !== undefined) {
    const attacker = game.player.board.find((c) => c.uid === ui.attackerUid);
    const victim = game.enemy.board.find((c) => c.uid === uid);
    if (!attacker || !victim) return { type: 'none' };
    const legal = legalTargets(game, game.player).some(
      (t) => t.kind === 'creature' && t.creature.uid === uid,
    );
    if (!legal) return { type: 'none' };
    return { type: 'attack', uid: ui.attackerUid, target: { kind: 'creature', side: game.enemy, creature: victim } };
  }
  return { type: 'none' };
}

// What a click on a hero portrait should do: a targeted spell waiting for
// a target resolves on that hero, and a selected attacker strikes it.
export function heroClickAction(game, ui, side) {
  if (game.active !== 'player' || game.phase !== 'playing') return { type: 'none' };
  if (ui.pendingSpell !== undefined) {
    const foe = side === 'enemy' ? game.enemy : game.player;
    return { type: 'play', handIndex: ui.pendingSpell, target: { kind: 'hero', side: foe } };
  }
  if (ui.attackerUid !== undefined && side === 'enemy') {
    const legal = legalTargets(game, game.player).some((t) => t.kind === 'hero');
    if (!legal) return { type: 'none' };
    return { type: 'attack', uid: ui.attackerUid, target: { kind: 'hero', side: game.enemy } };
  }
  return { type: 'none' };
}
