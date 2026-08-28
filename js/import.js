/* Dutch Vocabulary Trainer V2.4 — core Word Pack import */
'use strict';

const IMPORT_LIMITS = { maxFileSize: 10 * 1024 * 1024, maxWords: 10000 };
const text = value => value == null ? '' : String(value).trim();
const sourceWords = data => Array.isArray(data) ? data : [data?.words, data?.vocabulary, data?.terms, data?.entries, data?.items, data?.data?.words, data?.data?.vocabulary].find(Array.isArray) || [];
const metadata = data => data?.metadata || data?.pack || data?.wordPack || {};
const slug = value => text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function validate(data) {
    const errors = [];
    if (!data || typeof data !== 'object') errors.push('The imported file must contain a Word Pack JSON object.');
    const words = sourceWords(data);
    if (!words.length) errors.push('No vocabulary words were found in the imported file.');
    if (words.length > IMPORT_LIMITS.maxWords) errors.push(`The Word Pack contains ${words.length} words. Maximum is ${IMPORT_LIMITS.maxWords}.`);
    const seen = new Set();
    words.forEach((word, index) => {
        if (!word || typeof word !== 'object') { errors.push(`Word ${index + 1} is not an object.`); return; }
        const dutch = text(word.dutch ?? word.word ?? word.term ?? word.text);
        const english = text(word.english ?? word.meaning ?? word.translation ?? word.definition);
        if (!dutch) errors.push(`Word ${index + 1} is missing its Dutch word.`);
        if (!english) errors.push(`Word ${index + 1} is missing its English meaning.`);
        if (word.id != null) {
            const id = text(word.id);
            if (seen.has(id)) errors.push(`Duplicate word id "${id}" in the import.`);
            seen.add(id);
        }
    });
    return { valid: errors.length === 0, errors, wordCount: words.length };
}

function packInfo(data, override = '') {
    const meta = metadata(data);
    const name = text(override) || text(meta.name ?? data.name ?? data.packName ?? data.title) || 'Imported Word Pack';
    const suppliedId = text(meta.packId ?? data.packId ?? meta.id);
    const packId = suppliedId || `pack_${slug(name) || 'import'}_${Date.now().toString(36)}`;
    return {
        packId,
        id: packId,
        name,
        description: text(meta.description ?? data.description),
        author: text(meta.author ?? data.author),
        version: text(meta.version ?? data.packVersion ?? data.version) || '1.0',
        language: text(meta.language ?? data.language) || 'nl',
        targetLanguage: text(meta.targetLanguage ?? data.targetLanguage) || 'en',
        wordCount: sourceWords(data).length,
        imported: true,
        importedAt: new Date().toISOString(),
        schemaVersion: 3
    };
}

function normalizeWord(raw, packId, index) {
    const dutch = text(raw.dutch ?? raw.word ?? raw.term ?? raw.text);
    const english = text(raw.english ?? raw.meaning ?? raw.translation ?? raw.definition);
    const sourceId = text(raw.id ?? raw.wordId ?? raw.termId) || String(index + 1);
    return {
        ...raw,
        id: `${packId}::${sourceId}`,
        dutch,
        english,
        word: dutch,
        term: dutch,
        meaning: english,
        packId,
        mastery: Number.isFinite(Number(raw.mastery)) ? Math.max(0, Math.min(100, Number(raw.mastery))) : 0,
        isNew: raw.isNew === undefined ? Number(raw.mastery || 0) <= 0 : Boolean(raw.isNew),
        nextReview: raw.nextReview ?? raw.nextReviewAt ?? raw.dueAt ?? Date.now(),
        dueAt: raw.dueAt ?? raw.nextReviewAt ?? raw.nextReview,
        stats: raw.stats && typeof raw.stats === 'object' ? { ...raw.stats } : {},
        history: Array.isArray(raw.history) ? [...raw.history] : [],
        schemaVersion: 3,
        imported: true,
        importedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

async function importWordPack(data, options = {}) {
    const app = window.DutchTrainer;
    if (!app?.db || !app?.vocabulary) throw new Error('V2.4 core is not initialized.');
    const validation = validate(data);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    await app.db.init();

    const pack = packInfo(data, options.packName || options.name);
    const existingPacks = await app.db.getPacks();
    if (existingPacks.some(existing => String(existing.packId) === String(pack.packId))) {
        throw new Error(`This Word Pack is already installed as "${existingPacks.find(existing => String(existing.packId) === String(pack.packId)).name}".`);
    }

    const words = sourceWords(data).map((word, index) => normalizeWord(word, pack.packId, index));
    const existingWords = await app.db.getWords();
    const existingIds = new Set(existingWords.map(word => String(word.id)));
    const newWords = words.filter(word => !existingIds.has(String(word.id)));
    await app.db.savePack(pack);
    await app.db.saveWords(newWords);

    if (options.selectImportedPack !== false) {
        localStorage.setItem('v24.selectedPackId', pack.packId);
    }

    return { success: true, pack, packId: pack.packId, words: newWords, added: newWords.length, total: newWords.length };
}

async function importFromText(raw, options = {}) {
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error('The imported file is not valid JSON.'); }
    return importWordPack(data, options);
}

async function importFile(file, options = {}) {
    if (!file) throw new Error('No file was selected.');
    if (file.size > IMPORT_LIMITS.maxFileSize) throw new Error('The selected file is too large. Maximum size is 10 MB.');
    if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Please select a JSON Word Pack file.');
    return importFromText(await file.text(), options);
}

window.DutchTrainerImport = { version: '2.4.0', limits: IMPORT_LIMITS, validate, importWordPack, importFromText, importFile };
