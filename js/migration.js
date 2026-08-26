/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   V1.2 -> V2.0 Migration Layer

   Responsibilities:
   - Detect legacy V1.2 data
   - Preserve all existing word data
   - Add V2.0 fields where missing
   - Create / repair pack metadata
   - Assign packId
   - Recalculate pack word counts
   - Remain safe to run repeatedly
========================================================= */


/* =========================================================
   MIGRATION CONSTANTS
========================================================= */

const MIGRATION_VERSION = 2;

const MIGRATION_SETTING_KEY = "migrationVersion";

const LEGACY_PACK_ID = "legacy";

const DEFAULT_PACK_NAME = "Legacy Vocabulary";


/* =========================================================
   PUBLIC ENTRY POINT
========================================================= */

/**
 * Run all required migrations.
 *
 * Safe to call on every application startup.
 *
 * Nothing is removed from existing records.
 */
async function runMigrations() {

    console.log(
        `Running Dutch Vocabulary Trainer migration check...`
    );

    try {

        const currentVersion = await getSetting(
            MIGRATION_SETTING_KEY,
            0
        );

        if (currentVersion >= MIGRATION_VERSION) {

            await repairV2Data();

            return;

        }

        await migrateV1ToV2();

        await setSetting(
            MIGRATION_SETTING_KEY,
            MIGRATION_VERSION
        );

        console.log(
            "Dutch Vocabulary Trainer migration complete."
        );

    } catch (error) {

        console.error(
            "Migration failed:",
            error
        );

        /*
         * Do not mark the migration as complete if something
         * failed. The next startup can safely retry it.
         */
        throw error;

    }

}


/* =========================================================
   V1.2 -> V2.0
========================================================= */

async function migrateV1ToV2() {

    console.log(
        "Migrating vocabulary data from V1.2 to V2.0..."
    );

    const words = await getAllWords();

    if (!Array.isArray(words)) {

        console.warn(
            "Vocabulary store returned invalid data."
        );

        return;

    }

    /*
     * First ensure that the legacy pack exists.
     */
    await ensureLegacyPack();

    let migratedCount = 0;

    const migratedWords = [];

    for (const originalWord of words) {

        /*
         * Clone the object so that migration does not
         * accidentally mutate an object returned by IndexedDB.
         */
        const word = {
            ...originalWord
        };

        const changed = normalizeWordForV2(word);

        /*
         * Existing V1.2 records generally don't have packId.
         *
         * Those records belong to the automatically-created
         * Legacy Vocabulary pack.
         */
        if (!word.packId) {

            word.packId = LEGACY_PACK_ID;

        }

        if (changed) {

            migratedCount++;

        }

        migratedWords.push(word);

    }

    if (migratedWords.length > 0) {

        await saveWords(migratedWords);

    }

    /*
     * Rebuild pack metadata after migration.
     */
    await rebuildAllPackMetadata();

    console.log(
        `Migrated ${migratedCount} vocabulary records.`
    );

}


/* =========================================================
   NORMALIZE WORD
========================================================= */

/**
 * Add V2 fields without destroying existing V1.2 fields.
 *
 * Important:
 * Existing AI exercise properties are intentionally untouched.
 */
