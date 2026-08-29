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
function wordPattern(phrase){return phrase.trim().split(/\s+/).map(esc).join('\\s+')}
function maskTarget(sentence,w){
  const targets=acceptedAnswers(w).sort((a,b)=>b.length-a.length);
  // First prefer an exact full-form match.
  for(const target of targets){
    const r=new RegExp('(^|[^\\p{L}])'+wordPattern(target)+'(?=$|[^\\p{L}])','iu');
    if(r.test(sentence))return sentence.replace(r,'$1_____');
  }
  // Word Pack examples often contain a grammatical/inflected expression rather
  // than the exact dictionary form. Find the longest meaningful phrase from the
  // target that actually occurs in the example (e.g. "te grazen" in
  // "te grazen tijdens...", or "evenwicht" in "zijn evenwicht").
  const candidates=[];
  for(const target of targets){
    const tokens=target.split(/\s+/).filter(Boolean);
    for(let len=tokens.length;len>=1;len--){
      for(let start=0;start+len<=tokens.length;start++){
        const part=tokens.slice(start,start+len).join(' ');
        // Never replace tiny grammatical words such as "het", "te", "van".
        if(!tokens.slice(start,start+len).some(t=>t.replace(/[^\p{L}]/gu,'').length>=4))continue;
        candidates.push(part);
      }
    }
  }
  candidates.sort((a,b)=>b.length-a.length);
  for(const part of candidates){
    const r=new RegExp('(^|[^\\p{L}])'+wordPattern(part)+'(?=$|[^\\p{L}])','iu');
    if(r.test(sentence))return sentence.replace(r,'$1_____');
    // Allow the final word of a phrase to appear inflected in the example.
    const pt=part.split(/\s+/);const last=pt.pop();
    if(last.length>=5){
      const stem=last.replace(/(?:en|e|s|t|d)$/i,'');
      if(stem.length>=4){
        const prefix=pt.length?pt.map(esc).join('\\s+')+'\\s+':'';
        const ir=new RegExp('(^|[^\\p{L}])'+prefix+esc(stem)+'\\p{L}*(?=$|[^\\p{L}])','iu');
        if(ir.test(sentence))return sentence.replace(ir,'$1_____');
      }
    }
  }
  // Last resort: use a meaningful lexical token from the target.
  return sentence;
}
function unique(a){const seen=new Set(),out=[];for(const value of a){const s=clean(value),key=s.toLocaleLowerCase('nl-NL');if(s&&!seen.has(key)){seen.add(key);out.push(s)}}return out}
function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}return r}
function uniqueObjects(a){const seen=new Set(),out=[];for(const x of a){const id=clean(x?.id??x?.wordId??x?.dutch??x?.word??x?.term),key=id||JSON.stringify(x);if(!seen.has(key)){seen.add(key);out.push(x)}}return out}
function mergeVocabulary(v){const selected=Array.isArray(v)?v:[],full=Array.isArray(window.DutchTrainerV2VocabularyPool)?window.DutchTrainerV2VocabularyPool:[];return uniqueObjects([...selected,...full])}
function otherWords(v,w){const id=clean(w?.id??w?.wordId),pool=mergeVocabulary(v);return pool.filter(x=>clean(x?.id??x?.wordId)!==id&&(dutch(x)||english(x)))}
function options(values,correct){const correctText=clean(correct),key=correctText.toLocaleLowerCase('nl-NL');const distractors=unique(values).filter(v=>v.toLocaleLowerCase('nl-NL')!==key);const selected=shuffle(distractors).slice(0,3);return shuffle([correctText,...selected]).map((text,i)=>({id:'option-'+i,text,value:text,correct:text.toLocaleLowerCase('nl-NL')===key}));}
function meaningOptions(w,v){const supplied=Array.isArray(w?.meaningOptions)?w.meaningOptions:[],others=otherWords(v,w).map(english);return options([...supplied,...others],english(w))}
function chooseOptions(w,v){const supplied=Array.isArray(w?.wordOptions)?w.wordOptions:[],others=otherWords(v,w).flatMap(x=>[dutch(x),...forms(x)]);return options([...supplied,...others],dutch(w))}
function createExercise(word,type='meaning',vocabulary=[]){const t=normalizeExerciseType(type),example=examples(word)[0]||'',answers=acceptedAnswers(word),base={type:t,wordId:clean(word?.id),dutchWord:dutch(word),meaning:english(word),acceptedAnswers:answers};
if(t==='meaning')return {...base,prompt:'What does this Dutch word mean?',context:dutch(word),inputType:'choice',options:meaningOptions(word,vocabulary),correctAnswer:english(word)};
if(t==='choose'){const sentence=example?maskTarget(example,word):`Complete the sentence with the word "${dutch(word)}".`;return {...base,prompt:'Choose the Dutch word that completes the sentence.',context:sentence,example,sentence,inputType:'choice',options:chooseOptions(word,vocabulary),correctAnswer:dutch(word)};}
if(t==='fill'){const sentence=example?maskTarget(example,word):`Complete the sentence with the word "${dutch(word)}".`;return {...base,prompt:'Complete the sentence.',context:sentence,example,sentence,inputType:'text',correctAnswer:dutch(word)};}
if(t==='recall')return {...base,prompt:'What is the Dutch word or expression?',context:english(word),inputType:'text',correctAnswer:dutch(word)};
return {...base,prompt:'Write the Dutch word or expression.',context:english(word),inputType:'text',correctAnswer:dutch(word)};
}
window.DutchTrainerExercises={TYPES,normalizeExerciseType,createExercise,acceptedAnswers,getExamples:examples,maskTarget};window.createExercise=createExercise;window.normalizeExerciseType=normalizeExerciseType;
})();