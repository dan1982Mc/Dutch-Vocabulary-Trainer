/* Dutch Vocabulary Trainer V2.4 — UI integration */
(async function () {
    'use strict';
    const app = window.DutchTrainer;
    if (!app?.ready) return;
    try { await app.ready; } catch (error) { console.error('V2.4 core failed to initialize', error); return; }

    const $ = id => document.getElementById(id);
    const screens = ['home', 'dashboard', 'packs', 'settings', 'practice', 'complete', 'history'];
    const ids = { home:'homeScreen', dashboard:'dashboardScreen', packs:'packsScreen', settings:'settingsScreen', practice:'practiceScreen', complete:'completeScreen', history:'historyScreen' };
    let selectedPackId = localStorage.getItem('v24.selectedPackId') || 'all';
    let answerInProgress = false;

    function nav(name) {
        screens.forEach(screen => $(ids[screen])?.classList.toggle('active', screen === name));
        if (name === 'dashboard') renderDashboard();
        if (name === 'packs') renderPacks();
        if (name === 'history') renderHistory();
    }
    async function allWords() { return app.vocabulary.getAll(); }
    async function selectedWords() { const words = await allWords(); return selectedPackId === 'all' ? words : words.filter(word => String(word.packId || 'default') === selectedPackId); }
    function stats(words) {
        const list = Array.isArray(words) ? words : [], mastery = list.map(word => Number(word.mastery) || 0);
        return { total:list.length, learned:list.filter(w => (Number(w.mastery)||0) >= 90).length, weak:list.filter(w => (Number(w.mastery)||0) < 40).length, due:list.filter(w => w.isDue || (w.dueAt && new Date(w.dueAt) <= new Date())).length, average:list.length ? Math.round(mastery.reduce((a,b)=>a+b,0)/list.length) : 0 };
    }
    function setText(id, value) { if ($(id)) $(id).textContent = value; }

    async function renderDashboard() {
        const words = await selectedWords(), all = await allWords(), selected = stats(words), total = stats(all);
        setText('allWords', total.total); setText('allLearned', total.learned); setText('allDue', total.due); setText('allWeak', total.weak); setText('allProgressText', `${total.average}%`);
        if ($('allProgressFill')) $('allProgressFill').style.width = `${total.average}%`;
        setText('selectedLearned', selected.learned); setText('selectedDue', selected.due); setText('selectedWeak', selected.weak); setText('selectedNew', words.filter(w => (Number(w.mastery)||0) <= 0).length); setText('selectedProgressText', `${selected.average}%`);
        if ($('selectedProgressFill')) $('selectedProgressFill').style.width = `${selected.average}%`;
        setText('selectedFilterLabel', selectedPackId === 'all' ? 'All Vocabulary' : selectedPackId);
    }

    async function renderPacks() {
        const list = $('packsList'), selector = $('v24PackSelector');
        if (!list || !selector) return;
        const words = await allWords(), groups = new Map();
        words.forEach(word => { const id = String(word.packId || 'default'); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(word); });
        selector.innerHTML = '<option value="all">All Vocabulary</option>';
        groups.forEach((items, id) => { const option = document.createElement('option'); option.value = id; option.textContent = `${id} (${items.length})`; selector.append(option); });
        if (selectedPackId !== 'all' && !groups.has(selectedPackId)) selectedPackId = 'all';
        selector.value = selectedPackId;
        selector.onchange = async () => { selectedPackId = selector.value; localStorage.setItem('v24.selectedPackId', selectedPackId); await renderPacks(); await renderDashboard(); };
        list.innerHTML = '';
        if (!groups.size) { list.textContent = 'No vocabulary packs installed.'; return; }
        groups.forEach((items, id) => {
            const card = document.createElement('div'); card.className = 'card pack-card'; if (id === selectedPackId) card.classList.add('active');
            const title = document.createElement('strong'); title.textContent = id === 'default' ? 'Default Vocabulary' : id;
            const count = document.createElement('p'); count.textContent = `${items.length} words`;
            const use = document.createElement('button'); use.type = 'button'; use.className = 'secondary'; use.textContent = id === selectedPackId ? 'Selected' : 'Use Pack'; use.disabled = id === selectedPackId;
            use.onclick = async () => { selectedPackId = id; localStorage.setItem('v24.selectedPackId', selectedPackId); await renderPacks(); await renderDashboard(); };
            card.append(title, count, use); list.append(card);
        });
    }

    async function renderHistory() {
        const area = $('historyContent'); if (!area) return;
        const sessions = await app.history.getSessions(), vocabulary = await allWords(), byId = new Map(vocabulary.map(word => [String(word.id), word]));
        area.innerHTML = '';
        if (!sessions.length) { area.textContent = 'No practice history yet.'; return; }
        const table = document.createElement('table');
        table.className = 'history-table';
        table.innerHTML = '<thead><tr><th>Date</th><th>Words</th><th>Exercise</th><th>Mastery %</th></tr></thead>';
        const body = document.createElement('tbody');
        sessions.slice().sort((a,b) => new Date(b.finishedAt || b.completedAt || b.startedAt || 0) - new Date(a.finishedAt || a.completedAt || a.startedAt || 0)).slice(0,200).forEach(session => {
            const results = Array.isArray(session.results) ? session.results : [];
            const terms = results.map(result => result.dutch || byId.get(String(result.wordId))?.dutch || '').filter(Boolean);
            const uniqueTerms = [...new Set(terms)];
            const masteryValues = results.map(result => Number(result.mastery)).filter(Number.isFinite);
            const mastery = session.mastery != null ? Number(session.mastery) : (masteryValues.length ? Math.round(masteryValues.reduce((a,b)=>a+b,0)/masteryValues.length) : null);
            const tr = document.createElement('tr');
            [new Date(session.finishedAt || session.completedAt || session.startedAt).toLocaleString(), uniqueTerms.length ? uniqueTerms.join(', ') : '—', session.exerciseType || '—', mastery == null ? '—' : `${mastery}%`].forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); });
            body.append(tr);
        });
        table.append(body); area.append(table);
    }

    function setPracticeProgress(state) {
        const total = Number(state?.questionCount) || 0, index = Number(state?.currentIndex) || 0, answered = Number(state?.answerCount) || 0;
        setText('sessionCounter', total ? `${Math.min(total, index + 1)}/${total}` : '0/0');
        if ($('sessionProgressFill')) $('sessionProgressFill').style.width = total ? `${Math.round(answered / total * 100)}%` : '0%';
        setText('practiceSubtitle', total ? `${answered} answered · ${Number(state.correctCount)||0} correct` : '');
    }

    function showMastery(value) {
        let element = $('practiceMastery');
        if (!element) { element = document.createElement('div'); element.id = 'practiceMastery'; element.className = 'mastery-display'; $('questionCard')?.insertBefore(element, $('answerArea')); }
        element.textContent = `Mastery: ${Number(value) || 0}%`; element.classList.remove('hidden');
    }

    async function startPractice() {
        const words = await selectedWords();
        if (!words.length) { alert('No vocabulary available. Import or add vocabulary first.'); return; }
        app.practice.reset?.();
        const type = $('exerciseType')?.value || $('settingsExerciseType')?.value || 'meaning';
        const raw = $('customQuestionCount')?.value || document.querySelector('.countPreset.active')?.dataset.value || $('settingsQuestionCount')?.value || 20;
        const count = Math.max(1, Math.min(500, Number(raw) || 20));
        const result = await app.practice.start({ vocabulary: words, exerciseType: type, questionCount: Math.min(count, words.length), mode: 'full' });
        if (!result?.success) { alert('Could not start practice.'); return; }
        $('practiceModal')?.classList.add('hidden'); nav('practice'); renderQuestion(result.question);
    }

    function renderQuestion(question) {
        if (!question) return;
        const exercise = question.exercise || {};
        setText('exerciseBadge', exercise.label || question.type || 'Exercise'); setText('questionPrompt', exercise.prompt || 'Answer the question.'); setText('questionContext', exercise.context || '');
        showMastery(question.word?.mastery || 0);
        const area = $('answerArea'); if (!area) return; area.innerHTML = '';
        if (Array.isArray(exercise.options) && exercise.options.length) {
            exercise.options.forEach(option => { const label=document.createElement('label'); label.className='practice-option'; const input=document.createElement('input'); input.type='radio'; input.name='v24answer'; input.value=String(option); label.append(input, document.createTextNode(` ${option}`)); area.append(label); });
        } else {
            const input=document.createElement('input'); input.id='answerInput'; input.type='text'; input.autocomplete='off'; input.addEventListener('keydown', event => { if(event.key==='Enter' && !answerInProgress && !$('checkBtn')?.classList.contains('hidden')) check(); }); area.append(input); setTimeout(()=>input.focus(),0);
        }
        if ($('feedbackArea')) { $('feedbackArea').innerHTML=''; $('feedbackArea').className=''; }
        $('checkBtn')?.classList.remove('hidden'); $('checkBtn')?.removeAttribute('disabled'); $('nextBtn')?.classList.add('hidden'); $('nextBtn')?.removeAttribute('disabled');
        setPracticeProgress(app.practice.getState?.() || {});
    }

    function answerValue() { return document.querySelector('#answerArea input[type=radio]:checked')?.value || $('answerInput')?.value || ''; }

    async function check() {
        if (answerInProgress) return;
        const value = answerValue().trim(); if (!value) return;
        answerInProgress = true; $('checkBtn')?.setAttribute('disabled','disabled');
        try {
            const result = await app.practice.answer(value), feedback = result.feedback || {}, area = $('feedbackArea');
            const expected = feedback.expected || result.question?.exercise?.correctAnswer || result.question?.exercise?.answer || '';
            const mastery = Number.isFinite(Number(result.mastery)) ? Number(result.mastery) : Number(feedback.mastery) || 0;
            if (area) {
                area.className = `feedback ${feedback.correct ? 'correct' : 'wrong'}`;
                if (feedback.correct) area.innerHTML = `<strong>✓ Correct!</strong><div>Accepted answer: ${escapeHtml(expected)}</div>`;
                else if (feedback.almost) area.innerHTML = `<strong>≈ Not quite</strong><div>Your answer is close, but needs more precision.</div><div>Accepted answer: ${escapeHtml(expected)}</div>`;
                else area.innerHTML = `<strong>✗ Incorrect</strong><div>Accepted answer: ${escapeHtml(expected)}</div>`;
            }
            showMastery(mastery); $('checkBtn')?.classList.add('hidden'); $('nextBtn')?.classList.remove('hidden'); $('nextBtn')?.removeAttribute('disabled'); document.querySelectorAll('#answerArea input').forEach(input => input.disabled=true); setPracticeProgress(result.state || app.practice.getState?.() || {});
        } finally { answerInProgress=false; }
    }

    function escapeHtml(value) { const div=document.createElement('div'); div.textContent=String(value??''); return div.innerHTML; }

    async function next() {
        if (answerInProgress) return; $('nextBtn')?.setAttribute('disabled','disabled');
        try {
            const result=await app.practice.next();
            if(result.completed){ const state=result.state||{}; nav('complete'); setText('sessionScore', `${Number(state.correctCount)||0} / ${Number(state.answerCount)||0} Correct`); return; }
            renderQuestion(result.question);
        } catch(error) { console.error(error); $('nextBtn')?.removeAttribute('disabled'); if($('feedbackArea'))$('feedbackArea').textContent=error?.message||'Could not continue.'; }
    }

    function exitPractice(){ app.practice.reset?.(); if($('feedbackArea')){$('feedbackArea').innerHTML='';$('feedbackArea').className='';} if($('answerArea'))$('answerArea').innerHTML=''; $('practiceMastery')?.classList.add('hidden'); setText('sessionCounter','0/0'); if($('sessionProgressFill'))$('sessionProgressFill').style.width='0%'; nav('home'); }

    function bind(){
        $('dashboardBtn')?.addEventListener('click',()=>nav('dashboard')); $('packsBtn')?.addEventListener('click',()=>nav('packs')); $('historyBtn')?.addEventListener('click',()=>nav('history')); $('settingsBtn')?.addEventListener('click',()=>nav('settings')); document.querySelectorAll('.backBtn').forEach(button=>button.addEventListener('click',()=>nav('home')));
        $('quickPracticeBtn')?.addEventListener('click',startPractice); $('practiceSetupBtn')?.addEventListener('click',()=>$('practiceModal')?.classList.remove('hidden')); $('closePracticeModal')?.addEventListener('click',()=>$('practiceModal')?.classList.add('hidden')); $('startPracticeBtn')?.addEventListener('click',startPractice); $('checkBtn')?.addEventListener('click',check); $('nextBtn')?.addEventListener('click',next); $('exitPracticeBtn')?.addEventListener('click',exitPractice); $('backDashboardBtn')?.addEventListener('click',()=>{app.practice.reset?.();nav('dashboard');}); $('practiceAgainBtn')?.addEventListener('click',startPractice);
        document.querySelectorAll('.countPreset').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.countPreset').forEach(x=>x.classList.remove('active'));button.classList.add('active');if($('customQuestionCount'))$('customQuestionCount').value='';}));
        renderDashboard();
    }
    window.DutchTrainerUI={nav,renderDashboard,renderPacks,renderHistory,startPractice};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