function normalizeWordForV2(word) {

    let changed = false;


    /* -----------------------------------------------------
       Pack
    ----------------------------------------------------- */

    if (!word.packId) {

        word.packId = LEGACY_PACK_ID;

        changed = true;

    }


    /* -----------------------------------------------------
       Mastery
    ----------------------------------------------------- */

    if (
        word.mastery === undefined ||
        word.mastery === null ||
        Number.isNaN(Number(word.mastery))
    ) {

        /*
         * Some older versions may have used different
         * property names. Try to recover them before falling
         * back to zero.
         */
        if (
            word.masteryLevel !== undefined &&
            !Number.isNaN(Number(word.masteryLevel))
        ) {

            word.mastery = Number(word.masteryLevel);

        } else if (
            word.score !== undefined &&
            !Number.isNaN(Number(word.score))
        ) {

            word.mastery = Number(word.score);

        } else {

            word.mastery = 0;

        }

        changed = true;

    }

    word.mastery = clampMastery(word.mastery);


    /* -----------------------------------------------------
       New-word status
    ----------------------------------------------------- */

    if (word.isNew === undefined) {

        /*
         * A word with previous answer history is not really new.
         */
        if (
            Array.isArray(word.history) &&
            word.history.length > 0
        ) {

            word.isNew = false;

        } else if (
            word.stats &&
            (
                Number(word.stats.correct || 0) > 0 ||
                Number(word.stats.incorrect || 0) > 0
            )
        ) {

            word.isNew = false;

        } else {

            word.isNew = true;

        }

        changed = true;

    }


    /* -----------------------------------------------------
       Review date
    ----------------------------------------------------- */

    if (
        word.nextReview === undefined ||
        word.nextReview === null
    ) {

        /*
         * Preserve alternate legacy field names where possible.
         */
        if (word.dueDate !== undefined) {

            word.nextReview = normalizeDateValue(
                word.dueDate
            );

        } else if (word.due !== undefined) {

            word.nextReview = normalizeDateValue(
                word.due
            );

        } else {

            /*
             * Words with no review history should be immediately
             * eligible for practice.
             */
            word.nextReview = Date.now();

        }

        changed = true;

    }


    /* -----------------------------------------------------
       History
    ----------------------------------------------------- */

    if (!Array.isArray(word.history)) {

        /*
         * If V1.2 used another history field, preserve it.
         */
        if (Array.isArray(word.answerHistory)) {

            word.history = [
                ...word.answerHistory
            ];

        } else {

            word.history = [];

        }

        changed = true;

    }


    /* -----------------------------------------------------
       Statistics
    ----------------------------------------------------- */

    if (!word.stats || typeof word.stats !== "object") {

        word.stats = createDefaultStats();

        changed = true;

    } else {

        const defaults = createDefaultStats();

        for (const key of Object.keys(defaults)) {

            if (
                word.stats[key] === undefined ||
                word.stats[key] === null
            ) {

                word.stats[key] = defaults[key];

                changed = true;

            }

        }

    }


    /* -----------------------------------------------------
       Created / updated timestamps
    ----------------------------------------------------- */

    if (!word.createdAt) {

        word.createdAt =
            word.importDate ||
            word.dateAdded ||
            new Date().toISOString();

        changed = true;

    }

    if (!word.updatedAt) {

        word.updatedAt = new Date().toISOString();

        changed = true;

    }


    /* -----------------------------------------------------
       V2 schema marker
    ----------------------------------------------------- */

    if (word.schemaVersion !== MIGRATION_VERSION) {

        word.schemaVersion = MIGRATION_VERSION;

        changed = true;

    }


    /*
     * IMPORTANT:
     *
     * Do NOT reconstruct or replace the rest of the object.
     *
     * This means fields such as:
     *
     * - word
     * - translation
     * - meaning
     * - examples
     * - sentences
     * - hints
     * - AI-generated exercises
     * - pronunciation
     * - memory tricks
     * - categories
     *
     * remain untouched.
     */

    return changed;

}


/* =========================================================
   DEFAULT STATISTICS
========================================================= */

function createDefaultStats() {

    return {

        /*
         * Overall answers
         */
        correct: 0,
        incorrect: 0,

        /*
         * Exercise-specific performance
         */
        meaning: 0,
        recall: 0,
        fill: 0,
        choose: 0,
        production: 0,

        /*
         * Number of attempts by exercise type.
         */
        meaningAttempts: 0,
        recallAttempts: 0,
        fillAttempts: 0,
        chooseAttempts: 0,
        productionAttempts: 0,

        /*
         * Last activity.
         */
        lastPracticed: null

    };

}


/* =========================================================
   PACK REPAIR
========================================================= */

/**
 * Repair data when migration has already happened.
 *
 * This catches cases such as:
 * - imported packs added by an older V2 build
 * - missing metadata
 * - incorrect word counts
 * - orphaned pack references
 */
