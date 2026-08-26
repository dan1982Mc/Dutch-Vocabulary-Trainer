/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   runtime.js - final Architecture A runtime normalization

   This file contains only the small runtime adapters required
   because the application controller and some older module
   entry-point names are already part of the V2 repository.
   It does not contain a second data model or selection engine.
========================================================= */

/* db.js canonical entry point is initDatabase(). */
if (typeof initDatabase === "function") {
    window.initializeDatabase = initDatabase;
}

/* packs.js canonical default-pack entry point. */
if (typeof ensureDefaultPack === "function") {
    window.initializePacks = ensureDefaultPack;
}

/* selection.js is the sole owner of vocabulary selection. */
window.changeVocabularySelection = function (source, packId = null) {
    const normalized = String(source || "all").trim().toLowerCase();

    switch (normalized) {
        case "pack":
            return typeof selectVocabularyPack === "function"
                ? selectVocabularyPack(packId)
                : null;
        case "new":
            return typeof selectNewVocabulary === "function"
                ? selectNewVocabulary()
                : null;
        case "weak":
            return typeof selectWeakVocabulary === "function"
                ? selectWeakVocabulary()
                : null;
        case "due":
            return typeof selectDueVocabulary === "function"
                ? selectDueVocabulary()
                : null;
        case "all":
        default:
            return typeof selectAllVocabulary === "function"
                ? selectAllVocabulary()
                : null;
    }
};

/* The old migration alias is no longer needed by app.js, but keep
   it harmlessly available for any V1/V2 UI code still calling it. */
if (typeof runMigrations === "function") {
    window.runMigration = runMigrations;
}

/* Canonical exercise names are meaning / recall / fill / choose /
   production. Practice may use its internal aliases, so normalize
   only at the public boundary when this helper is used. */
window.normalizeApplicationExerciseType = function (type) {
    if (typeof normalizeExerciseType === "function") {
        return normalizeExerciseType(type) || "meaning";
    }
    return String(type || "meaning").trim().toLowerCase();
};

console.log("Dutch Vocabulary Trainer runtime normalization ready.");
