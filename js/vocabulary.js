'use strict';

// V2.4 Stable Core vocabulary facade.
// This module gives vocabulary and pack selection one predictable API.
// Existing V2.3 implementations remain the source of behavior during migration.

const DutchTrainer = window.DutchTrainer || {};
DutchTrainer.vocabulary = DutchTrainer.vocabulary || {};

function requireFunction(name) {
    const fn = window[name];
    if (typeof fn !== 'function') {
        throw new Error(`Vocabulary API requires ${name}().`);
    }
    return fn;
}

DutchTrainer.vocabulary.getAll = async function () {
    return requireFunction('getAllWords')();
};

DutchTrainer.vocabulary.getWord = async function (id) {
    return requireFunction('getWord')(id);
};

DutchTrainer.vocabulary.saveWord = async function (word) {
    return requireFunction('saveWord')(word);
};

DutchTrainer.vocabulary.saveWords = async function (words) {
    return requireFunction('saveWords')(words);
};

DutchTrainer.vocabulary.deleteWord = async function (id) {
    return requireFunction('deleteWord')(id);
};

DutchTrainer.vocabulary.getPacks = async function () {
    if (DutchTrainer.packs?.getAll) {
        return DutchTrainer.packs.getAll();
    }
    if (window.DutchTrainerPacks?.getAllPacks) {
        return window.DutchTrainerPacks.getAllPacks();
    }
    return requireFunction('getAllPackRecords')();
};

DutchTrainer.vocabulary.getPack = async function (packId) {
    if (window.DutchTrainerPacks?.getPack) {
        return window.DutchTrainerPacks.getPack(packId);
    }
    return requireFunction('getPackRecord')(packId);
};

DutchTrainer.vocabulary.savePack = async function (pack) {
    if (window.DutchTrainerPacks?.savePack) {
        return window.DutchTrainerPacks.savePack(pack);
    }
    return requireFunction('savePackRecord')(pack);
};

DutchTrainer.vocabulary.selectAll = function () {
    return requireFunction('selectAllVocabulary')();
};

DutchTrainer.vocabulary.selectPack = function (packId) {
    return requireFunction('selectVocabularyPack')(packId);
};

DutchTrainer.vocabulary.selectNew = function () {
    return requireFunction('selectNewVocabulary')();
};

DutchTrainer.vocabulary.selectWeak = function () {
    return requireFunction('selectWeakVocabulary')();
};

DutchTrainer.vocabulary.selectDue = function () {
    return requireFunction('selectDueVocabulary')();
};

DutchTrainer.vocabulary.getSelection = function () {
    return requireFunction('getVocabularySelection')();
};

DutchTrainer.vocabulary.setSource = function (source, options) {
    return requireFunction('setVocabularySelectionSource')(source, options);
};

DutchTrainer.vocabulary.filter = async function (options = {}) {
    const words = await DutchTrainer.vocabulary.getAll();
    let result = Array.isArray(words) ? words : [];

    if (options.packId) {
        const id = String(options.packId);
        result = result.filter(word => String(word.packId || '') === id);
    }

    if (options.newOnly) {
        result = result.filter(word => Boolean(word.isNew));
    }

    if (options.weakOnly) {
        result = result.filter(word => Number(word.mastery ?? 0) < 40);
    }

    if (options.dueOnly) {
        const now = Date.now();
        result = result.filter(word => {
            const due = word.dueAt ?? word.nextReview;
            return due && new Date(due).getTime() <= now;
        });
    }

    return result;
};

DutchTrainer.vocabulary.getSelected = async function () {
    if (typeof window.getSelectedVocabulary === 'function') {
        return window.getSelectedVocabulary();
    }

    const selection = DutchTrainer.vocabulary.getSelection();
    return DutchTrainer.vocabulary.filter({
        packId: selection.source === 'pack' ? selection.packId : null,
        newOnly: selection.newOnly,
        weakOnly: selection.weakOnly,
        dueOnly: selection.dueOnly
    });
};

window.DutchTrainer = DutchTrainer;
