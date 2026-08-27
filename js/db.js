/* Dutch Vocabulary Trainer V2.3 - IndexedDB layer and schema migration. */
(function(){'use strict';
const DB_NAME='DutchVocabularyTrainer';
const DB_VERSION=3;
const STORES={vocabulary:'vocabulary',packs:'packs',sessions:'sessions',settings:'settings'};
let db=null;
function requestPromise(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function createStores(database){if(!database.objectStoreNames.contains(STORES.vocabulary)){const s=database.createObjectStore(STORES.vocabulary,{keyPath:'id'});s.createIndex('packId','packId',{unique:false});s.createIndex('mastery','mastery',{unique:false});s.createIndex('nextReview','nextReview',{unique:false});s.createIndex('isNew','isNew',{unique:false});}if(!database.objectStoreNames.contains(STORES.packs)){const s=database.createObjectStore(STORES.packs,{keyPath:'packId'});s.createIndex('name','name',{unique:false});}if(!database.objectStoreNames.contains(STORES.sessions))database.createObjectStore(STORES.sessions,{keyPath:'sessionId'});if(!database.objectStoreNames.contains(STORES.settings))database.createObjectStore(STORES.settings,{keyPath:'key'});}
function normalizeWord(word){const w={...(word||{})};if(!w.id)throw new Error('Vocabulary item is missing id.');w.packId=String(w.packId||'legacy');w.mastery=Number.isFinite(Number(w.mastery))?Number(w.mastery):Number(w.masteryScore)||0;w.isNew=w.isNew===undefined?w.mastery<=0:Boolean(w.isNew);w.nextReview=w.nextReview||w.dueAt||Date.now();w.stats={correct:0,incorrect:0,meaning:0,recall:0,fill:0,choose:0,production:0,...(w.stats||{})};w.history=Array.isArray(w.history)?w.history:[];w.schemaVersion=3;return w;}
function migrateVocabulary(tx){const s=tx.objectStore(STORES.vocabulary);s.openCursor().onsuccess=e=>{const c=e.target.result;if(!c)return;try{c.update(normalizeWord(c.value));}catch(err){console.warn('Skipping invalid vocabulary item during migration',err);}c.continue();};}
function migrateSessions(tx){const s=tx.objectStore(STORES.sessions);s.openCursor().onsuccess=e=>{const c=e.target.result;if(!c)return;const session={...c.value,schemaVersion:3};if(!session.sessionId)session.sessionId=`session-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;if(!Array.isArray(session.results))session.results=[];if(!session.startedAt)session.startedAt=session.startTime||Date.now();c.update(session);c.continue();};}
async function initDatabase(){return new Promise((resolve,reject)=>{if(db){resolve(db);return;}const request=indexedDB.open(DB_NAME,DB_VERSION);request.onerror=()=>reject(request.error);request.onblocked=()=>console.warn('Database upgrade blocked by another open tab.');request.onsuccess=()=>{db=request.result;db.onversionchange=()=>{db.close();db=null;};resolve(db);};request.onupgradeneeded=e=>{const database=e.target.result;const tx=e.target.transaction;const old=e.oldVersion;createStores(database);if(old<3){migrateVocabulary(tx);migrateSessions(tx);}};});}
function transaction(storeName,mode='readonly'){if(!db)throw new Error('Database is not initialized.');return db.transaction(storeName,mode).objectStore(storeName);}
async function getWord(id){return requestPromise(transaction(STORES.vocabulary).get(id));}
async function saveWord(word){return requestPromise(transaction(STORES.vocabulary,'readwrite').put(normalizeWord(word)));}
async function saveWords(words){return new Promise((resolve,reject)=>{const tx=db.transaction(STORES.vocabulary,'readwrite');const s=tx.objectStore(STORES.vocabulary);try{(words||[]).forEach(w=>s.put(normalizeWord(w)));}catch(e){tx.abort();reject(e);return;}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Vocabulary transaction aborted.'));});}
async function getAllWords(){return requestPromise(transaction(STORES.vocabulary).getAll());}
async function deleteWord(id){return requestPromise(transaction(STORES.vocabulary,'readwrite').delete(id));}
async function savePackRecord(pack){return requestPromise(transaction(STORES.packs,'readwrite').put({...pack,schemaVersion:3}));}
async function getPackRecord(packId){return requestPromise(transaction(STORES.packs).get(packId));}
async function getAllPackRecords(){return requestPromise(transaction(STORES.packs).getAll());}
async function deletePackRecord(packId){return requestPromise(transaction(STORES.packs,'readwrite').delete(packId));}
async function setSetting(key,value){return requestPromise(transaction(STORES.settings,'readwrite').put({key,value,schemaVersion:3}));}
async function getSetting(key,fallback=null){const r=await requestPromise(transaction(STORES.settings).get(key));return r?r.value:fallback;}
async function saveSession(session){return requestPromise(transaction(STORES.sessions,'readwrite').put({...session,schemaVersion:3}));}
async function getSessions(){return requestPromise(transaction(STORES.sessions).getAll());}
async function deleteSession(sessionId){return requestPromise(transaction(STORES.sessions,'readwrite').delete(sessionId));}
async function exportDatabaseData(){return{exportVersion:3,appVersion:window.DutchTrainerVersion?.app||'2.3.0',exportedAt:new Date().toISOString(),vocabulary:await getAllWords(),packs:await getAllPackRecords(),sessions:await getSessions(),settings:{practiceSettings:await getSetting('practiceSettings',null),uiSettings:await getSetting('uiSettings',null)}};}
async function importDatabaseData(snapshot,{replace=false}={}){if(!snapshot||typeof snapshot!=='object')throw new Error('Invalid backup file.');if(!Array.isArray(snapshot.vocabulary)||!Array.isArray(snapshot.packs))throw new Error('Backup is missing vocabulary or pack data.');if(replace){const tx=db.transaction([STORES.vocabulary,STORES.packs,STORES.sessions],'readwrite');tx.objectStore(STORES.vocabulary).clear();tx.objectStore(STORES.packs).clear();tx.objectStore(STORES.sessions).clear();await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});}await saveWords(snapshot.vocabulary);for(const p of snapshot.packs)await savePackRecord(p);for(const s of(snapshot.sessions||[]))await saveSession(s);if(snapshot.settings?.practiceSettings!==undefined)await setSetting('practiceSettings',snapshot.settings.practiceSettings);if(snapshot.settings?.uiSettings!==undefined)await setSetting('uiSettings',snapshot.settings.uiSettings);return{words:snapshot.vocabulary.length,packs:snapshot.packs.length,sessions:(snapshot.sessions||[]).length};}
async function calculatePackStats(packId){const words=(await getAllWords()).filter(w=>String(w.packId||'')===String(packId));const total=words.length;return{total,learned:words.filter(w=>Number(w.mastery??0)>=90).length,weak:words.filter(w=>Number(w.mastery??0)>0&&Number(w.mastery??0)<40).length,due:words.filter(w=>{const d=w.dueAt??w.nextReview;return d&&new Date(d).getTime()<=Date.now();}).length,new:words.filter(w=>w.isNew===true).length,averageMastery:total?Math.round(words.reduce((s,w)=>s+Number(w.mastery??0),0)/total):0};}
async function initializeDB(){return initDatabase();}
window.initDatabase=initDatabase;
window.initializeDB=initializeDB;
window.getWord=getWord;
window.saveWord=saveWord;
window.saveWords=saveWords;
window.getAllWords=getAllWords;
window.deleteWord=deleteWord;
window.savePackRecord=savePackRecord;
window.getPackRecord=getPackRecord;
window.getAllPackRecords=getAllPackRecords;
window.deletePackRecord=deletePackRecord;
window.setSetting=setSetting;
window.getSetting=getSetting;
window.saveSession=saveSession;
window.getSessions=getSessions;
window.deleteSession=deleteSession;
window.DutchTrainerHistory={getSessions};
window.calculatePackStats=calculatePackStats;
window.exportDatabaseData=exportDatabaseData;
window.importDatabaseData=importDatabaseData;
window.DutchTrainerDB={init:initDatabase,export:exportDatabaseData,import:importDatabaseData,version:DB_VERSION};
window.DutchTrainerDatabaseReady=initDatabase();
})();
