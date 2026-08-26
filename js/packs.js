/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Word Pack Database / Pack Management

   Architecture A: pack business logic lives behind one explicit
   namespace. IndexedDB persistence is provided by db.js.
========================================================= */
(function () {
    "use strict";

    const DEFAULT_PACK_ID = "default";
    const DEFAULT_PACK_NAME = "Default Vocabulary";
    const PACK_TYPES = { imported: "imported", manual: "manual", legacy: "legacy", system: "system" };

    function createPackRecord(data = {}) {
        const now = new Date().toISOString();
        return { packId: normalizePackId(data.packId), name: normalizePackName(data.name), description: String(data.description || "").trim(), source: String(data.source || "").trim(), type: normalizePackType(data.type), createdAt: data.createdAt || now, updatedAt: data.updatedAt || now, wordCount: Number(data.wordCount || 0), metadata: data.metadata && typeof data.metadata === "object" ? { ...data.metadata } : {} };
    }
    function normalizePackId(id) { return id == null || String(id).trim() === "" ? DEFAULT_PACK_ID : String(id).trim(); }
    function normalizePackType(type) { const value = String(type || PACK_TYPES.imported).trim().toLowerCase(); return Object.values(PACK_TYPES).includes(value) ? value : PACK_TYPES.imported; }
    function normalizePackName(name) { return String(name || DEFAULT_PACK_NAME).trim() || DEFAULT_PACK_NAME; }

    async function getAllPacks() {
        if (typeof getAllPackRecords !== "function") throw new Error("db.js: getAllPackRecords() is unavailable.");
        const packs = await getAllPackRecords();
        return Array.isArray(packs) ? packs : [];
    }
    async function getPack(packId) {
        if (typeof getPackRecord !== "function") throw new Error("db.js: getPackRecord() is unavailable.");
        return getPackRecord(normalizePackId(packId));
    }
    async function savePack(pack) {
        if (typeof savePackRecord !== "function") throw new Error("db.js: savePackRecord() is unavailable.");
        const normalized = createPackRecord({ ...pack, packId: normalizePackId(pack?.packId), updatedAt: new Date().toISOString() });
        await savePackRecord(normalized);
        return normalized;
    }
    function generatePackId(name = "pack") {
        const base = String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        return `${base || "pack"}-${Date.now().toString(36)}`;
    }
    async function createPack(data = {}) {
        const packId = data.packId ? normalizePackId(data.packId) : generatePackId(data.name);
        const existing = await getPack(packId);
        if (existing) return existing;
        return savePack(createPackRecord({ ...data, packId }));
    }
    async function ensurePack(data = {}) {
        if (data.packId) {
            const existing = await getPack(data.packId);
            if (existing) return existing;
        }
        return createPack(data);
    }
    async function ensureDefaultPack() {
        const existing = await getPack(DEFAULT_PACK_ID);
        if (existing) return existing;
        return savePack(createPackRecord({ packId: DEFAULT_PACK_ID, name: DEFAULT_PACK_NAME, description: "Vocabulary without an assigned Word Pack.", source: "system", type: PACK_TYPES.system }));
    }
    async function updatePack(packId, updates = {}) {
        const existing = await getPack(packId);
        if (!existing) throw new Error(`Pack not found: ${packId}`);
        return savePack({ ...existing, ...updates, packId: existing.packId, createdAt: existing.createdAt });
    }
    async function deletePack(packId) {
        const id = normalizePackId(packId);
        if (id === DEFAULT_PACK_ID) throw new Error("The default vocabulary pack cannot be deleted.");
        if (!(await getPack(id))) return false;
        if (typeof deletePackRecord !== "function") throw new Error("db.js: deletePackRecord() is unavailable.");
        await deletePackRecord(id);
        return true;
    }
    async function assignWordToPack(word, packId) {
        if (!word) throw new Error("Cannot assign an empty word.");
        if (typeof saveWord !== "function") throw new Error("db.js: saveWord() is unavailable.");
        word.packId = normalizePackId(packId);
        await saveWord(word);
        return word;
    }

    window.DutchTrainerPacks = { DEFAULT_PACK_ID, DEFAULT_PACK_NAME, PACK_TYPES, createPackRecord, getAllPacks, getPack, savePack, createPack, ensurePack, ensureDefaultPack, updatePack, deletePack, assignWordToPack };
})();
