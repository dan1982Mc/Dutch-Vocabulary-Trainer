/* Dutch Vocabulary Trainer V2.4 Stable Core self-tests.
 * Run from repository root: node tests/v2.4-self-tests.js
 * These are dependency-free static/contract tests. Browser behavior is covered by
 * tests/v2.4-browser-smoke.cjs in CI.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
let pass=0,fail=0;
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function check(name,fn){try{fn();console.log(`PASS ${name}`);pass++;}catch(error){console.error(`FAIL ${name} — ${error.message}`);fail++;}}
function has(file,re,message='expected pattern not found'){if(!re.test(read(file)))throw new Error(`${message}: ${file}`);}
function no(file,re,message='unexpected pattern found'){if(re.test(read(file)))throw new Error(`${message}: ${file}`);}

const appFiles=['js/version.js','js/db.js','js/storage.js','js/similarity.js','js/mastery.js','js/scheduler.js','js/packs.js','js/exercises.js','js/selection.js','js/import.js','js/dashboard.js','js/practice.js','js/ui.js','js/packs-ui.js','js/backup.js','js/backup-ui.js','js/app-bootstrap.js'];
check('all application script files exist',()=>appFiles.forEach(file=>{if(!fs.existsSync(path.join(root,file)))throw new Error(file);}));
check('database schema remains version 3',()=>has('js/db.js',/const DB_VERSION\s*=\s*3/));
check('database exposes vocabulary, pack and session persistence',()=>{has('js/db.js',/getAllWords/);has('js/db.js',/savePackRecord/);has('js/db.js',/getAllPackRecords/);has('js/db.js',/saveSession/);has('js/db.js',/getSessions/);});
check('backup API uses canonical database export/import',()=>{has('js/backup.js',/DutchTrainerDB\?\.export/);has('js/backup.js',/DutchTrainerDB\.import/);});
check('pack manager exposes canonical operations',()=>{has('js/packs.js',/DutchTrainerPacks\s*=\s*\{/);has('js/packs.js',/getAllPacks/);has('js/packs.js',/createPack/);has('js/packs.js',/deletePack/);});
check('Packs UI owns its refresh renderer',()=>{has('js/packs-ui.js',/DutchTrainerPacksUI\s*=\s*\{/);has('js/packs-ui.js',/refresh/);});
check('navigation refreshes Packs through Packs UI',()=>{const t=read('js/ui.js');if(!/name==='packs'\)window\.DutchTrainerPacksUI\?\.refresh\?\./.test(t))throw new Error('packs navigation refresh missing');if(!/setActivePack[\s\S]*?DutchTrainerPacksUI\?\.refresh\?\./.test(t))throw new Error('active-pack refresh missing');});
check('no legacy history compatibility bridge remains',()=>{no('js/ui.js',/v2\.practiceHistory/);no('js/app-bootstrap.js',/installHistoryBridge|v2\.practiceHistory|Storage\.prototype/);});
check('canonical history API is present',()=>has('js/db.js',/DutchTrainerHistory=\{getSessions\}/));
check('exercise engine exposes all five exercise types',()=>{const t=read('js/exercises.js');['meaning','recall','fill','choose','production'].forEach(type=>{if(!new RegExp(`${type}:'${type}'`).test(t))throw new Error(`${type} missing`);});has('js/exercises.js',/DutchTrainerExercises/);});
check('practice engine exposes start and answer flow',()=>{const t=read('js/practice.js');has('js/practice.js',/DutchTrainerPractice/);if(!/startPractice/.test(t))throw new Error('startPractice missing');if(!/checkAnswer/.test(t))throw new Error('checkAnswer missing');if(!/nextQuestion/.test(t))throw new Error('nextQuestion missing');});
check('selection manager persists vocabulary selection',()=>{has('js/selection.js',/localStorage\.setItem/);has('js/selection.js',/selectVocabularyPack/);has('js/selection.js',/selectAllVocabulary/);});
check('import validation and limits remain enforced',()=>{has('js/import.js',/validate/);has('js/import.js',/maxWords\s*:\s*10000/);});
check('UI contains every smoke-test navigation target',()=>{const t=read('index.html');['homeScreen','dashboardScreen','packsScreen','settingsScreen','historyScreen','practiceScreen'].forEach(id=>{if(!new RegExp(`id="${id}"`).test(t))throw new Error(`${id} missing`);});});
check('UI uses Packs UI as renderer and does not duplicate installed-pack renderer ownership',()=>{const t=read('js/ui.js');if(/DutchTrainerPacksUI.*loadPacks/.test(t))throw new Error('ui.js calls Packs UI legacy loader');});

console.log(`\nV2.4 self-tests: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
