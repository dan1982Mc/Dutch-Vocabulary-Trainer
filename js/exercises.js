/* DUTCH VOCABULARY TRAINER V2 - canonical exercise engine */
(function(){
'use strict';
const TYPES={meaning:'meaning',recall:'recall',fill:'fill',choose:'choose',production:'production'};
const ALIASES={definition:'meaning','fill-sentence':'fill',fillsentence:'fill',sentence:'fill','choose-word':'choose',chooseword:'choose',multiplechoice:'choose',produce:'production',typing:'production'};
const clean=v=>String(v??'').trim();
function normalizeExerciseType(v){const k=clean(v).toLowerCase().replace(/[_ ]/g,'-');return k==='mixed'?'mixed':(ALIASES[k]||k||'meaning')}
function dutch(w){return clean(w?.dutch??w?.word??w?.term??w?.text)}
function english(w){return clean(w?.english??w?.meaning??w?.translation??w?.definition)}
function forms(w){const f=w?.forms||{};return [f.base,...(Array.isArray(f.variants)?f.variants:[])].map(clean).filter(Boolean)}
function acceptedAnswers(w){return [...new Set([dutch(w),...forms(w)].filter(Boolean))]}
function examples(w){return (Array.isArray(w?.examples)?w.examples:[]).map(e=>typeof e==='string'?clean(e):clean(e?.nl)).filter(Boolean)}
function esc(v){return v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function maskTarget(sentence,w){for(const target of acceptedAnswers(w).sort((a,b)=>b.length-a.length)){const p=esc(target).replace(/\\s+/g,'\\s+');const r=new RegExp('(^|[^\\p{L}])'+p+'(?=$|[^\\p{L}])','iu');if(r.test(sentence))return sentence.replace(r,'$1_____')}
const base=dutch(w),stem=base.replace(/(?:en|e|s)$/i,'');if(stem.length>=5){const r=new RegExp('(^|[^\\p{L}])'+esc(stem)+'\\p{L}*(?=$|[^\\p{L}])','iu');if(r.test(sentence))return sentence.replace(r,'$1_____')}
return sentence}
function unique(a){const seen=new Set(),out=[];for(const value of a){const s=clean(value),key=s.toLocaleLowerCase('nl-NL');if(s&&!seen.has(key)){seen.add(key);out.push(s)}}return out}
function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}return r}
function mergeVocabulary(v){const selected=Array.isArray(v)?v:[],full=Array.isArray(window.DutchTrainerV2VocabularyPool)?window.DutchTrainerV2VocabularyPool:[];return uniqueObjects([...selected,...full])}
function uniqueObjects(a){const seen=new Set(),out=[];for(const x of a){const id=clean(x?.id??x?.wordId??x?.dutch??x?.word??x?.term),key=id||JSON.stringify(x);if(!seen.has(key)){seen.add(key);out.push(x)}}return out}
function otherWords(v,w){const id=clean(w?.id??w?.wordId),pool=mergeVocabulary(v);return pool.filter(x=>clean(x?.id??x?.wordId)!==id&&(dutch(x)||english(x)))}
function options(values,correct){const vals=unique([correct,...values]);return shuffle(vals).slice(0,4).map((text,i)=>({id:'option-'+i,text,value:text,correct:text.toLocaleLowerCase('nl-NL')===clean(correct).toLocaleLowerCase('nl-NL')}))}
function meaningOptions(w,v){const supplied=Array.isArray(w?.meaningOptions)?w.meaningOptions:[],others=otherWords(v,w).map(english);return options([...supplied,...shuffle(others)],english(w))}
function chooseOptions(w,v){const supplied=Array.isArray(w?.wordOptions)?w.wordOptions:[],others=otherWords(v,w).flatMap(x=>[dutch(x),...forms(x)]);return options([...supplied,...shuffle(others)],dutch(w))}
function createExercise(word,type='meaning',vocabulary=[]){const t=normalizeExerciseType(type),example=examples(word)[0]||'',answers=acceptedAnswers(word),base={type:t,wordId:clean(word?.id),dutchWord:dutch(word),meaning:english(word),acceptedAnswers:answers};
if(t==='meaning')return {...base,prompt:'What does this Dutch word mean?',context:dutch(word),inputType:'choice',options:meaningOptions(word,vocabulary),correctAnswer:english(word)};
if(t==='choose'){const sentence=example?maskTarget(example,word):`Complete the sentence with the word "${dutch(word)}".`;return {...base,prompt:'Choose the Dutch word that completes the sentence.',context:sentence,example,sentence,inputType:'choice',options:chooseOptions(word,vocabulary),correctAnswer:dutch(word)};}
if(t==='fill'){const sentence=example?maskTarget(example,word):`Complete the sentence with the word "${dutch(word)}".`;return {...base,prompt:'Complete the sentence.',context:sentence,example,sentence,inputType:'text',correctAnswer:dutch(word)};
}
if(t==='recall')return {...base,prompt:'What is the Dutch word or expression?',context:english(word),inputType:'text',correctAnswer:dutch(word)};
return {...base,prompt:'Write the Dutch word or expression.',context:english(word),inputType:'text',correctAnswer:dutch(word)};
}
window.DutchTrainerExercises={TYPES,normalizeExerciseType,createExercise,acceptedAnswers,getExamples:examples,maskTarget};window.createExercise=createExercise;window.normalizeExerciseType=normalizeExerciseType;
})();