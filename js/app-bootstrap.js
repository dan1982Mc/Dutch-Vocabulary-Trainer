/* Dutch Vocabulary Trainer V2.3 application bootstrap. */
(function(){'use strict';
const APP_VERSION=window.DutchTrainerVersion?.app||window.DUTCH_TRAINER_VERSION||'2.3.0';
const AppState={version:APP_VERSION,initialized:false,initializing:false,currentView:'home',previousView:null,practiceSession:null,vocabularySelection:null,statistics:null,lastError:null};
function dispatch(name,detail={}){window.dispatchEvent(new CustomEvent(name,{detail:{...detail,appVersion:APP_VERSION}}))}
function fail(e,c){AppState.lastError={context:c,message:e?.message||String(e)};console.error(c,e);dispatch('app-error',{error:AppState.lastError});throw e}
async function initialize(){if(AppState.initialized||AppState.initializing)return AppState;AppState.initializing=true;try{if(typeof initDatabase==='function')await initDatabase();if(typeof initializeStorage==='function')await initializeStorage();await window.DutchTrainerPacks.ensureDefaultPack();window.DutchTrainerV2VocabularyPool=await getAllWords();AppState.vocabularySelection=getVocabularySelection();if(typeof recalculateAllMasteryStates==='function')await recalculateAllMasteryStates();if(typeof initializeScheduler==='function')await initializeScheduler();if(typeof initializeImport==='function')await initializeImport();if(typeof initializeDashboard==='function')await initializeDashboard();if(typeof initializePractice==='function')initializePractice();if(typeof initializeUI==='function')initializeUI();AppState.initialized=true;dispatch('app-ready',{state:AppState});return AppState}catch(e){return fail(e,'Application initialization')}finally{AppState.initializing=false}}
async function vocabulary(){return getAllWords()}
async function selectedVocabulary(){return getSelectedVocabulary()}
async function changeSelection(source,packId=null){const a={all:selectAllVocabulary,pack:()=>selectVocabularyPack(packId),new:selectNewVocabulary,weak:selectWeakVocabulary,due:selectDueVocabulary};if(a[source])await a[source]();AppState.vocabularySelection=getVocabularySelection();dispatch('app-selection-changed',{selection:AppState.vocabularySelection});return AppState.vocabularySelection}
async function startQuickPractice(options={}){const type=options.exerciseType??await getSetting('practice.exerciseType','meaning');const count=Number(options.questionCount??await getSetting('practice.questionCount',20));const words=await selectedVocabulary();const session=await DutchTrainerPractice.startPractice({mode:'start',exerciseType:type,questionCount:count,vocabulary:words});AppState.practiceSession=session;if(session?.success)navigateTo('practice');return session}
async function startConfiguredPractice(){const type=document.getElementById('exerciseType')?.value||await getSetting('practice.exerciseType','meaning');const custom=document.getElementById('customQuestionCount')?.value;const preset=document.querySelector('.countPreset.active')?.dataset.value;const count=Math.max(1,Number(custom||preset||await getSetting('practice.questionCount',20)));const filter=document.getElementById('vocabularyFilter')?.value||'all';const packId=document.getElementById('packSelector')?.value||'all';await changeSelection(filter,filter==='pack'?packId:null);const words=await getSelectedVocabulary();document.getElementById('practiceModal')?.classList.add('hidden');const session=await DutchTrainerPractice.startPractice({exerciseType:type,questionCount:count,mode:'full',vocabulary:words});AppState.practiceSession=session;if(session?.success)navigateTo('practice');return session}

/* History consolidation bridge: completed practice sessions in IndexedDB are
   now the source of truth. ui.js still references its legacy key, so redirect
   only that key without affecting any other localStorage setting. */
(function installHistoryBridge(){
    const key='v2.practiceHistory';
    let rows=[];
    const rebuild=async()=>{try{const sessions=typeof getSessions==='function'?await getSessions():[];rows=(Array.isArray(sessions)?sessions.flatMap(s=>(Array.isArray(s.results)?s.results:[]).map(r=>({date:r.answeredAt||s.completedAt||s.startedAt||new Date().toISOString(),word:r.word||'',wordId:r.wordId||'',packId:r.packId||'',level:r.level||'',type:r.type||s.exerciseType||'',result:r.outcome||'incorrect',correct:!!r.correct,almost:!!r.almost,masteryBefore:r.masteryBefore??0,masteryAfter:r.masteryAfter??r.mastery??0,masteryDelta:r.masteryDelta??0,mastery:r.masteryAfter??r.mastery??0}))) :[]).sort((a,b)=>new Date(b.date)-new Date(a.date));}catch(error){console.warn('Could not rebuild practice history view:',error)}};
    try{
        const proto=Storage.prototype,originalGet=proto.getItem,originalSet=proto.setItem;
        proto.getItem=function(k){if(k===key){try{return JSON.stringify(rows)}catch(_){return'[]'}}return originalGet.call(this,k)};
        proto.setItem=function(k,v){if(k===key)return;return originalSet.call(this,k,v)};
        window.DutchTrainerHistory={load:rebuild,getRows:()=>rows.slice()};
        window.addEventListener('app-ready',rebuild);
        window.addEventListener('practice-complete',()=>setTimeout(rebuild,100));
        rebuild();
    }catch(error){console.warn('Could not install history bridge:',error)}
})();

window.DutchTrainerApp={version:APP_VERSION,schemaVersion:window.DutchTrainerVersion?.schema||3,state:AppState,initialize,init:initialize,startQuickPractice,startConfiguredPractice,getVocabulary:vocabulary,getSelectedVocabulary:selectedVocabulary,changeSelection};window.startQuickPractice=startQuickPractice;window.startConfiguredPractice=startConfiguredPractice;window.addEventListener('DOMContentLoaded',()=>initialize().catch(()=>{}));
})();
