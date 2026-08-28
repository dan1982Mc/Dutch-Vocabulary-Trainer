/* Dutch Vocabulary Trainer V2.4 Stable Core self-tests.
 * Run from repository root: node tests/v2.4-self-tests.js
 * Dependency-free architecture/contract checks. Browser behavior is covered by CI runtime/smoke tests.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(root, file)); }
function check(name, fn) { try { fn(); console.log(`PASS ${name}`); pass++; } catch (error) { console.error(`FAIL ${name} — ${error.message}`); fail++; } }
function has(file, re, message = 'expected pattern not found') { if (!re.test(read(file))) throw new Error(`${message}: ${file}`); }
function no(file, re, message = 'unexpected pattern found') { if (re.test(read(file))) throw new Error(`${message}: ${file}`); }

const appFiles = [
  'index.html', 'js/app.js', 'js/db.js', 'js/vocabulary.js', 'js/mastery.js',
  'js/scheduler-v2.js', 'js/history.js', 'js/practice.js', 'js/import.js',
  'js/packs.js', 'js/packs-ui.js', 'js/selection.js', 'js/dashboard.js',
  'js/app-ui.js', 'js/backup.js', 'js/backup-ui.js', 'js/exercises/index.js'
];
check('all V2.4 application files exist', () => appFiles.forEach(file => {
  if (!exists(file)) throw new Error(file);
}));
check('V2.4 entry point declares version and schema 3', () => {
  has('js/app.js', /DutchTrainer\.version\s*=\s*['"]2\.4\.0['"]/);
  has('js/app.js', /DutchTrainer\.schemaVersion\s*=\s*3/);
});
check('V2.4 entry point loads canonical modules', () => {
  ['db.js','vocabulary.js','exercises/index.js','mastery.js','scheduler-v2.js','history.js','practice.js','import.js']
    .forEach(file => has('js/app.js', new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  has('js/app.js', /DutchTrainer\.ready/);
});

check('database schema remains version 3', () => has('js/db.js', /DB_VERSION\s*=\s*3/));
check('database exposes canonical persistence APIs', () => {
  ['init','getWord','getWords','saveWord','saveWords','deleteWord','getPack','getPacks','savePack','deletePack',
   'getSetting','setSetting','saveSession','getSessions','deleteSession','export','import','calculatePackStats']
    .forEach(fn => has('js/db.js', new RegExp(`(?:DutchTrainerDB|db)\??\.?\s*\.?${fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*[:=(]`)));
});
check('backup uses canonical database export/import', () => {
  has('js/backup.js', /(?:DutchTrainerDB|DutchTrainer)\??\.?(?:db\??\.)?(?:export|import)/);
});

check('vocabulary facade exposes canonical selection API', () => {
  ['getAll','getWord','saveWord','saveWords','deleteWord','getPacks','getPack','savePack',
   'selectAll','selectPack','selectNew','selectWeak','selectDue','getSelection','setSource','getSelected']
    .forEach(fn => has('js/vocabulary.js', new RegExp(`\b${fn}\b`)));
});
check('pack manager exposes canonical operations', () => {
  has('js/packs.js', /DutchTrainerPacks\s*=\s*\{/);
  ['getAllPacks','getPack','savePack','createPack','ensurePack','updatePack','deletePack','removePackWords','assignWordToPack']
    .forEach(fn => has('js/packs.js', new RegExp(`\b${fn}\b`)));
});
check('Packs UI owns installed-pack rendering and refresh', () => {
  has('js/packs-ui.js', /DutchTrainerPacksUI\s*=\s*\{/);
  has('js/packs-ui.js', /refresh/);
  no('js/packs-ui.js', /DutchTrainerPacksUI\.loadPacks/);
});

check('exercise registry exposes all five V2.4 exercise types', () => {
  has('js/exercises/index.js', /DutchTrainer\.exercises/);
  ['meaning','recall','fill','choose','production'].forEach(type => has('js/exercises/index.js', new RegExp(`register\\(['"]${type}['"]`)));
});
check('exercise registry has generate/check contract', () => {
  has('js/exercises/index.js', /function register\(name, exercise\)/);
  has('js/exercises/index.js', /typeof exercise\.generate !== 'function'/);
  has('js/exercises/index.js', /typeof exercise\.check !== 'function'/);
});
check('Practice exposes canonical session API', () => {
  has('js/practice.js', /DutchTrainer\.practice=Object\.freeze\(\{/);
  ['start','answer','next','finish','reset','getState','on'].forEach(fn => has('js/practice.js', new RegExp(`\b${fn}\b`)));
});
check('Practice owns five exercise types and selected vocabulary', () => {
  ['meaning','recall','fill','choose','production'].forEach(type => has('js/practice.js', new RegExp(`['"]${type}['"]`)));
  has('js/practice.js', /getSelected/);
  has('js/practice.js', /selectedVocabulary/);
});
check('mastery exposes canonical API and thresholds', () => {
  has('js/mastery.js', /DutchTrainerMastery/);
  ['updateWordAfterAnswer','getCurrentMastery','getMasteryLevel','calculateVocabularyStats','calculateSkillStats','calculatePackStatistics','previewMasteryChange']
    .forEach(fn => has('js/mastery.js', new RegExp(`\b${fn}\b`)));
  has('js/mastery.js', /weakThreshold\s*:\s*40/);
  has('js/mastery.js', /masteredThreshold\s*:\s*90/);
});
check('scheduler exposes V2.4 pure scheduling API', () => {
  has('js/scheduler-v2.js', /DutchTrainer\.scheduler\s*=\s*\{/);
  ['getMastery','isNew','isDue','isWeak','isLearned','getIntervalDays','schedule','classify']
    .forEach(fn => has('js/scheduler-v2.js', new RegExp(`\b${fn}\b`)));
  has('js/scheduler-v2.js', /weakThreshold:\s*40/);
});

check('history service exposes canonical session APIs', () => {
  has('js/history.js', /DutchTrainerHistoryRoot\.history/);
  ['getSessions','getRecent','saveSession','deleteSession','getStats']
    .forEach(fn => has('js/history.js', new RegExp(`\b${fn}\b`)));
  has('js/history.js', /results: Array\.isArray\(session\.results\)/);
});
check('import validation and limits remain enforced', () => {
  has('js/import.js', /validate/);
  has('js/import.js', /maxWords\s*:\s*10000/);
});

check('UI contains every smoke-test navigation target', () => {
  const t = read('index.html');
  ['homeScreen','dashboardScreen','packsScreen','settingsScreen','historyScreen','practiceScreen'].forEach(id => {
    if (!new RegExp(`id="${id}"`).test(t)) throw new Error(`${id} missing`);
  });
});
check('application UI is present in canonical app-ui module', () => {
  has('js/app-ui.js', /DutchTrainer|showScreen|navigate|nav/);
});
check('no obsolete V2.3 UI bridge files are referenced by the V2.4 entry point', () => {
  no('js/app.js', /ui\.js|app-bootstrap\.js|version\.js/);
});
check('Packs UI is the sole installed-pack renderer', () => {
  const files = ['js/app-ui.js','js/dashboard.js','js/packs.js','js/packs-ui.js'];
  files.forEach(file => {
    if (!exists(file)) return;
    const t = read(file);
    if (file !== 'js/packs-ui.js' && /renderInstalledPacks|installedPacksContainer/.test(t)) {
      throw new Error(`duplicate installed-pack rendering in ${file}`);
    }
  });
});

console.log(`\nV2.4 self-tests: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
