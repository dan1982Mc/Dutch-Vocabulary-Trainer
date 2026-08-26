/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Word Pack Database / Pack Management
========================================================= */

const DEFAULT_PACK_ID = "default";
const DEFAULT_PACK_NAME = "Default Vocabulary";
const PACK_TYPES = { imported: "imported", manual: "manual", legacy: "legacy", system: "system" };

function createPackRecord(data = {}) {
    const now = new Date().toISOString();
    return {
        packId: normalizePackId(data.packId),
        name: normalizePackName(data.name),
        description: String(data.description || "").trim(),
        source: String(data.source || "").trim(),
        type: normalizePackType(data.type),
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now,
        wordCount: Number(data.wordCount || 0),
        metadata: data.metadata && typeof data.metadata === "object" ? { ...data.metadata } : {}
    };
}
function normalizePackId(packId) { return packId == null || String(packId).trim() === "" ? DEFAULT_PACK_ID : String(packId).trim(); }
function normalizePackType(type) { const value = String(type || PACK_TYPES.imported).trim().toLowerCase(); return Object.values(PACK_TYPES).includes(value) ? value : PACK_TYPES.imported; }
function normalizePackName(name) { return String(name || DEFAULT_PACK_NAME).trim() || DEFAULT_PACK_NAME; }

async function getAllPacks() {
    if (typeof getAllPackRecords !== "function") throw new Error("packs.js: getAllPackRecords() is unavailable.");
    const packs = await getAllPackRecords();
    return Array.isArray(packs) ? packs : [];
}
async function getPack(packId) {
    const id = normalizePackId(packId);
    if (typeof getPackRecord === "function") return getPackRecord(id);
    const packs = await getAllPacks();
    return packs.find(pack => String(pack.packId) === id) || null;
}
async function savePack(pack) {
    if (!pack) throw new Error("Cannot save empty pack.");
    const normalized = createPackRecord({ ...pack, packId: normalizePackId(pack.packId), updatedAt: new Date().toISOString() });
    if (typeof savePackRecord !== "function") throw new Error("packs.js: savePackRecord() is unavailable.");
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
    const pack = await getPack(id);
    if (!pack) return false;
    if (typeof deletePackRecord !== "function") throw new Error("packs.js: deletePackRecord() is unavailable.");
    await deletePackRecord(id);
    return true;
}

window.DutchTrainerPacks = { getAllPacks, getPack, savePack, createPack, ensurePack, ensureDefaultPack, updatePack, deletePack, assignWordToPack: async (word, packId) => { word.packId = normalizePackId(packId); if (typeof saveWord !== "function") throw new Error("saveWord() is unavailable."); await saveWord(word); return word; } };