async function repairV2Data() {

    const words = await getAllWords();

    if (!Array.isArray(words)) {

        return;

    }

    /*
     * Make sure the legacy pack still exists.
     */
    await ensureLegacyPack();

    const packs = await getAllPacks();

    const packIds = new Set(
        packs.map(pack => pack.packId)
    );

    const repairedWords = [];

    for (const originalWord of words) {

        const word = {
            ...originalWord
        };

        let changed = normalizeWordForV2(word);

        /*
         * If the word references a pack that no longer exists,
         * don't delete or reassign it silently.
         *
         * Instead preserve the reference and recreate the pack
         * metadata later.
         */
        if (!packIds.has(word.packId)) {

            await createRecoveredPack(word.packId);

            packIds.add(word.packId);

            changed = true;

        }

        if (changed) {

            word.updatedAt =
                new Date().toISOString();

            repairedWords.push(word);

        }

    }

    if (repairedWords.length > 0) {

        await saveWords(repairedWords);

    }

    await rebuildAllPackMetadata();

}


/* =========================================================
   CREATE RECOVERED PACK
========================================================= */

async function createRecoveredPack(packId) {

    if (!packId) {

        return;

    }

    const existing = await getPack(packId);

    if (existing) {

        return;

    }

    await savePack({

        packId,

        name: `Recovered Pack ${packId}`,

        version: 1,

        author: "Recovered from existing vocabulary",

        description:
            "Automatically recovered during V2.0 migration.",

        importDate:
            new Date().toISOString(),

        wordCount: 0,

        tags: [
            "recovered"
        ]

    });

}


/* =========================================================
   REBUILD PACK METADATA
========================================================= */

async function rebuildAllPackMetadata() {

    const words = await getAllWords();
    const packs = await getAllPacks();

    if (!Array.isArray(words)) {

        return;

    }

    const packMap = new Map();

    /*
     * Existing pack metadata is retained.
     */
    for (const pack of packs) {

        packMap.set(
            pack.packId,
            {
                ...pack
            }
        );

    }

    /*
     * Every vocabulary record must belong to a pack.
     */
    for (const word of words) {

        const packId =
            word.packId ||
            LEGACY_PACK_ID;

        if (!packMap.has(packId)) {

            packMap.set(

                packId,

                {
                    packId,

                    name:
                        packId === LEGACY_PACK_ID
                            ? DEFAULT_PACK_NAME
                            : `Recovered Pack ${packId}`,

                    version: 1,

                    author:
                        "Dutch Vocabulary Trainer",

                    description:
                        "Automatically recovered vocabulary pack.",

                    importDate:
                        new Date().toISOString(),

                    wordCount: 0,

                    tags: []

                }

            );

        }

    }

    /*
     * Calculate metadata for every pack.
     */
    for (const pack of packMap.values()) {

        const packWords = words.filter(
            word =>
                (word.packId || LEGACY_PACK_ID) ===
                pack.packId
        );

        const stats =
            calculatePackStatisticsFromWords(
                packWords
            );

        pack.wordCount = stats.total;

        pack.statistics = stats;

        /*
         * Keep the original import date / metadata.
         * Only update dynamic statistics.
         */
        pack.updatedAt =
            new Date().toISOString();

        await savePack(pack);

    }

}


/* =========================================================
   PACK STATISTICS
========================================================= */

function calculatePackStatisticsFromWords(words) {

    const total = words.length;

    if (total === 0) {

        return {

            total: 0,

            learned: 0,

            weak: 0,

            due: 0,

            new: 0,

            averageMastery: 0,

            accuracy: 0,

            answers: 0

        };

    }

    const learned =
        words.filter(
            word => Number(word.mastery || 0) >= 90
        ).length;

    const weak =
        words.filter(
            word => {

                const mastery =
                    Number(word.mastery || 0);

                return mastery > 0 && mastery < 40;

            }
        ).length;

    const due =
        words.filter(
            word =>
                Number(word.nextReview || 0) <=
                Date.now()
        ).length;

    const newWords =
        words.filter(
            word => word.isNew === true
        ).length;

    const totalMastery =
        words.reduce(
            (sum, word) =>
                sum + Number(word.mastery || 0),
            0
        );

    const averageMastery =
        Math.round(
            totalMastery / total
        );

    let correct = 0;
    let incorrect = 0;

    for (const word of words) {

        const stats =
            word.stats || {};

        correct +=
            Number(stats.correct || 0);

        incorrect +=
            Number(stats.incorrect || 0);

    }

    const answers =
        correct + incorrect;

    const accuracy =
        answers > 0
            ? Math.round(
                (correct / answers) * 100
            )
            : 0;

    return {

        total,

        learned,

        weak,

        due,

        new: newWords,

        averageMastery,

        accuracy,

        answers

    };

}


