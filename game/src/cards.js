// Ember Duel — the card catalogue.
//
// Every card in the game is defined here, and only here. A card is a small
// plain object: an id, a name, an element (Api, Air, Daun, Batu or Petir),
// a mana cost, and either creature stats (attack / health, plus an optional
// keyword) or a spell effect. The deck builder below turns the catalogue
// into the 24-card deck both duelists draw from, so the two sides always
// play from the same pool and every game is a fair mirror of it.
//
// Elements are told apart by colour AND by shape, never by text alone:
// each element has a colour, a glyph and a corner shape used by the card
// art in render.js.

// The five elements. colour is the card's accent, glyph is the big sigil
// drawn on the card art, and shape is the corner cut used for the art panel.
export const ELEMENTS = {
  api:   { name: 'Api',   colour: '#e8491d', dark: '#8f1d05', glyph: '✦', shape: 'flame' },
  air:   { name: 'Air',   colour: '#2f7fd0', dark: '#123f6e', glyph: '◆', shape: 'drop' },
  daun:  { name: 'Daun',  colour: '#3f9e4d', dark: '#1d5c28', glyph: '❖', shape: 'leaf' },
  batu:  { name: 'Batu',  colour: '#8a8f98', dark: '#4a4e55', glyph: '▲', shape: 'rock' },
  petir: { name: 'Petir', colour: '#e0a81c', dark: '#7a5805', glyph: '⬢', shape: 'bolt' },
};

// Keywords a creature can carry. A keyword is one word on the card plus a
// rule in state.js; nothing else in the game needs to know about it.
export const KEYWORDS = {
  // Must be attacked before any other enemy target.
  taunt: 'Perisai',
  // May attack on the very turn it is played.
  charge: 'Serbu',
};

// The catalogue. kind is 'creature' or 'spell'. A creature has attack and
// health; a spell has an effect name and a number the effect uses.
// onPlay is a battlecry: 'heal-hero' restores life to its owner's hero.
export const CATALOGUE = [
  { id: 'kancil',  kind: 'creature', name: 'Kancil Api',     element: 'api',   cost: 1, attack: 2, health: 1, text: 'Si kecil yang gesit, gigitan pertamanya terasa.' },
  { id: 'roh-padi', kind: 'creature', name: 'Roh Padi',      element: 'daun',  cost: 1, attack: 1, health: 3, onPlay: 'heal-hero', onPlayValue: 2, text: 'Saat dimainkan: pulihkan 2 nyawa heromu.' },
  { id: 'kera',    kind: 'creature', name: 'Kera Sakti',     element: 'batu',  cost: 2, attack: 3, health: 2, text: 'Sekali lompat, dua pukulan.' },
  { id: 'penjaga', kind: 'creature', name: 'Penjaga Batu',   element: 'batu',  cost: 2, attack: 1, health: 4, keyword: 'taunt', text: 'Perisai: musuh harus menyerangnya dulu.' },
  { id: 'siluman', kind: 'creature', name: 'Siluman Air',    element: 'air',   cost: 3, attack: 3, health: 4, text: 'Mengalir di antara serangan.' },
  { id: 'elang',   kind: 'creature', name: 'Elang Senja',    element: 'petir', cost: 3, attack: 4, health: 2, keyword: 'charge', text: 'Serbu: bisa menyerang di giliran dimainkan.' },
  { id: 'gajah',   kind: 'creature', name: 'Gajah Perang',   element: 'batu',  cost: 5, attack: 5, health: 6, text: 'Tanah bergetar setiap ia melangkah.' },
  { id: 'naga',    kind: 'creature', name: 'Naga Ember',     element: 'api',   cost: 6, attack: 7, health: 6, text: 'Api tertua di kepulauan ini.' },
  { id: 'lahar',   kind: 'spell',    name: 'Semburan Lahar', element: 'api',   cost: 2, effect: 'damage', effectValue: 3, target: 'any', text: 'Berikan 3 damage ke target mana pun.' },
  { id: 'embun',   kind: 'spell',    name: 'Embun Pagi',     element: 'daun',  cost: 2, effect: 'heal',   effectValue: 6, target: 'hero', text: 'Pulihkan 6 nyawa heromu.' },
  { id: 'pusaka',  kind: 'spell',    name: 'Tarik Pusaka',   element: 'petir', cost: 1, effect: 'draw',   effectValue: 2, target: 'self', text: 'Ambil 2 kartu dari dekmu.' },
  { id: 'badai',   kind: 'spell',    name: 'Badai Petir',    element: 'petir', cost: 4, effect: 'damage-all-enemy', effectValue: 2, target: 'board', text: 'Berikan 2 damage ke semua makhluk musuh.' },
];

// Look a card up by id. Throws on an unknown id so a typo fails loudly
// during development instead of silently dealing a blank card.
export function cardById(id) {
  const card = CATALOGUE.find((c) => c.id === id);
  if (!card) throw new Error(`unknown card id: ${id}`);
  return card;
}

// A fresh 24-card deck: two copies of every catalogue entry, shuffled with
// the caller's random function so a seeded run deals a seeded deck.
export function buildDeck(random) {
  const deck = [];
  for (const card of CATALOGUE) {
    deck.push(card.id, card.id);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// A small seeded random generator (mulberry32) so a staged screenshot or a
// replayed game deals exactly the same cards every time it runs.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
