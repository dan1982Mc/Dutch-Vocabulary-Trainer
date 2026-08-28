'use strict';

const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});
const registry = {};

function register(name, exercise) {
    if (!name || !exercise || typeof exercise.generate !== 'function' || typeof exercise.check !== 'function') throw new Error(`Invalid exercise: ${name}`);
    registry[name] = Object.freeze({ name, ...exercise });
}
function get(name) { return registry[name] || null; }
function list() { return Object.keys(registry); }
function normalize(value) { return String(value ?? '').trim().toLocaleLowerCase('nl-NL'); }
function clean(value) { return String(value ?? '').trim(); }
function shuffle(values) { const r=[...values]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; }
function dutch(word) { return clean(word?.dutch || word?.word || word?.term || ''); }
function english(word) { return clean(word?.english || word?.meaning || word?.translation || word?.definition || ''); }
function accepted(word) {
    const forms=word?.forms||{};
    const variants=Array.isArray(forms.variants)?forms.variants:[];
    return [...new Set([dutch(word), forms.base, ...variants].map(clean).filter(Boolean))];
}
function distractors(vocabulary, word, mapper, answer) {
    const id=word?.id;
    return (Array.isArray(vocabulary)?vocabulary:[]).filter(x=>x?.id!==id).map(mapper).map(clean).filter(Boolean).filter(x=>normalize(x)!==normalize(answer));
}
function makeOptions(answer, values) { return shuffle([answer,...values.filter((v,i,a)=>a.findIndex(x=>normalize(x)===normalize(v))===i).slice(0,3)]); }

register('meaning', {
    label:'Meaning',
    generate(word, options=[], vocabulary=[]) {
        const answer=english(word);
        const values=Array.isArray(options)&&options.length ? options : makeOptions(answer,distractors(vocabulary,word,english,answer));
        return {type:'meaning',prompt:'Choose the Dutch word that matches this English meaning.',context:answer,answer:dutch(word),correctAnswer:dutch(word),options:values.map(v=>typeof v==='string'?v:v?.text).filter(Boolean)};
    },
    check(question, answer) { return normalize(answer)===normalize(question.correctAnswer||question.answer); }
});

register('recall', {
    label:'Recall',
    generate(word) { return {type:'recall',prompt:'What is the English meaning of this Dutch word?',context:dutch(word),answer:english(word),correctAnswer:english(word)}; },
    check(question, answer) { return normalize(answer)===normalize(question.correctAnswer||question.answer); }
});

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&'); }
function wordPattern(value) { return value.trim().split(/\\s+/).map(escapeRegExp).join('\\\\s+'); }
function maskTarget(sentence, word) {
    const targets=accepted(word).sort((a,b)=>b.length-a.length);
    for(const target of targets){
        const re=new RegExp('(^|[^\\\\p{L}])'+wordPattern(target)+'(?=$|[^\\\\p{L}])','iu');
        if(re.test(sentence)) return sentence.replace(re,'$1_____');
    }
    for(const target of targets){
        const tokens=target.split(/\\s+/).filter(Boolean);
        for(let len=tokens.length;len>=1;len--){
            for(let start=0;start+len<=tokens.length;start++){
                const part=tokens.slice(start,start+len).join(' ');
                if(!tokens.slice(start,start+len).some(t=>t.replace(/[^\\\\p{L}]/gu,'').length>=4)) continue;
                const re=new RegExp('(^|[^\\\\p{L}])'+wordPattern(part)+'(?=$|[^\\\\p{L}])','iu');
                if(re.test(sentence)) return sentence.replace(re,'$1_____');
            }
        }
    }
    return '';
}
function examples(word) { return (Array.isArray(word?.examples)?word.examples:[]).map(e=>typeof e==='string'?e:e?.nl||e?.sentence||e?.text||'').map(clean).filter(Boolean); }

register('fill', {
    label:'Fill Sentence',
    generate(word) {
        const target=dutch(word);
        const sentence=examples(word).map(s=>maskTarget(s,word)).find(Boolean) || '';
        return {type:'fill',prompt:'Fill in the sentence with the appropriate Dutch word.',context:sentence,answer:target,correctAnswer:target,acceptedAnswers:accepted(word)};
    },
    check(question, answer) {
        const value=clean(answer), targets=question.acceptedAnswers||[question.correctAnswer||question.answer];
        if(targets.some(x=>normalize(x)===normalize(value))) return {correct:true,almost:false};
        const target=clean(question.correctAnswer||question.answer);
        if(!value||!target) return {correct:false,almost:false};
        const distance=(a,b)=>{const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<cur.length;j++)prev[j]=cur[j];}return prev[b.length];};
        const tokens=target.split(/\\s+/).filter(Boolean), d=distance(normalize(value),normalize(target));
        const limit=tokens.length===1?(target.length<=5?1:target.length<=9?2:3):(tokens.length<=2?1:2);
        return {correct:false,almost:d<=limit};
    }
});

register('choose', {
    label:'Choose Word',
    generate(word, options=[], vocabulary=[]) {
        const target=dutch(word), sentence=examples(word).map(s=>maskTarget(s,word)).find(Boolean)||'';
        const values=Array.isArray(options)&&options.length?options:makeOptions(target,distractors(vocabulary,word,dutch,target));
        return {type:'choose',prompt:'Choose the Dutch word that completes the sentence.',context:sentence,answer:target,correctAnswer:target,options:values.map(v=>typeof v==='string'?v:v?.text).filter(Boolean)};
    },
    check(question,answer){return normalize(answer)===normalize(question.correctAnswer||question.answer);}
});

register('production', {
    label:'Production',
    generate(word){const target=dutch(word);return {type:'production',prompt:'Write a natural Dutch sentence using this word.',context:target,answer:target,correctAnswer:target,acceptedAnswers:accepted(word)};},
    check(question,answer){const value=normalize(answer);const targets=question.acceptedAnswers||[question.correctAnswer||question.answer];return !!value&&value.length>normalize(question.correctAnswer||question.answer).length&&targets.some(t=>value.includes(normalize(t)));}
});

DutchTrainer.exercises={register,get,list,create:function(word,name,vocabulary=[]){const type=String(name||'meaning').trim().toLowerCase();const exercise=get(type);if(!exercise)throw new Error(`Unknown exercise type: ${type}`);const generated=exercise.generate(word,[],vocabulary);return {...generated,type:generated.type||type,label:generated.label||exercise.label||type,correctAnswer:generated.correctAnswer??generated.answer??''};}};
