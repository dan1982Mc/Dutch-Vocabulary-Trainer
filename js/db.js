'use strict';

// Dutch Vocabulary Trainer V2.4 Stable Core — persistence layer.
// IndexedDB remains schema 3. This module adds the clean DutchTrainer.db API
// while keeping the existing V2.3 exports temporarily available during rebuild.

const DutchTrainerDB = window.DutchTrainer || (window.DutchTrainer = {});
DutchTrainerDB.db = DutchTrainerDB.db || {};

const DB_NAME = 'DutchVocabularyTrainer';
const DB_VERSION = 3;
const STORES = {
    vocabulary: 'vocabulary',
    packs: 'packs',
    sessions: 'sessions',
    settings: 'settings'
};

let db = null;

function requestPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function createStores(database) {
    if (!database.objectStoreNames.contains(STORES.vocabulary)) {
        const store = database.createObjectStore(STORES.vocabulary, { keyPath: 'id' });
        store.createIndex('packId', 'packId', { unique: false });
        store.createIndex('mastery', 'mastery', { unique: false });
        store.createIndex('nextReview', 'nextReview', { unique: false });
        store.createIndex('isNew', 'isNew', { unique: false });
    }

    if (!database.objectStoreNames.contains(STORES.packs)) {
        const store = database.createObjectStore(STORES.packs, { keyPath: 'packId' });
        store.createIndex('name', 'name', { unique: false });
    }

    if (!database.objectStoreNames.contains(STORES.sessions)) {
        database.createObjectStore(STORES.sessions, { keyPath: 'sessionId' });
    }

    if (!database.objectStoreNames.contains(STORES.settings)) {
        database.createObjectStore(STORES.settings, { keyPath: 'key' });
    }
}

function normalizeWord(word) {
    const value = { ...(word || {}) };

    if (!value.id) {
        throw new Error('Vocabulary item is missing id.');
    }

    value.packId = String(value.packId || 'legacy');
    value.mastery = Number.isFinite(Number(value.mastery))
        ? Number(value.mastery)
        : Number(value.masteryScore) || 0;
    value.isNew = value.isNew === undefined
        ? value.mastery <= 0
        : Boolean(value.isNew);
    value.nextReview = value.nextReview || value.dueAt || Date.now();
    value.stats = {
        correct: 0,
        incorrect: 0,
        meaning: 0,
        recall: 0,
        fill: 0,
        choose: 0,
        production: 0,
        ...(value.stats || {})
    };
    value.history = Array.isArray(value.history) ? value.history : [];
    value.schemaVersion = 3;

    return value;
}

function migrateVocabulary(transaction) {
    const store = transaction.objectStore(STORES.vocabulary);

    store.openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) return;

        try {
            cursor.update(normalizeWord(cursor.value));
        } catch (error) {
            console.warn('Skipping invalid vocabulary item during migration', error);
        }

        cursor.continue();
    };
}

function migrateSessions(transaction) {
    const store = transaction.objectStore(STORES.sessions);

    store.openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) return;

        const session = {
            ...cursor.value,
            schemaVersion: 3
        };

        if (!session.sessionId) {
            session.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        if (!Array.isArray(session.results)) {
            session.results = [];
        }

        if (!session.startedAt) {
            session.startedAt = session.startTime || Date.now();
        }

        cursor.update(session);
        cursor.continue();
    };
}

async function initDatabase() {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onblocked = () => {
            console.warn('Database upgrade blocked by another open tab.');
        };

        request.onupgradeneeded = event => {
            const database = event.target.result;
            const transaction = event.target.transaction;
            const oldVersion = event.oldVersion;

            createStores(database);

            if (oldVersion < 3) {
                migrateVocabulary(transaction);
                migrateSessions(transaction);
            }
        };

        request.onsuccess = () => {
            db = request.result;
            db.onversionchange = () => {
                db.close();
                db = null;
            };
            resolve(db);
        };
    });
}

function transaction(storeName, mode = 'readonly') {
    if (!db) {
        throw new Error('Database is not initialized.');
    }

    return db.transaction(storeName, mode).objectStore(storeName);
}

async function getWord(id) {
    return requestPromise(transaction(STORES.vocabulary).get(id));
}

async function saveWord(word) {
    return requestPromise(
        transaction(STORES.vocabulary, 'readwrite').put(normalizeWord(word))
    );
}

async function saveWords(words) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.vocabulary, 'readwrite');
        const store = tx.objectStore(STORES.vocabulary);

        try {
            (words || []).forEach(word => store.put(normalizeWord(word)));
        } catch (error) {
            tx.abort();
            reject(error);
            return;
        }

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Vocabulary transaction aborted.'));
    });
}

async function getAllWords() {
    return requestPromise(transaction(STORES.vocabulary).getAll());
}

async function deleteWord(id) {
    return requestPromise(transaction(STORES.vocabulary, 'readwrite').delete(id));
}

async function savePackRecord(pack) {
    return requestPromise(
        transaction(STORES.packs, 'readwrite').put({ ...pack, schemaVersion: 3 })
    );
}

async function getPackRecord(packId) {
    return requestPromise(transaction(STORES.packs).get(packId));
}

async function getAllPackRecords() {
    return requestPromise(transaction(STORES.packs).getAll());
}

async function deletePackRecord(packId) {
    return requestPromise(transaction(STORES.packs, 'readwrite').delete(packId));
}

async function setSetting(key, value) {
    return requestPromise(
        transaction(STORES.settings, 'readwrite').put({ key, value, schemaVersion: 3 })
    );
}