/* =========================================================
   IMPORT MIGRATION SUPPORT
========================================================= */

/**
 * Prepare an imported Word Pack for V2.0.
 *
 * This function will also be used by import.js later.
 *
 * It does NOT save vocabulary itself.
 */
function preparePackMetadata(packData) {

    if (!packData || typeof packData !== "object") {

        throw new Error(
            "Invalid Word Pack data."
        );

    }

    /*
     * Preserve an existing packId.
     *
     * New packs should normally receive their packId from
     * packs.js/import.js, but this function is intentionally
     * backward compatible.
     */
    const packId =
        normalizePackId(
            packData.packId ||
            packData.id ||
            generatePackId()
        );

    const metadata = {

        /*
         * New explicit V2 identifier.
         */
        packId,

        /*
         * Preserve existing names where available.
         */
        name:
            packData.name ||
            packData.title ||
            "Imported Word Pack",

        version:
            packData.version ||
            1,

        author:
            packData.author ||
            "Unknown",

        description:
            packData.description ||
            "",

        importDate:
            packData.importDate ||
            new Date().toISOString(),

        tags:
            Array.isArray(packData.tags)
                ? [...packData.tags]
                : [],

        /*
         * Dynamic values will be updated after words are stored.
         */
        wordCount:
            Number(packData.wordCount || 0),

        statistics:
            packData.statistics || null,

        updatedAt:
            new Date().toISOString()

    };

    /*
     * Preserve any additional metadata from the original pack.
     */
    for (const key of Object.keys(packData)) {

        if (metadata[key] === undefined) {

            metadata[key] = packData[key];

        }

    }

    return metadata;

}


/* =========================================================
   PACK ID GENERATION
========================================================= */

function generatePackId() {

    const timestamp =
        Date.now().toString(36);

    const random =
        Math.random()
            .toString(36)
            .substring(2, 8);

    return `pack-${timestamp}-${random}`;

}


/* =========================================================
   PACK ID NORMALIZATION
========================================================= */

function normalizePackId(value) {

    if (!value) {

        return generatePackId();

    }

    return String(value)

        .trim()

        .toLowerCase()

        .replace(/\s+/g, "-")

        .replace(/[^a-z0-9_-]/g, "");

}


/* =========================================================
   DATE NORMALIZATION
========================================================= */

function normalizeDateValue(value) {

    if (value === undefined || value === null) {

        return Date.now();

    }

    /*
     * Already a timestamp.
     */
    if (
        typeof value === "number" &&
        !Number.isNaN(value)
    ) {

        return value;

    }

    /*
     * Date string.
     */
    const parsed =
        Date.parse(value);

    if (!Number.isNaN(parsed)) {

        return parsed;

    }

    return Date.now();

}


/* =========================================================
   MASTERY NORMALIZATION
========================================================= */

function clampMastery(value) {

    const number =
        Number(value);

    if (Number.isNaN(number)) {

        return 0;

    }

    return Math.min(
        100,
        Math.max(0, number)
    );

}


/* =========================================================
   DIAGNOSTICS
========================================================= */

async function getMigrationStatus() {

    const version =
        await getSetting(
            MIGRATION_SETTING_KEY,
            0
        );

    const words =
        await getAllWords();

    const packs =
        await getAllPacks();

    const wordsWithoutPack =
        words.filter(
            word => !word.packId
        ).length;

    const orphanedWords =
        words.filter(
            word =>
                word.packId &&
                !packs.some(
                    pack =>
                        pack.packId === word.packId
                )
        ).length;

    return {

        currentVersion: version,

        targetVersion:
            MIGRATION_VERSION,

        vocabularyCount:
            words.length,

        packCount:
            packs.length,

        wordsWithoutPack,

        orphanedWords,

        complete:
            version >= MIGRATION_VERSION &&
            wordsWithoutPack === 0 &&
            orphanedWords === 0

    };

}


/* =========================================================
   OPTIONAL RESET
========================================================= */

/**
 * Only intended for development/testing.
 *
 * This does NOT delete vocabulary.
 * It only forces the migration check to run again.
 */
async function resetMigrationFlag() {

    await setSetting(
        MIGRATION_SETTING_KEY,
        0
    );

}