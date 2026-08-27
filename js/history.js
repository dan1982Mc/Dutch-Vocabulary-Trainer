/* Dutch Vocabulary Trainer V2.3 - consolidated practice history */
(function(){
    'use strict';

    const LEGACY_KEY = 'v2.practiceHistory';
    let historyRows = [];
    let ready = false;

    function resultLabel(result){
        return result === 'almost' || result === 'not_quite' ? 'almost' : result === 'correct' ? 'correct' : 'incorrect';
    }

    function sessionRows(session){
        const results = Array.isArray(session?.results) ? session.results : [];
        return results.map((r, index) => ({
            date: r.answeredAt || session.completedAt || session.startedAt || new Date().toISOString(),
            word: r.word || '',
            wordId: r.wordId || '',
            packId: r.packId || '',
            level: r.level || '',
            type: r.type || session.exerciseType || '',
            result: resultLabel(r.outcome),
            correct: !!r.correct,
            almost: !!r.almost,
            masteryBefore: r.masteryBefore ?? 0,
            masteryAfter: r.masteryAfter ?? r.mastery ?? 0,
            masteryDelta: r.masteryDelta ?? 0,
            mastery: r.masteryAfter ?? r.mastery ?? 0,
            sessionId: session.sessionId || '',
            resultIndex: index
        }));
    }

    async function load(){
        try {
            const sessions = typeof getSessions === 'function' ? await getSessions() : [];
            historyRows = (Array.isArray(sessions) ? sessions.flatMap(sessionRows) : [])
                .sort((a,b)=>new Date(b.date)-new Date(a.date));
            ready = true;
            return historyRows;
        } catch(error){
            console.error('Could not load practice history:', error);
            historyRows = [];
            ready = false;
            return historyRows;
        }
    }

    async function initialize(){
        if(typeof initDatabase === 'function'){
            try { await initDatabase(); } catch(error) { console.warn('History database initialization failed:', error); }
        }
        await load();
    }

    function getRows(){ return historyRows.slice(); }
    function isReady(){ return ready; }

    /*
       ui.js V2.2 still contains a small legacy history adapter. Keep its
       public contract temporarily, but make IndexedDB sessions the source
       of truth so practice history is no longer stored in localStorage.
    */
    try {
        const proto = Storage.prototype;
        const originalGetItem = proto.getItem;
        const originalSetItem = proto.setItem;
        proto.getItem = function(key){
            if(key === LEGACY_KEY){
                try { return JSON.stringify(historyRows); } catch(_) { return '[]'; }
            }
            return originalGetItem.call(this,key);
        };
        proto.setItem = function(key,value){
            if(key === LEGACY_KEY) return;
            return originalSetItem.call(this,key,value);
        };
    } catch(error){
        console.warn('Could not install history compatibility adapter:', error);
    }

    window.DutchTrainerHistory = { initialize, load, getRows, isReady };
    window.addEventListener('app-ready', ()=>load());
    window.addEventListener('practice-complete', ()=>load());
    initialize();
})();
