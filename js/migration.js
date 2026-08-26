/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   V1.2 -> V2.0 Migration Layer
========================================================= */

const MIGRATION_VERSION = 2;
const MIGRATION_SETTING_KEY = "migrationVersion";
const LEGACY_PACK_ID = "legacy";
const LEGACY_PACK_NAME = "Legacy Vocabulary";

async function runMigrations() {
    console.log("Running Dutch Vocabulary Trainer migration check...");
    const currentVersion = Number(await getSetting(MIGRATION_SETTING_KEY, 0)) || 0;
    if (currentVersion < MIGRATION_VERSION) {
        await migrateV1ToV2();
        await setSetting(MIGRATION_SETTING_KEY, MIGRATION_VERSION);
        console.log("Dutch Vocabulary Trainer migration complete.");
    } else {
        await repairV2Data();
    }
}

function createDefaultStats() {
    return { correct: 0, incorrect: 0, meaning: 0, recall: 0, fill: 0, choose: 0, production: 0,
        meaningAttempts: 0, recallAttempts: 0, fillAttempts: 0, chooseAttempts: 0,
        productionAttempts: 0, lastPracticed: null };
}

function normalizeDateValue(value) {
    if (value == null || value === "") return Date.now();
    if (typeof value === "number") return value < 100000000000 ? value * 1000 : value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
}

function clampMastery(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function normalizeWordForV2(word) {
    let changed = false;
    if (!word.packId) { word.packId = LEGACY_PACK_ID; changed = true; }
    if (word.mastery == null || Number.isNaN(Number(word.mastery))) {
        word.mastery = word.masteryLevel != null ? Number(word.masteryLevel) :
            word.score != null ? Number(word.score) : 0;
        changed = true;
    }
    const mastery = clampMastery(word.mastery);
    if (mastery !== word.mastery) { word.mastery = mastery; changed = true; }
    if (word.isNew === undefined) {
        word.isNew = !(Array.isArray(word.history) && word.history.length) &&
            !(word.stats && (Number(word.stats.correct || 0) || Number(word.stats.incorrect || 0)));
        changed = true;
    }
    if (word.nextReview == null) {
        word.nextReview = normalizeDateValue(word.dueDate ?? word.due);
        changed = true;
    }
    if (!Array.isArray(word.history)) {
        word.history = Array.isArray(word.answerHistory) ? [...word.answerHistory] : [];
        changed = true;
    }
    if (!word.stats || typeof word.stats !== "object") {
        word.stats = createDefaultStats(); changed = true;
    } else {
        for (const [key, value] of Object.entries(createDefaultStats())) {
            if (word.stats[key] == null) { word.stats[key] = value; changed = true; }
        }
    }
    if (!word.createdAt) { word.createdAt = word.importDate || word.dateAdded || new Date().toISOString(); changed = true; }
    if (!word.updatedAt) { word.updatedAt = new Date().toISOString(); changed = true; }
    if (word.schemaVersion !== MIGRATION_VERSION) { word.schemaVersion = MIGRATION_VERSION; changed = true; }
    return changed;
}

async function ensureLegacyMigrationPack() {
    if (typeof ensureLegacyPack === "function") return ensureLegacyPack();
    const existing = await getPackRecord(LEGACY_PACK_ID);
    if (existing) return existing;
    return savePackRecord({ packId: LEGACY_PACK_ID, name: LEGACY_PACK_NAME, version: 1,
        author: "V1.2 Migration", description: "Words imported before V2.0",
        importDate: new Date().toISOString(), wordCount: 0, tags: ["legacy"] });
}

async function getMigrationPacks() {
    if (window.DutchTrainerPacks?.getAllPacks) return window.DutchTrainerPacks.getAllPacks();
    return getAllPackRecords();
}
async function getMigrationPack(id) {
    if (window.DutchTrainerPacks?.getPack) return window.DutchTrainerPacks.getPack(id);
    return getPackRecord(id);
}
async function saveMigrationPack(pack) {
    if (window.DutchTrainerPacks?.savePack) return window.DutchTrainerPacks.savePack(pack);
    return savePackRecord(pack);
}

async function migrateV1ToV2() {
    const words = await getAllWords();
    await ensureLegacyMigrationPack();
    const migrated = [];
    for (const original of (Array.isArray(words) ? words : [])) {
        const word = { ...original };
        if (normalizeWordForV2(word)) migrated.push(word);
    }
    if (migrated.length) await saveWords(migrated);
    await rebuildAllPackMetadata();
}

async function repairV2Data() {
    const words = await getAllWords();
    if (!Array.isArray(words)) return;
    await ensureLegacyMigrationPack();
    const packs = await getMigrationPacks();
    const packIds = new Set((packs || []).map(p => p.packId));
    const repaired = [];
    for (const original of words) {
        const word = { ...original };
        let changed = normalizeWordForV2(word);
        if (!packIds.has(word.packId)) {
            await createRecoveredPack(word.packId);
            packIds.add(word.packId);
            changed = true;
        }
        if (changed) { word.updatedAt = new Date().toISOString(); repaired.push(word); }
    }
    if (repaired.length) await saveWords(repaired);
    await rebuildAllPackMetadata();
}

async function createRecoveredPack(packId) {
    if (!packId || await getMigrationPack(packId)) return;
    await saveMigrationPack({ packId, name: `Recovered Pack ${packId}`, version: 1,
        author: "Recovered from existing vocabulary", description: "Automatically recovered during V2.0 migration.",
        importDate: new Date().toISOString(), wordCount: 0, tags: ["recovered"] });
}

async function rebuildAllPackMetadata() {
    const words = await getAllWords();
    const packs = await getMigrationPacks();
    if (!Array.isArray(words) || !Array.isArray(packs)) return;
    const map = new Map(packs.map(p => [p.packId, { ...p }]));
    for (const word of words) {
        const id = word.packId || LEGACY_PACK_ID;
        if (!map.has(id)) map.set(id, { packId: id, name: id === LEGACY_PACK_ID ? LEGACY_PACK_NAME : `Recovered Pack ${id}`, version: 1, wordCount: 0, tags: [] });
    }
    for (const pack of map.values()) {
        pack.wordCount = words.filter(w => (w.packId || LEGACY_PACK_ID) === pack.packId).length;
        pack.updatedAt = new Date().toISOString();
        await saveMigrationPack(pack);
    }
}
