/* Dutch Vocabulary Trainer V2.4 Stable Core self-tests.
 * Dependency-free architecture/contract checks. Browser behavior is covered by CI runtime/smoke tests.
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
function has(file, re, message = 'expected pattern not found') {
  if (!re.test(read(file))) throw new Error(`${message}: ${file}`);
}
function no(file, re, message = 'unexpected pattern found') {
  if (re.test(read(file))) throw new Error(`${message}: ${file}`);
}
function hasAny(file, patterns, message = 'expected API contract not found') {
  const text = read(file);
  if (!patterns.some(re => re.test(text))) throw new Error(`${message}: ${file}`);
}

const appFiles = [
  'index.html', 'js/app.js', 'js/db.js', 'js/vocabulary.js', 'js/mastery.js',
  'js/scheduler-v2.js', 'js/history.js', 'js/practice.js', 'js/import.js',
  'js/packs.js', 'js/packs-ui.js', 'js/selection.js', 'js/dashboard.js',
  'js/app-ui.js', 'js/backup.js', 'js/backup-ui.js', 'js/exercises/index.js'
];

check('all V2.4 application files exist', () => {
  appFiles.forEach(file => { if (!exists(file)) throw new Error(file); });
});

check('V2.4 entry point declares version and schema 3', () => {
  has('js/app.js', /DutchTrainer\.version\s*=\s*['"]2\.4\.0['"]/);
  has('js/app.js', /DutchTrainer\.schemaVersion\s*=\s*3/);
});

check('V2.4 entry point loads the canonical module set', () => {
  ['db.js','vocabulary.js','exercises/index.js','mastery.js','scheduler-v2.js','history.js','practice.js','import.js']
    .forEach(file => has('js/app.js', new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  has('js/app.js', /DutchTrainer\.ready/);
});

check('database remains schema version 3', () => has('js/db.js', /const DB_VERSION\s*=\s*3/));

check('database exposes the V2.4 persistence API', () => {
  ['init','getWord','getWords','saveWord','saveWords','deleteWord','getPack','getPacks','savePack','deletePack',
   'getSetting','setSetting','saveSession','getSessions','deleteSession','export','import','calculatePackStats']
    .forEach(fn => has('js/db.js', new RegExp(`DutchTrainerDB\\.db\\.${fn}\\s*=`)));
});

check('database persistence helpers implement the expected stores', () => {
  ['vocabulary','packs','sessions','settings'].forEach(store => has('js/db.js', new RegExp(`['"]${store}['"]`)));
  has('js/db.js', /objectStore\(STORES\.vocabulary\)/);
  has('js/db.js', /objectStore\(STORES\.sessions\)/);
});

check('backup delegates to the database export/import contract', () => {
  hasAny('js/backup.js', [
    /DutchTrainerDB\.(?:export|import)/,
    /DutchTrainer\.db\.(?:export|import)/,
    /exportDatabaseData|importDatabaseData/
  ], 'database backup contract not found');
});

check('vocabulary facade exposes the canonical CRUD API', () => {
  ['getAll','getWord','saveWord','saveWords','deleteWord','getPacks','getPack','savePack']
    .forEach(fn => has('js/vocabulary.js', new RegExp(`DutchTrainer\\.vocabulary\\.${fn}\\s*=`)));
});

check('vocabulary facade exposes selection APIs', () => {
  ['selectAll','selectPack','selectNew','selectWeak','selectDue','getSelection','setSource','getSelected']
    .forEach(fn => has('js/vocabulary.js', new RegExp(`DutchTrainer\\.vocabulary\\.${fn}\\s*=`)));
});

check('pack manager owns pack operations', () => {
  has('js/packs.js', /DutchTrainerPacks\s*=\s*\{/);
  ['getAllPacks','getPack','savePack','createPack','ensurePack','updatePack','deletePack','removePackWords','assignWordToPack']
    .forEach(fn => has('js/packs.js', new RegExp(`\b${fn}\b`)));
});

check('Packs UI owns installed-pack rendering and refresh', () => {
  has('js/packs-ui.js', /DutchTrainerPacksUI\s*=\s*\{/);
  has('js/packs-ui.js', /\brefresh\b/);
  no('js/packs-ui.js', /DutchTrainerPacksUI\.loadPacks/);
});

check('exercise registry exposes all five V2.4 exercise types', () => {
  has('js/exercises/index.js', /DutchTrainer\.exercises/);
  ['meaning','recall','fill','choose','production'].forEach(type =>
    has('js/exercises/index.js', new RegExp(`register\\(['"]${type}['"]`)));
});

check('exercise registry enforces generate/check contracts', () => {
  has('js/exercises/index.js', /function register\(name, exercise\)/);
  has('js/exercises/index.js', /exercise\.generate/);
  has('js/exercises/index.js', /exercise\.check/);
});

check('Practice exposes the stable session API', () => {
  has('js/practice.js', /DutchTrainer\.practice\s*=\s*Object\.freeze\(\{/);
  ['start','answer','next','finish','reset','getState','on'].forEach(fn =>
    has('js/practice.js', new RegExp(`\b${fn}\b`)));
});

check('Practice supports all five exercise types', () => {
  ['meaning','recall','fill','choose','production'].forEach(type =>
    has('js/practice.js', new RegExp(`['"]${type}['"]`)));
  has('js/practice.js', /selectedVocabulary/);
  has('js/practice.js', /currentIndex/);
});

check('mastery exposes its stable scoring API', () => {
  has('js/mastery.js', /DutchTrainerMastery/);
  ['updateWordAfterAnswer','getCurrentMastery','getMasteryLevel','calculateVocabularyStats','calculateSkillStats','calculatePackStatistics','previewMasteryChange']
    .forEach(fn => has('js/mastery.js', new RegExp(`\b${fn}\b`)));
});

check('mastery defines weak and mastered thresholds', () => {
  has('js/mastery.js', /weakThreshold\s*:\s*40/);
  has('js/mastery.js', /masteredThreshold\s*:\s*90/);
});

check('scheduler exposes the V2.4 scheduling API', () => {
  has('js/scheduler-v2.js', /DutchTrainer\.scheduler\s*=\s*\{/);
  ['getMastery','isNew','isDue','isWeak','isLearned','getIntervalDays','schedule','classify']
    .forEach(fn => has('js/scheduler-v2.js', new RegExp(`\b${fn}\b`)));
});

check('scheduler uses the weak threshold contract', () => has('js/scheduler-v2.js', /weakThreshold\s*:\s*40/));

check('history service exposes session APIs', () => {
  has('js/history.js', /DutchTrainerHistoryRoot\.history/);
  ['getSessions','getRecent','saveSession','deleteSession','getStats']
    .forEach(fn => has('js/history.js', new RegExp(`\b${fn}\b`)));
});

check('history stores question-level results', () => {
  has('js/history.js', /results/);
  has('js/history.js', /Array\.isArray\(session\.results\)/);
});

check('import validation and limits remain enforced', () => {
  has('js/import.js', /validate/);
  has('js/import.js', /maxWords\s*:\s*10000/);
});

check('UI contains every smoke-test navigation target', () => {
  const html = read('index.html');
  ['homeScreen','dashboardScreen','packsScreen','settingsScreen','historyScreen','practiceScreen'].forEach(id => {
    if (!new RegExp(`id=["']${id}["']`).test(html)) throw new Error(`${id} missing`);
  });
});

check('application UI is implemented by the canonical UI module', () => {
  has('js/app-ui.js', /DutchTrainer|showScreen|navigate|nav/);
});

check('V2.4 entry point does not load obsolete V2.3 bridge modules', () => {
  no('js/app.js', /ui\.js|app-bootstrap\.js|version\.js/);
});

check('Packs UI remains the sole installed-pack renderer', () => {
  ['js/app-ui.js','js/dashboard.js','js/packs.js','js/packs-ui.js'].forEach(file => {
    if (!exists(file) || file === 'js/packs-ui.js') return;
    if (/renderInstalledPacks|installedPacksContainer/.test(read(file))) {
      throw new Error(`duplicate installed-pack rendering in ${file}`);
    }
  });
});

console.log(`\nV2.4 self-tests: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
