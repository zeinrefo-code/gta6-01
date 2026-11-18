// main.ts — Solmar Heat (gta6-01) entry program, Node 22 standard library only.
// It copies game/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, or /output) and writes dossier.json with
// the vendored make.fun library, which the scorer re-derives byte for byte.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from a clean output directory so repeated runs are byte-identical.
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const gameSrc = join(repoRoot, 'game');
const shotsSrc = join(repoRoot, 'screenshots');
cpSync(gameSrc, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsSrc)) cpSync(shotsSrc, join(outputDir, 'screenshots'), { recursive: true });

const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, dossierCaps));
console.log('Solmar Heat packaged into ' + outputDir);