async function getSetting(key, fallback = null) {
    const result = await requestPromise(transaction(STORES.settings).get(key));
    return result ? result.value : fallback;
}

async function saveSession(session) {
    return requestPromise(
        transaction(STORES.sessions, 'readwrite').put({ ...session, schemaVersion: 3 })
    );
}

async function getSessions() {
    return requestPromise(transaction(STORES.sessions).getAll());
}

async function deleteSession(sessionId) {
    return requestPromise(transaction(STORES.sessions, 'readwrite').delete(sessionId));
}

async function exportDatabaseData() {
    return {
        exportVersion: 3,
        appVersion: window.DutchTrainerVersion?.app || '2.4.0',
        exportedAt: new Date().toISOString(),
        vocabulary: await getAllWords(),
        packs: await getAllPackRecords(),
        sessions: await getSessions(),
        settings: {
            practiceSettings: await getSetting('practiceSettings', null),
            uiSettings: await getSetting('uiSettings', null)
        }
    };
}

async function importDatabaseData(snapshot, { replace = false } = {}) {
    if (!snapshot || typeof snapshot !== 'object') {
        throw new Error('Invalid backup file.');
    }

    if (!Array.isArray(snapshot.vocabulary) || !Array.isArray(snapshot.packs)) {
        throw new Error('Backup is missing vocabulary or pack data.');
    }

    if (replace) {
        const tx = db.transaction(
            [STORES.vocabulary, STORES.packs, STORES.sessions],
            'readwrite'
        );

        tx.objectStore(STORES.vocabulary).clear();
        tx.objectStore(STORES.packs).clear();
        tx.objectStore(STORES.sessions).clear();

        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Restore transaction aborted.'));
        });
    }

    await saveWords(snapshot.vocabulary);

    for (const pack of snapshot.packs) {
        await savePackRecord(pack);
    }

    for (const session of snapshot.sessions || []) {
        await saveSession(session);
    }

    if (snapshot.settings?.practiceSettings !== undefined) {
        await setSetting('practiceSettings', snapshot.settings.practiceSettings);
    }

    if (snapshot.settings?.uiSettings !== undefined) {
        await setSetting('uiSettings', snapshot.settings.uiSettings);
    }

    return {
        words: snapshot.vocabulary.length,
        packs: snapshot.packs.length,
        sessions: (snapshot.sessions || []).length
    };
}

async function calculatePackStats(packId) {
    const words = (await getAllWords()).filter(
        word => String(word.packId || '') === String(packId)
    );

    const total = words.length;

    return {
        total,
        learned: words.filter(word => Number(word.mastery ?? 0) >= 90).length,
        weak: words.filter(word => {
            const mastery = Number(word.mastery ?? 0);
            return mastery > 0 && mastery < 40;
        }).length,
        due: words.filter(word => {
            const date = word.dueAt ?? word.nextReview;
            return date && new Date(date).getTime() <= Date.now();
        }).length,
        new: words.filter(word => word.isNew === true).length,
        averageMastery: total
            ? Math.round(words.reduce((sum, word) => sum + Number(word.mastery ?? 0), 0) / total)
            : 0
    };
}

// Clean V2.4 persistence API.
DutchTrainerDB.db.init = initDatabase;
DutchTrainerDB.db.getWord = getWord;
DutchTrainerDB.db.getWords = getAllWords;
DutchTrainerDB.db.saveWord = saveWord;
DutchTrainerDB.db.saveWords = saveWords;
DutchTrainerDB.db.deleteWord = deleteWord;
DutchTrainerDB.db.getPack = getPackRecord;
DutchTrainerDB.db.getPacks = getAllPackRecords;
DutchTrainerDB.db.savePack = savePackRecord;
DutchTrainerDB.db.deletePack = deletePackRecord;
DutchTrainerDB.db.getSetting = getSetting;
DutchTrainerDB.db.setSetting = setSetting;
DutchTrainerDB.db.saveSession = saveSession;
DutchTrainerDB.db.getSessions = getSessions;
DutchTrainerDB.db.deleteSession = deleteSession;
DutchTrainerDB.db.export = exportDatabaseData;
DutchTrainerDB.db.import = importDatabaseData;
DutchTrainerDB.db.calculatePackStats = calculatePackStats;
DutchTrainerDB.db.version = DB_VERSION;

// Existing V2.3 exports remain temporarily available while the remaining
// modules are moved to the V2.4 API. They are deliberately not used by the
// new modules once migration of each module is complete.
window.initDatabase = initDatabase;
window.initializeDB = initDatabase;
window.getWord = getWord;
window.saveWord = saveWord;
window.saveWords = saveWords;
window.getAllWords = getAllWords;
window.deleteWord = deleteWord;
window.savePackRecord = savePackRecord;
window.getPackRecord = getPackRecord;
window.getAllPackRecords = getAllPackRecords;
window.deletePackRecord = deletePackRecord;
window.setSetting = setSetting;
window.getSetting = getSetting;
window.saveSession = saveSession;
window.getSessions = getSessions;
window.deleteSession = deleteSession;
window.DutchTrainerHistory = { getSessions };
window.calculatePackStats = calculatePackStats;
window.exportDatabaseData = exportDatabaseData;
window.importDatabaseData = importDatabaseData;
window.DutchTrainerDB = {
    init: initDatabase,
    export: exportDatabaseData,
    import: importDatabaseData,
    version: DB_VERSION
};
window.DutchTrainerDatabaseReady = initDatabase();
