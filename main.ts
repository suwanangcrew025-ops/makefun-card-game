// Ember Duel — the hand-in program (Node 22, standard library only).
//
// When the grader runs this file, it gathers the entry and lays it out for
// the sealed scorer: the playable game and its screenshots are copied into
// the output directory, and the dossier the judge reads is written beside
// them by the vendored make.fun library. The program runs twice and must
// write the same bytes both times, so it does nothing time- or
// randomness-dependent here — it only copies files and summarizes them.
//
// Locally, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The caps mirror the gate's own limits (see the competition's rules):
// the dossier text is capped at 160 KiB, at most 4 screenshots of at most
// 256 KiB each, and game/ stays within 993 files and 48 MiB in all.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
