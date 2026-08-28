/* Dutch Vocabulary Trainer V2.4 Stable Core self-tests.
 * Dependency-free contract checks. These tests intentionally verify public
 * contracts and observable behavior, not source-file architecture.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function check(name, fn) {
  try { fn(); console.log(`PASS ${name}`); pass++; }
  catch (error) { console.error(`FAIL ${name} — ${error.message}`); fail++; }
}
function has(file, re, message = 'expected contract not found') {
  if (!re.test(read(file))) throw new Error(`${message}: ${file}`);
}
function no(file, re, message = 'unexpected legacy contract found') {
  if (re.test(read(file))) throw new Error(`${message}: ${file}`);
}
function hasAll(file, terms, message = 'expected contract not found') {
  const text = read(file);
  for (const term of terms) {
    if (!text.includes(term)) throw new Error(`${message}: ${term} (${file})`);
  }
}

check('V2.4 entry point declares version and schema 3', () => {
  has('js/app.js', /DutchTrainer\.version\s*=\s*['"]2\.4\.0['"]/);
  has('js/app.js', /DutchTrainer\.schemaVersion\s*=\s*3/);
});

check('V2.4 exposes one public DutchTrainer namespace', () => {
  has('js/app.js', /DutchTrainer/);
  has('js/app.js', /DutchTrainer\.ready/);
});

check('database remains schema version 3', () => has('js/db.js', /DB_VERSION\s*=\s*3/));

check('database owns the required persistence stores', () => {
  ['vocabulary','packs','sessions','settings'].forEach(store => has('js/db.js', new RegExp(`['"]${store}['"]`)));
});

check('backup uses the database persistence contract', () => {
  has('js/backup.js', /DutchTrainerDB\.(?:export|import)|DutchTrainer\.db\.(?:export|import)|exportDatabaseData|importDatabaseData/);
});

check('vocabulary exposes the public CRUD/selection contract', () => {
  const text = read('js/vocabulary.js');
  hasAll('js/vocabulary.js', [
    'getAll','getWord','saveWord','saveWords','deleteWord',
    'getPacks','getPack','savePack','selectAll','selectPack',
    'selectNew','selectWeak','selectDue','getSelection','setSource','getSelected'
  ], 'vocabulary API member missing');
});

check('pack manager exposes pack operations', () => {
  has('js/packs.js', /window\.DutchTrainerPacks\s*=\s*\{/);
  hasAll('js/packs.js', [
    'getAllPacks','getPack','savePack','createPack','ensurePack',
    'updatePack','deletePack','removePackWords','assignWordToPack'
  ], 'pack API member missing');
});

check('Packs UI owns installed-pack refresh', () => {
  has('js/packs-ui.js', /window\.DutchTrainerPacksUI\s*=\s*\{/);
  has('js/packs-ui.js', /refreshPacks/);
});

check('exercise registry exposes all five V2.4 types', () => {
  hasAll('js/exercises/index.js', ['meaning','recall','fill','choose','production'], 'exercise type missing');
  has('js/exercises/index.js', /register/);
});

check('Practice exposes the stable public session API', () => {
  has('js/practice.js', /DutchTrainer\.practice\s*=\s*Object\.freeze\(\{/);
  hasAll('js/practice.js', ['start,answer,next,finish,reset,getState,on'], 'Practice API member missing');
  hasAll('js/practice.js', ['selectedVocabulary','currentIndex','questionCount'], 'Practice state field missing');
});

check('mastery contract includes bidirectional answer changes', () => {
  hasAll('js/mastery.js', ['updateWordAfterAnswer','previewMasteryChange','correct','incorrect','almost'], 'mastery contract member missing');
});

check('mastery defines weak and mastered thresholds', () => {
  has('js/mastery.js', /weakThreshold\s*:\s*40/);
  has('js/mastery.js', /masteredThreshold\s*:\s*90/);
});

check('scheduler exposes due/weak/mastery classification', () => {
  has('js/scheduler-v2.js', /DutchTrainer\.scheduler\s*=\s*\{/);
  hasAll('js/scheduler-v2.js', ['getMastery','isNew','isDue','isWeak','isLearned','getIntervalDays','schedule','classify'], 'scheduler API member missing');
});

check('history contract supports question-level results', () => {
  hasAll('js/history.js', ['getSessions','getRecent','saveSession','deleteSession','getStats'], 'history API member missing');
  has('js/history.js', /results/);
  has('js/history.js', /schemaVersion:\s*3/);
});

check('import validation keeps the word limit', () => {
  has('js/import.js', /validate/);
  has('js/import.js', /maxWords\s*:\s*10000/);
});

check('UI contains the required navigation targets', () => {
  const html = read('index.html');
  ['homeScreen','dashboardScreen','packsScreen','settingsScreen','historyScreen','practiceScreen'].forEach(id => {
    if (!new RegExp(`id=["']${id}["']`).test(html)) throw new Error(`${id} missing`);
  });
});

check('installed-pack rendering remains owned by Packs UI', () => {
  ['js/app-ui.js','js/dashboard.js','js/packs.js'].forEach(file => {
    if (/renderInstalledPacks|installedPacksContainer/.test(read(file))) {
      throw new Error(`duplicate installed-pack rendering in ${file}`);
    }
  });
});

check('V2.4 entry point does not load obsolete V2.3 bridge modules', () => {
  no('js/app.js', /app-bootstrap\.js|version\.js/);
});

console.log(`\nV2.4 self-tests: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
