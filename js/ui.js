/* Architecture A UI */
(function () {
  function qs(id) { return document.getElementById(id); }
  function show(id) { document.querySelectorAll('.screen').forEach(function (e) { e.classList.remove('active'); }); var e = qs(id); if (e) e.classList.add('active'); }
  function hide(id) { var e = qs(id); if (e) e.classList.add('hidden'); }
  function unhide(id) { var e = qs(id); if (e) e.classList.remove('hidden'); }
  function navigateTo(name) {
    var map = { home: 'homeScreen', dashboard: 'dashboardScreen', practice: 'practiceScreen', complete: 'completeScreen' };
    show(map[name] || name);
    if (name === 'dashboard' && window.DutchTrainerDashboard) window.DutchTrainerDashboard.render().catch(console.error);
  }
  function openModal(id) { unhide(id); }
  function closeModal(id) { hide(id); }
  function selectedAnswer() {
    var input = qs('answerInput');
    if (input) return input.value;
    var checked = document.querySelector('#answerArea input[type="radio"]:checked');
    return checked ? checked.value : '';
  }
  function renderQuestion(q) {
    if (!q) return;
    qs('practiceTitle').textContent = 'Practice';
    qs('exerciseBadge').textContent = q.type || 'Practice';
    qs('questionPrompt').textContent = q.exercise?.prompt || q.exercise?.question || q.exercise?.instruction || q.word?.word || '';
    qs('questionContext').textContent = q.exercise?.context || q.exercise?.sentence || q.exercise?.meaning || '';
    var area = qs('answerArea'); area.innerHTML = '';
    if (q.exercise?.options && Array.isArray(q.exercise.options)) {
      q.exercise.options.forEach(function (option) { var label=document.createElement('label'); label.className='choice-option'; label.innerHTML='<input type="radio" name="practiceChoice"> <span></span>'; label.querySelector('input').value=option; label.querySelector('span').textContent=option; area.appendChild(label); });
    } else { var input=document.createElement('input'); input.id='answerInput'; input.type='text'; input.autocomplete='off'; input.placeholder='Type your answer'; area.appendChild(input); input.focus(); }
    qs('feedbackArea').textContent=''; qs('checkBtn').classList.remove('hidden'); qs('nextBtn').classList.add('hidden');
    var state=window.DutchTrainerPractice?.getState(); qs('sessionCounter').textContent=((state?.currentIndex||0)+1)+'/'+(state?.questions?.length||0); qs('sessionProgressFill').style.width=((state?.questions?.length?(state.currentIndex/state.questions.length)*100:0))+'%';
  }
  async function start(options) { try { var r=await window.DutchTrainerPractice.startPractice(options||{}); if(!r.success){alert('No vocabulary available for this practice selection.');return;} navigateTo('practice'); renderQuestion(r.question); } catch(e){console.error(e);alert('Could not start practice: '+e.message);} }
  async function quickPractice(){
    var words=await getSelectedVocabulary();
    var pool=words;
    if(window.DutchTrainerSelection?.selectDueVocabulary) { try { var due=await window.DutchTrainerSelection.selectDueVocabulary(); if(due.length) pool=due; } catch(_){} }
    return start({mode:'start',questionCount:10,exerciseType:'mixed',vocabulary:pool});
  }
  async function submit(){ try { var r=await window.DutchTrainerPractice.checkAnswer(selectedAnswer()); if(!r.success){ if(r.reason==='empty-answer') return; return; } qs('feedbackArea').textContent=r.feedback.correct?'Correct!':'Not quite. Answer: '+(r.feedback.correctAnswer||''); qs('checkBtn').classList.add('hidden'); qs('nextBtn').classList.remove('hidden'); }catch(e){console.error(e);alert('Could not check answer: '+e.message);} }
  function next(){ var r=window.DutchTrainerPractice.nextQuestion(); if(r.completed){ renderComplete(r.state); return; } renderQuestion(r.question); }
  function renderComplete(s){ navigateTo('complete'); var total=s.answerCount||0, pct=total?Math.round(s.correctCount/total*100):0; qs('sessionScore').textContent=s.correctCount+' / '+total+' correct ('+pct+'%)'; qs('sessionSummary').textContent='Practice session completed.'; }
  async function loadPacks(){ var sel=qs('packSelector'); if(!sel||!window.DutchTrainerPacks)return; try{var packs=await window.DutchTrainerPacks.getAllPacks(); sel.innerHTML='<option value="all">All Packs</option>'; packs.forEach(function(p){var o=document.createElement('option');o.value=p.packId;o.textContent=p.name;sel.appendChild(o);});}catch(e){console.error(e);} }
  function bind(){
    qs('quickPracticeBtn')?.addEventListener('click',quickPractice);
    qs('practiceSetupBtn')?.addEventListener('click',function(){openModal('practiceModal');loadPacks();});
    qs('closePracticeModal')?.addEventListener('click',function(){closeModal('practiceModal');});
    qs('startPracticeBtn')?.addEventListener('click',async function(){var count=Number(qs('customQuestionCount')?.value)||Number(document.querySelector('.countPreset.active')?.dataset.value)||20;var filter=qs('vocabularyFilter')?.value||'all';var pack=qs('packSelector')?.value||'all';var words=await getSelectedVocabulary();if(filter==='new'&&window.DutchTrainerSelection?.selectNewVocabulary)words=await window.DutchTrainerSelection.selectNewVocabulary();else if(filter==='weak'&&window.DutchTrainerSelection?.selectWeakVocabulary)words=await window.DutchTrainerSelection.selectWeakVocabulary();else if(filter==='due'&&window.DutchTrainerSelection?.selectDueVocabulary)words=await window.DutchTrainerSelection.selectDueVocabulary();else if(filter==='pack'&&pack!=='all'&&window.DutchTrainerSelection?.selectVocabularyPack)words=await window.DutchTrainerSelection.selectVocabularyPack(pack);closeModal('practiceModal');start({questionCount:count,exerciseType:qs('exerciseType')?.value||'meaning',vocabulary:words,mode:'full'});});
    document.querySelectorAll('.countPreset').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.countPreset').forEach(x=>x.classList.remove('active'));b.classList.add('active');});});
    qs('dashboardBtn')?.addEventListener('click',function(){navigateTo('dashboard');});
    qs('packsBtn')?.addEventListener('click',function(){alert('Word Packs are managed by the V2 pack/import layer.');});
    qs('historyBtn')?.addEventListener('click',function(){alert('History is currently available through practice results.');});
    qs('settingsBtn')?.addEventListener('click',function(){alert('Settings are stored by storage.js.');});
    document.querySelectorAll('.backBtn').forEach(function(b){b.addEventListener('click',function(){navigateTo('home');});});
    qs('exitPracticeBtn')?.addEventListener('click',function(){navigateTo('home');});
    qs('checkBtn')?.addEventListener('click',submit); qs('nextBtn')?.addEventListener('click',next);
    qs('practiceAgainBtn')?.addEventListener('click',function(){navigateTo('home');openModal('practiceModal');}); qs('backDashboardBtn')?.addEventListener('click',function(){navigateTo('dashboard');});
    document.addEventListener('keydown',function(e){if(e.key==='Enter'&&qs('practiceScreen')?.classList.contains('active')){e.preventDefault();if(!qs('checkBtn').classList.contains('hidden'))submit();else next();}});
  }
  function initializeUI(){bind();}
  window.navigateTo=navigateTo; window.initializeUI=initializeUI; window.DutchTrainerUI={navigateTo,initialize:initializeUI,renderQuestion};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeUI,{once:true});else initializeUI();
})();
