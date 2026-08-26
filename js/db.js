/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   IndexedDB Layer
========================================================= */
const DB_NAME = "DutchVocabularyTrainer";
const DB_VERSION = 2;
const STORES = { vocabulary: "vocabulary", packs: "packs", sessions: "sessions", settings: "settings" };
let db = null;
async function initDatabase() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onerror = () => reject(request.error); request.onsuccess = () => { db = request.result; resolve(db); }; request.onupgradeneeded = event => { const database = event.target.result; const tx = event.target.transaction; const oldVersion = event.oldVersion; createStores(database); if (oldVersion < 2) migrateVocabulary(tx); }; }); }
function createStores(database) { if (!database.objectStoreNames.contains(STORES.vocabulary)) { const s = database.createObjectStore(STORES.vocabulary, { keyPath: "id" }); s.createIndex("packId", "packId", { unique: false }); s.createIndex("mastery", "mastery", { unique: false }); s.createIndex("nextReview", "nextReview", { unique: false }); s.createIndex("isNew", "isNew", { unique: false }); } if (!database.objectStoreNames.contains(STORES.packs)) { const s = database.createObjectStore(STORES.packs, { keyPath: "packId" }); s.createIndex("name", "name"); } if (!database.objectStoreNames.contains(STORES.sessions)) database.createObjectStore(STORES.sessions, { keyPath: "sessionId" }); if (!database.objectStoreNames.contains(STORES.settings)) database.createObjectStore(STORES.settings, { keyPath: "key" }); }
function migrateVocabulary(tx) { const s = tx.objectStore(STORES.vocabulary); s.openCursor().onsuccess = event => { const cursor = event.target.result; if (!cursor) return; const word = cursor.value; let changed = false; if (!word.packId) { word.packId = "legacy"; changed = true; } if (!word.history) { word.history = []; changed = true; } if (!word.stats) { word.stats = { correct: 0, incorrect: 0, meaning: 0, recall: 0, fill: 0, choose: 0, production: 0 }; changed = true; } if (word.mastery === undefined) { word.mastery = 0; changed = true; } if (word.isNew === undefined) { word.isNew = true; changed = true; } if (!word.nextReview) { word.nextReview = Date.now(); changed = true; } if (changed) cursor.update(word); cursor.continue(); }; }
function transaction(storeName, mode = "readonly") { if (!db) throw new Error("Database is not initialized."); return db.transaction(storeName, mode).objectStore(storeName); }
function requestPromise(request) { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function getWord(id) { return requestPromise(transaction(STORES.vocabulary).get(id)); }
async function saveWord(word) { return requestPromise(transaction(STORES.vocabulary, "readwrite").put(word)); }
async function saveWords(words) { return new Promise((resolve, reject) => { const tx = db.transaction(STORES.vocabulary, "readwrite"); const s = tx.objectStore(STORES.vocabulary); words.forEach(w => s.put(w)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
async function getAllWords() { return requestPromise(transaction(STORES.vocabulary).getAll()); }
async function deleteWord(id) { return requestPromise(transaction(STORES.vocabulary, "readwrite").delete(id)); }
async function savePackRecord(pack) { return requestPromise(transaction(STORES.packs, "readwrite").put(pack)); }
async function getPackRecord(packId) { return requestPromise(transaction(STORES.packs).get(packId)); }
async function getAllPackRecords() { return requestPromise(transaction(STORES.packs).getAll()); }
async function deletePackRecord(packId) { return requestPromise(transaction(STORES.packs, "readwrite").delete(packId)); }
async function setSetting(key, value) { return requestPromise(transaction(STORES.settings, "readwrite").put({ key, value })); }
async function getSetting(key, fallback = null) { const result = await requestPromise(transaction(STORES.settings).get(key)); return result ? result.value : fallback; }
async function saveSession(session) { return requestPromise(transaction(STORES.sessions, "readwrite").put(session)); }
async function getSessions() { return requestPromise(transaction(STORES.sessions).getAll()); }
async function calculatePackStats(packId) { const words = await getAllWords(); const packWords = words.filter(w => w.packId === packId); const total = packWords.length; return { total, learned: packWords.filter(w => w.mastery >= 90).length, weak: packWords.filter(w => w.mastery > 0 && w.mastery < 40).length, due: packWords.filter(w => (w.nextReview || 0) <= Date.now()).length, new: packWords.filter(w => w.isNew).length, averageMastery: total ? Math.round(packWords.reduce((sum, w) => sum + (w.mastery || 0), 0) / total) : 0 }; }
async function ensureLegacyPack() { const existing = await getPackRecord("legacy"); if (existing) return existing; return savePackRecord({ packId: "legacy", name: "Legacy Vocabulary", version: 1, author: "V1.2 Migration", description: "Words imported before V2.0", importDate: new Date().toISOString(), wordCount: 0, tags: ["legacy"] }); }
async function initializeDB() { await initDatabase(); await ensureLegacyPack(); console.log("Dutch Vocabulary Trainer V2.0 database ready."); }
