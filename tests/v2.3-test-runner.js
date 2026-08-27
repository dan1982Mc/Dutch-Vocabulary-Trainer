/* V2.3 automated static regression checks. Run in Node 18+ from repository root: node tests/v2.3-test-runner.js */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');let pass=0,fail=0;
function check(name,fn){try{fn();console.log('PASS',name);pass++;}catch(e){console.error('FAIL',name,'—',e.message);fail++;}}
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function has(p,re){if(!re.test(read(p)))throw Error('expected pattern not found');}
check('version is centralized at 2.3.0',()=>{const t=read('js/version.js');if(!/2\.3\.0/.test(t))throw Error('2.3.0 missing');});
check('DB schema is version 3',()=>{has('js/db.js',/DB_VERSION=3/);});
check('DB has sessions store',()=>{has('js/db.js',/sessions:'sessions'/);});
check('DB exposes session persistence',()=>{has('js/db.js',/saveSession/);has('js/db.js',/getSessions/);});
check('backup contains sessions',()=>{has('js/db.js',/sessions:await getSessions/);});
check('import exposes validation',()=>{has('js/import.js',/DutchTrainerImport=.*validate:validateImportedData/);});
check('import enforces word limit',()=>{has('js/import.js',/maxWords:10000/);});
check('import normalizes vocabulary to schema 3 through DB',()=>{has('js/import.js',/saveWord\(w\)/);has('js/db.js',/schemaVersion=3/);});
check('Packs UI owns refresh renderer',()=>{has('js/packs-ui.js',/DutchTrainerPacksUI=\{refresh/);});
check('Packs navigation uses refresh',()=>{has('js/ui.js',/DutchTrainerPacksUI\.refresh/);});
check('legacy history persistence is still explicitly tracked',()=>{const t=read('js/ui.js');if(!/v2\.practiceHistory/.test(t))throw Error('legacy marker absent; review cleanup issue #1');});
console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
