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
function exists(file) { return fs.existsSync(path.join(root, file)); }
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

check('V2.4 entry point declares version and schema 3', () => {
  has('js/app.js', /DutchTrainer\.version\s*=\s*['"]2\.4\.0['"]/);
  has('js/app.js', /DutchTrainer\.schemaVersion\s*=\s*3/);
});

check('V2.4 exposes one public DutchTrainer namespace', () => {
  has('js/app.js', /DutchTrainer/);
  has('js/app.js', /DutchTrainer\.ready/);
});

check('database remains schema version 3', () => has('js/db.js', /const DB_VERSION\s*=\s*3/));

check('database owns the required persistence stores', () => {
  ['vocabulary','packs','sessions','settings'].forEach(store => has('js/db.js', new RegExp(`['"]${store}['"]`)));
});

check('backup uses the database persistence contract', () => {
  has('js/backup.js', /DutchTrainerDB\.(?:export|import)|DutchTrainer\.db\.(?:export|import)|exportDatabaseData|importDatabaseData/);
});

check('vocabulary exposes the public CRUD/selection contract', () => {
  const text = read('js/vocabulary.js');
  ['getAll','getWord','saveWord','saveWords','deleteWord','getPacks','getPack','savePack',
   'selectAll','selectPack','selectNew','selectWeak','selectDue','getSelection','setSource','getSelected']
    .forEach(fn => { if (!new RegExp(`DutchTrainer\\.vocabulary\\.${fn}\\s*=`).test(text)) throw new Error(`${fn} missing`); });
});

check('pack manager exposes pack operations', () => {
  has('js/packs.js', /DutchTrainerPacks\s*=\s*\{/);
  ['getAllPacks','getPack','savePack','createPack','ensurePack','updatePack','deletePack','removePackWords','assignWordToPack']
    .forEach(fn => has('js/packs.js', new RegExp(`\b${fn}\b`)));
});

check('Packs UI owns installed-pack refresh', () => {
  has('js/packs-ui.js', /DutchTrainerPacksUI\s*=\s*\{/);
  has('js/packs-ui.js', /\brefresh\b/);
});

check('exercise registry exposes all five V2.4 types', () => {
  const text = read('js/exercises/index.js');
  ['meaning','recall','fill','choose','production'].forEach(type => has('js/exercises/index.js', new RegExp(`['"]${type}['"]`)));
  has('js/exercises/index.js', /register/);
});

check('Practice exposes the stable public session API', () => {
  const text = read('js/practice.js');
  ['start','answer','next','finish','reset','getState','on'].forEach(fn => has('js/practice.js', new RegExp(`\b${fn}\b`)));
  has('js/practice.js', /selectedVocabulary/);
  has('js/practice.js', /currentIndex/);
  has('js/practice.js', /questionCount/);
});

check('mastery contract includes bidirectional answer changes', () => {
  const text = read('js/mastery.js');
  has('js/mastery.js', /updateWordAfterAnswer/);
  has('js/mastery.js', /previewMasteryChange/);
  has('js/mastery.js', /correct/);
  has('js/mastery.js', /incorrect/);
  has('js/mastery.js', /almost/);
});

check('mastery defines weak and mastered thresholds', () => {
  has('js/mastery.js', /weakThreshold\s*:\s*40/);
  has('js/mastery.js', /masteredThreshold\s*:\s*90/);
});

check('scheduler exposes due/weak/mastery classification', () => {
  const text = read('js/scheduler-v2.js');
  ['getMastery','isNew','isDue','isWeak','isLearned','getIntervalDays','schedule','classify']
    .forEach(fn => has('js/scheduler-v2.js', new RegExp(`\b${fn}\b`)));
});

check('history contract supports question-level results', () => {
  const text = read('js/history.js');
  ['getSessions','getRecent','saveSession','deleteSession','getStats'].forEach(fn => has('js/history.js', new RegExp(`\b${fn}\b`)));
  has('js/history.js', /results/);
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
