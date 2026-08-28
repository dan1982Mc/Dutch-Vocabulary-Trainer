/* Dutch Vocabulary Trainer V2.4 deterministic core unit tests. */
'use strict';
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
let pass=0,fail=0;
function check(name,fn){try{fn();console.log(`PASS ${name}`);pass++;}catch(error){console.error(`FAIL ${name} — ${error.message}`);fail++;}}
function load(file,extra={}){const context={console,window:{},...extra};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});return context;}
function equal(actual,expected,message){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(message||`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);}

const mastery=load('js/mastery.js');
check('mastery preview increases correct answer by configured reward',()=>equal(mastery.previewMasteryChange({mastery:20},'correct'),{before:20,delta:10,after:30}));
check('mastery preview clamps at 100',()=>equal(mastery.previewMasteryChange({mastery:95},'correct').after,100));
check('mastery levels use stable boundaries',()=>{equal(mastery.getMasteryLevel(0),'new');equal(mastery.getMasteryLevel(39),'weak');equal(mastery.getMasteryLevel(40),'developing');equal(mastery.getMasteryLevel(90),'mastered');});
check('empty vocabulary statistics are deterministic',()=>equal(mastery.calculateVocabularyStats([]),{total:0,attempted:0,newWords:0,weak:0,due:0,mastered:0,averageMastery:0,accuracy:0,progress:0}));
check('vocabulary statistics calculate mastery and accuracy',()=>{const words=[{id:'a',mastery:90,stats:{attempts:2,correct:2}},{id:'b',mastery:20,stats:{attempts:2,correct:1}}];const s=mastery.calculateVocabularyStats(words);equal(s.total,2);equal(s.attempted,2);equal(s.mastered,1);equal(s.averageMastery,55);equal(s.accuracy,75);});
check('exercise-type skill statistics cover all five types',()=>{const s=mastery.calculateSkillStats([{stats:{byExerciseType:{meaning:{attempts:2,correct:1},recall:{attempts:1,correct:1}}}}]);['meaning','recall','fill','choose','production'].forEach(type=>{if(!s[type])throw new Error(`${type} missing`);});equal(s.meaning.accuracy,50);equal(s.recall.accuracy,100);});

const exercises=load('js/exercises.js');
const word={id:'unit-1',dutch:'tekeergaan',english:'to go wild',examples:[{nl:'Hij ging flink tekeer tijdens de vergadering.'}]};
check('exercise engine normalizes aliases',()=>{equal(exercises.normalizeExerciseType('fill-sentence'),'fill');equal(exercises.normalizeExerciseType('choose-word'),'choose');equal(exercises.normalizeExerciseType('typing'),'production');});
check('meaning exercise has a choice and correct answer',()=>{const e=exercises.createExercise(word,'meaning',[]);equal(e.inputType,'choice');equal(e.correctAnswer,'to go wild');if(!Array.isArray(e.options))throw new Error('meaning options missing');});
check('recall exercise uses Dutch answer',()=>{const e=exercises.createExercise(word,'recall',[]);equal(e.inputType,'text');equal(e.correctAnswer,'tekeergaan');});
check('fill exercise masks a meaningful example target',()=>{const e=exercises.createExercise(word,'fill',[]);equal(e.inputType,'text');if(!e.sentence.includes('_____'))throw new Error('example target was not masked');});
check('choose exercise provides choice options',()=>{const e=exercises.createExercise(word,'choose',[word,{id:'unit-2',dutch:'rustig',english:'calm'}]);equal(e.inputType,'choice');if(!Array.isArray(e.options)||!e.options.some(o=>o.correct))throw new Error('correct choice missing');});

console.log(`\nV2.4 core unit tests: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
