/* Dutch Vocabulary Trainer V2.4 — tiny UI adapter */
(async function () {
    'use strict';
    const app = window.DutchTrainer;
    if (!app?.ready) return;
    try { await app.ready; } catch (e) { console.error('V2.4 core failed to initialize', e); return; }

    const $ = id => document.getElementById(id);
    const screens = ['home','dashboard','packs','settings','practice','complete','history'];
    const ids = { home:'homeScreen', dashboard:'dashboardScreen', packs:'packsScreen', settings:'settingsScreen', practice:'practiceScreen', complete:'completeScreen', history:'historyScreen' };
    let selectedPackId = 'all';

    function nav(name) {
        screens.forEach(s => $(ids[s])?.classList.toggle('active', s === name));
        if (name === 'dashboard') renderDashboard();
        if (name === 'packs') renderPacks();
        if (name === 'history') renderHistory();
    }

    async function words() { return app.vocabulary.getAll(); }
    async function selectedWords() { const ws = await words(); return selectedPackId === 'all' ? ws : ws.filter(w => String(w.packId || 'default') === selectedPackId); }
    function stats(ws) { const mastery = ws.map(w => Number(w.mastery) || 0); return { total:ws.length, learned:ws.filter(w=>(Number(w.mastery)||0)>=90).length, weak:ws.filter(w=>(Number(w.mastery)||0)<40).length, due:ws.filter(w=>w.isDue||(w.dueAt&&new Date(w.dueAt)<=new Date())).length, average:ws.length?Math.round(mastery.reduce((a,b)=>a+b,0)/ws.length):0 }; }

    async function renderDashboard() {
        const ws=await selectedWords(), all=await words(), s=stats(ws), a=stats(all);
        const set=(id,value)=>{if($(id))$(id).textContent=value;};
        set('allWords',a.total);set('allLearned',a.learned);set('allDue',a.due);set('allWeak',a.weak);set('allProgressText',a.average+'%');
        if($('allProgressFill'))$('allProgressFill').style.width=a.average+'%';
        set('selectedLearned',s.learned);set('selectedDue',s.due);set('selectedWeak',s.weak);set('selectedNew',ws.filter(w=>(Number(w.mastery)||0)<=0).length);set('selectedProgressText',s.average+'%');
        if($('selectedProgressFill'))$('selectedProgressFill').style.width=s.average+'%';
        set('selectedFilterLabel',selectedPackId==='all'?'All Vocabulary':selectedPackId);
    }

    async function renderPacks() {
        const list=$('packsList');if(!list)return;
        const ws=await words(),groups=new Map();
        ws.forEach(w=>{const id=String(w.packId||'default');if(!groups.has(id))groups.set(id,[]);groups.get(id).push(w);});
        list.innerHTML='';
        const selector=document.createElement('select');selector.id='v24PackSelector';
        selector.innerHTML='<option value="all">All Vocabulary</option>';
        groups.forEach((items,packId)=>{const option=document.createElement('option');option.value=packId;option.textContent=`${packId} (${items.length})`;selector.append(option);});
        selector.value=groups.has(selectedPackId)||selectedPackId==='all'?selectedPackId:'all';selectedPackId=selector.value;
        selector.addEventListener('change',async()=>{selectedPackId=selector.value;await renderPacks();await renderDashboard();});
        const label=document.createElement('label');label.textContent='Active vocabulary pack';label.append(document.createElement('br'),selector);list.append(label);
        if(!groups.size){const empty=document.createElement('p');empty.textContent='No vocabulary packs installed.';list.append(empty);return;}
        groups.forEach((items,packId)=>{
            const card=document.createElement('div');card.className='card pack-card';if(packId===selectedPackId)card.classList.add('active');
            const title=document.createElement('strong');title.textContent=packId==='default'?'Default Vocabulary':packId;
            const p=document.createElement('p');p.textContent=`${items.length} words`;
            const use=document.createElement('button');use.type='button';use.className='secondary';use.textContent=packId===selectedPackId?'Selected':'Use Pack';use.disabled=packId===selectedPackId;
            use.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();selectedPackId=packId;await renderPacks();await renderDashboard();});
            card.append(title,p,use);list.append(card);
        });
    }

    async function renderHistory() { const area=$('historyContent');if(!area)return;const rows=await app.history.getSessions();area.innerHTML='';if(!rows.length){area.textContent='No practice history yet.';return;}const table=document.createElement('table');table.innerHTML='<thead><tr><th>Date</th><th>Exercise</th><th>Score</th></tr></thead>';const body=document.createElement('tbody');rows.slice().sort((a,b)=>new Date(b.finishedAt||b.startedAt)-new Date(a.finishedAt||a.startedAt)).slice(0,200).forEach(r=>{const tr=document.createElement('tr');[new Date(r.finishedAt||r.startedAt).toLocaleString(),r.exerciseType||'',`${r.correctCount??0} / ${r.answerCount??r.questionCount??0}`].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});body.append(tr);});table.append(body);area.append(table); }

    async function startPractice() { const ws=await selectedWords();if(!ws.length){alert('No vocabulary available. Import or add vocabulary first.');return;}const type=$('exerciseType')?.value||$('settingsExerciseType')?.value||'meaning';const raw=$('customQuestionCount')?.value||document.querySelector('.countPreset.active')?.dataset.value||$('settingsQuestionCount')?.value||20;const count=Math.max(1,Math.min(500,Number(raw)||20));const session=await app.practice.start({vocabulary:ws,exerciseType:type,questionCount:Math.min(count,ws.length),mode:'full'});if(!session?.success){alert('Could not start practice.');return;}nav('practice');renderQuestion(session.question); }
    function renderQuestion(q) { if(!q)return;const e=q.exercise||{};if($('exerciseBadge'))$('exerciseBadge').textContent=e.label||q.type||'Exercise';if($('questionPrompt'))$('questionPrompt').textContent=e.prompt||'Answer the question.';if($('questionContext'))$('questionContext').textContent=e.context||'';const area=$('answerArea');if(!area)return;area.innerHTML='';if(Array.isArray(e.options)&&e.options.length)e.options.forEach(option=>{const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='v24answer';input.value=String(option);label.append(input,document.createTextNode(' '+option));area.append(label);});else{const input=document.createElement('input');input.id='answerInput';input.type='text';input.autocomplete='off';area.append(input);input.focus();}if($('feedbackArea'))$('feedbackArea').innerHTML='';$('checkBtn')?.classList.remove('hidden');$('nextBtn')?.classList.add('hidden');const state=app.practice.state?.()||{};if($('sessionCounter'))$('sessionCounter').textContent=`${(state.currentIndex||0)+1}/${state.questionCount||1}`; }
    function answerValue(){return document.querySelector('#answerArea input[type=radio]:checked')?.value||$('answerInput')?.value||'';}
    async function check(){const value=answerValue().trim();if(!value)return;const result=await app.practice.answer(value),f=result.feedback||{};if($('feedbackArea'))$('feedbackArea').textContent=f.correct?'✓ Correct!':`✗ Correct answer: ${f.expected||result.question?.exercise?.correctAnswer||''}`;$('checkBtn')?.classList.add('hidden');$('nextBtn')?.classList.remove('hidden');document.querySelectorAll('#answerArea input').forEach(i=>i.disabled=true);}
    async function next(){const result=await app.practice.next();if(result.completed){nav('complete');if($('sessionScore'))$('sessionScore').textContent=`${result.state.correctCount||0} / ${result.state.answerCount||0} correct`;return;}renderQuestion(result.question);}
    function bind(){ $('dashboardBtn')?.addEventListener('click',()=>nav('dashboard'));$('packsBtn')?.addEventListener('click',()=>nav('packs'));$('historyBtn')?.addEventListener('click',()=>nav('history'));$('settingsBtn')?.addEventListener('click',()=>nav('settings'));document.querySelectorAll('.backBtn').forEach(b=>b.addEventListener('click',()=>nav('home')));$('quickPracticeBtn')?.addEventListener('click',startPractice);$('practiceSetupBtn')?.addEventListener('click',()=>$('practiceModal')?.classList.remove('hidden'));$('closePracticeModal')?.addEventListener('click',()=>$('practiceModal')?.classList.add('hidden'));$('startPracticeBtn')?.addEventListener('click',()=>{$('practiceModal')?.classList.add('hidden');startPractice();});$('checkBtn')?.addEventListener('click',check);$('nextBtn')?.addEventListener('click',next);$('exitPracticeBtn')?.addEventListener('click',()=>nav('home'));$('backDashboardBtn')?.addEventListener('click',()=>nav('dashboard'));$('practiceAgainBtn')?.addEventListener('click',startPractice);document.querySelectorAll('.countPreset').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.countPreset').forEach(x=>x.classList.remove('active'));b.classList.add('active');if($('customQuestionCount'))$('customQuestionCount').value='';}));renderDashboard(); }
    window.DutchTrainerUI={nav,renderDashboard,renderPacks,renderHistory,startPractice};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();