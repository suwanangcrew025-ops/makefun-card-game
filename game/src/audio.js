// Ember Duel — sounds, synthesized live.
//
// No audio files ship with the game: every sound is a short oscillator
// phrase built with the Web Audio API, so the game stays silent on disk
// and still clicks, thuds and chimes when it is played. Sound starts only
// after the player's first gesture, which is what browsers require, and
// the mute button (or the M key) silences all of it.

let context = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

// Lazily create the audio context on the first sound, inside a user
// gesture, so the browser's autoplay rule is satisfied.
function audioContext() {
  if (!context) {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

// One note: an oscillator that slides from `from` to `to` hertz over
// `seconds`, fading out as it goes. `type` picks the timbre.
function note(from, to, seconds, type = 'sine', volume = 0.12, delay = 0) {
  const ctx = audioContext();
  if (!ctx || muted) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.02);
}

function noise(seconds, volume = 0.08, delay = 0) {
  const ctx = audioContext();
  if (!ctx || muted) return;
  const start = ctx.currentTime + delay;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  source.buffer = buffer;
  source.connect(gain).connect(ctx.destination);
  source.start(start);
}

// The game's sound vocabulary. Each name is one moment in a duel.
export const sounds = {
  click() {
    note(660, 520, 0.06, 'triangle', 0.08);
  },
  draw() {
    noise(0.12, 0.05);
    note(420, 700, 0.1, 'sine', 0.06, 0.02);
  },
  play() {
    note(300, 520, 0.12, 'triangle', 0.1);
    note(520, 780, 0.1, 'sine', 0.07, 0.08);
  },
  hit() {
    noise(0.15, 0.12);
    note(180, 70, 0.18, 'sawtooth', 0.1);
  },
  heal() {
    note(520, 780, 0.18, 'sine', 0.08);
    note(780, 1040, 0.18, 'sine', 0.06, 0.12);
  },
  turn() {
    note(440, 440, 0.08, 'triangle', 0.08);
    note(660, 660, 0.1, 'triangle', 0.08, 0.09);
  },
  win() {
    [523, 659, 784, 1047].forEach((freq, i) => note(freq, freq, 0.3, 'triangle', 0.1, i * 0.13));
  },
  lose() {
    [392, 330, 262, 196].forEach((freq, i) => note(freq, freq * 0.94, 0.3, 'sine', 0.09, i * 0.15));
  },
};
