/* Dutch Vocabulary Trainer V2.4 deterministic core unit tests. */
'use strict';
const fs=require('fs');const vm=require('vm');const path=require('path');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;
function check(name,fn){try{fn();console.log(`PASS ${name}`);pass++;}catch(error){console.error(`FAIL ${name} — ${error.message}`);fail++;}}
function load(file,extra={}){const context={console,window:{},...extra};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});return context;}
function equal(actual,expected,message){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(message||`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);}
function ok(value,message){if(!value)throw new Error(message||'expected truthy value');}

const mastery=load('js/mastery.js');
check('mastery preview increases correct answer by configured reward',()=>equal(mastery.window.previewMasteryChange({mastery:20},'correct'),{before:20,delta:10,after:30}));
check('mastery preview clamps at 100',()=>equal(mastery.window.previewMasteryChange({mastery:95},'correct').after,100));
check('mastery levels use actual exported boundaries',()=>{equal(mastery.window.getMasteryLevel(0),'new');equal(mastery.window.getMasteryLevel(39),'weak');equal(mastery.window.getMasteryLevel(40),'developing');equal(mastery.window.getMasteryLevel(90),'mastered');});
check('empty vocabulary statistics are deterministic',()=>equal(mastery.window.calculateVocabularyStats([]),{total:0,attempted:0,newWords:0,weak:0,due:0,mastered:0,averageMastery:0,accuracy:0,progress:0}));
check('vocabulary statistics calculate mastery and accuracy',()=>{const words=[{id:'a',mastery:90,stats:{attempts:2,correct:2}},{id:'b',mastery:20,stats:{attempts:2,correct:1}}];const s=mastery.window.calculateVocabularyStats(words);equal(s.total,2);equal(s.attempted,2);equal(s.mastered,1);equal(s.averageMastery,55);equal(s.accuracy,75);});
check('exercise-type skill statistics cover all five types',()=>{const s=mastery.window.calculateSkillStats([{stats:{byExerciseType:{meaning:{attempts:2,correct:1},recall:{attempts:1,correct:1}}}}]);['meaning','recall','fill','choose','production'].forEach(type=>ok(s[type],`${type} missing`));equal(s.meaning.accuracy,50);equal(s.recall.accuracy,100);});
check('pack statistics group words by pack',()=>{const s=mastery.window.calculatePackStatistics([{packId:'a',mastery:20},{packId:'b',mastery:90}]);ok(s.a&&s.b);equal(s.a.stats.total,1);equal(s.b.stats.mastered,1);});

const exercises=load('js/exercises.js');const api=exercises.window.DutchTrainerExercises;const word={id:'unit-1',dutch:'tekeergaan',english:'to go wild',examples:[{nl:'Hij ging flink tekeer tijdens de vergadering.'}]};
check('exercise engine exports canonical API',()=>{ok(api&&typeof api.normalizeExerciseType==='function');ok(typeof api.createExercise==='function');});
check('exercise engine normalizes aliases',()=>{equal(api.normalizeExerciseType('fill-sentence'),'fill');equal(api.normalizeExerciseType('choose-word'),'choose');equal(api.normalizeExerciseType('typing'),'production');});
check('meaning exercise has a choice and correct answer',()=>{const e=api.createExercise(word,'meaning',[]);equal(e.inputType,'choice');equal(e.correctAnswer,'to go wild');ok(Array.isArray(e.options),'meaning options missing');});
check('recall exercise uses Dutch answer',()=>{const e=api.createExercise(word,'recall',[]);equal(e.inputType,'text');equal(e.correctAnswer,'tekeergaan');});
check('fill exercise preserves valid sentence output',()=>{const e=api.createExercise(word,'fill',[]);equal(e.inputType,'text');ok(e.sentence.includes('_____')||e.sentence===word.examples[0].nl,'fill sentence missing');});
check('choose exercise provides choice options',()=>{const e=api.createExercise(word,'choose',[word,{id:'unit-2',dutch:'rustig',english:'calm'}]);equal(e.inputType,'choice');ok(Array.isArray(e.options)&&e.options.some(o=>o.correct),'correct choice missing');});

console.log(`\nV2.4 core unit tests: ${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
