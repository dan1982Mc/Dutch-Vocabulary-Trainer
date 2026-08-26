/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Word Pack Database / Pack Management

   Responsibilities:
   - Explicit Word Pack database
   - Stable packId for every pack
   - Preserve imported pack metadata
   - Associate vocabulary with packs
   - Support legacy V1.2 records
   - Per-pack statistics
   - Import / update pack metadata
   - Prevent accidental pack duplication
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_PACK_ID = "default";

const DEFAULT_PACK_NAME =
    "Default Vocabulary";


/* =========================================================
   PACK TYPES
========================================================= */

const PACK_TYPES = {

    imported: "imported",

    manual: "manual",

    legacy: "legacy",

    system: "system"

};


/* =========================================================
   PACK OBJECT
========================================================= */

/**
 * Canonical V2.0 pack structure:
 *
 * {
 *   packId,
 *   name,
 *   description,
 *   source,
 *   type,
 *   createdAt,
 *   updatedAt,
 *   wordCount,
 *   metadata
 * }
 */
function createPackRecord(
    data = {}
) {

    const now =
        new Date().toISOString();

    const packId =
        normalizePackId(
            data.packId
        );

    return {

        packId,

        name:
            String(
                data.name ||
                DEFAULT_PACK_NAME
            ).trim(),

        description:
            String(
                data.description ||
                ""
            ).trim(),

        source:
            String(
                data.source ||
                ""
            ).trim(),

        type:
            normalizePackType(
                data.type
            ),

        createdAt:
            data.createdAt ||
            now,

        updatedAt:
            data.updatedAt ||
            now,

        wordCount:
            Number(
                data.wordCount || 0
            ),

        /*
         * Preserve arbitrary metadata from imported Word Packs.
         */
        metadata:
            data.metadata &&
            typeof data.metadata === "object"
                ? {
                    ...data.metadata
                }
                : {}

    };

}


/* =========================================================
   PACK ID
========================================================= */

/**
 * Normalize an existing pack ID.
 *
 * Existing IDs are not regenerated. This is important because
 * packId is the stable identifier connecting:
 *
 * Pack → Words → Statistics → Selection
 */
function normalizePackId(
    packId
) {

    if (
        packId === undefined ||
        packId === null ||
        String(packId).trim() === ""
    ) {

        return DEFAULT_PACK_ID;

    }

    return String(
        packId
    ).trim();

}


/* =========================================================
   PACK TYPE
========================================================= */

function normalizePackType(
    type
) {

    const normalized =
        String(
            type ||
            PACK_TYPES.imported
        )
        .trim()
        .toLowerCase();

    if (
        Object.values(
            PACK_TYPES
        ).includes(
            normalized
        )
    ) {

        return normalized;

    }

    return PACK_TYPES.imported;

}


/* =========================================================
   PACK NAME
========================================================= */

function normalizePackName(
    name
) {

    const normalized =
        String(
            name ||
            DEFAULT_PACK_NAME
        )
        .trim();

    return normalized ||
        DEFAULT_PACK_NAME;

}


/* =========================================================
   GET ALL PACKS
========================================================= */

async function getAllPacks() {

    /*
     * db.js is responsible for IndexedDB access.
     */
    if (
        typeof getAllPackRecords ===
        "function"
    ) {

        const packs =
            await getAllPackRecords();

        return Array.isArray(packs)
            ? packs
            : [];

    }


    /*
     * Compatibility fallback.
     *
     * If db.js exposes getAllPacks directly, use it.
     */
    if (
        typeof getAllPacksFromDB ===
        "function"
    ) {

        const packs =
            await getAllPacksFromDB();

        return Array.isArray(packs)
            ? packs
            : [];

    }


    return [];

}


/* =========================================================
   GET ONE PACK
========================================================= */

async function getPack(
    packId
) {

    const id =
        normalizePackId(
            packId
        );


    if (
        typeof getPackRecord ===
        "function"
    ) {

        return getPackRecord(
            id
        );

    }


    if (
        typeof getPackFromDB ===
        "function"
    ) {

        return getPackFromDB(
            id
        );

    }


    const packs =
        await getAllPacks();

    return (
        packs.find(
            pack =>
                String(
                    pack.packId
                ) === id
        ) ||
        null
    );

}


/* =========================================================
   SAVE PACK
========================================================= */

async function savePack(
    pack
) {

    if (!pack) {

        throw new Error(
            "Cannot save empty pack."
        );

    }

    const now =
        new Date().toISOString();

    const normalized =
        createPackRecord({

            ...pack,

            packId:
                normalizePackId(
                    pack.packId
                ),

            name:
                normalizePackName(
                    pack.name
                ),

            updatedAt:
                now

        });


    /*
     * Keep original creation timestamp.
     */
    if (pack.createdAt) {

        normalized.createdAt =
            pack.createdAt;

    }


    if (
        typeof savePackRecord ===
        "function"
    ) {

        await savePackRecord(
            normalized
        );

        return normalized;

    }


    if (
        typeof putPack ===
        "function"
    ) {

        await putPack(
            normalized
        );

        return normalized;

    }


    throw new Error(
        "Pack database API is unavailable."
    );

}


/* =========================================================
   CREATE PACK
========================================================= */

async function createPack(
    data = {}
) {

    let packId =
        normalizePackId(
            data.packId
        );


    /*
     * If no explicit ID was supplied, generate a stable ID.
     */
    if (
        !data.packId
    ) {

        packId =
            generatePackId(
                data.name
            );

    }


    /*
     * Never silently overwrite an existing pack.
     */
    const existing =
        await getPack(
            packId
        );

    if (existing) {

        return existing;

    }


    const pack =
        createPackRecord({

            ...data,

            packId

        });


    return savePack(
        pack
    );

}


/* =========================================================
   GENERATE PACK ID
========================================================= */

function generatePackId(
    name = "pack"
) {

    const base =
        String(
            name
        )
        .toLowerCase()
        .trim()
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        );


    const timestamp =
        Date.now()
            .toString(
                36
            );


    return (

        base ||
        "pack"

    ) +
    "-" +
    timestamp;

}


/* =========================================================
   ENSURE PACK
========================================================= */

/**
 * Find a pack by ID first.
 *
 * If it doesn't exist, create it.
 *
 * This is useful during Word Pack imports.
 */
async function ensurePack(
    data = {}
) {

    const packId =
        data.packId
            ? normalizePackId(
                data.packId
            )
            : null;


    if (packId) {

        const existing =
            await getPack(
                packId
            );

        if (existing) {

            return existing;

        }

    }


    return createPack(
        data
    );

}


/* =========================================================
   UPDATE PACK
========================================================= */

async function updatePack(
    packId,
    updates = {}
) {

    const existing =
        await getPack(
            packId
        );

    if (!existing) {

        throw new Error(
            `Pack not found: ${packId}`
        );

    }


    const updated = {

        ...existing,

        ...updates,

        packId:
            existing.packId,

        createdAt:
            existing.createdAt,

        updatedAt:
            new Date().toISOString()

    };


    return savePack(
        updated
    );

}


/* =========================================================
   DELETE PACK
========================================================= */

/**
 * Deleting a pack does NOT automatically delete words.
 *
 * Instead, words are reassigned to the default pack.
 *
 * This protects vocabulary data from accidental deletion.
 */
async function deletePack(
    packId
) {

    const id =
        normalizePackId(
            packId
        );


    if (
        id === DEFAULT_PACK_ID
    ) {

        throw new Error(
            "The default vocabulary pack cannot be deleted."
        );

    }


    const pack =
        await getPack(
            id
        );

    if (!pack) {

        return false;

    }


    const words =
        await getAllWords();


    for (
        const word of words
    ) {

        if (
            String(
                word.packId || ""
            ) === id
        ) {

            word.packId =
                DEFAULT_PACK_ID;

            word.updatedAt =
                new Date().toISOString();

            await saveWord(
                word
            );

        }

    }


    if (
        typeof deletePackRecord ===
        "function"
    ) {

        await deletePackRecord(
            id
        );

    } else if (
        typeof deletePackFromDB ===
        "function"
    ) {

        await deletePackFromDB(
            id
        );

    } else {

        throw new Error(
            "Pack deletion API is unavailable."
        );

    }


    return true;

}


/* =========================================================
   ENSURE DEFAULT PACK
========================================================= */

async function ensureDefaultPack() {

    const existing =
        await getPack(
            DEFAULT_PACK_ID
        );

    if (existing) {

        return existing;

    }


    return savePack(

        createPackRecord({

            packId:
                DEFAULT_PACK_ID,

            name:
                DEFAULT_PACK_NAME,

            description:
                "Vocabulary without an assigned Word Pack.",

            source:
                "system",

            type:
                PACK_TYPES.system

        })

    );

}


/* =========================================================
   WORD PACK ASSOCIATION
========================================================= */

/**
 * Attach a word to a pack.
 */
async function assignWordToPack(
    word,
    packId
) {

    if (!word) {

        throw new Error(
            "Cannot assign an empty word."
        );

    }


    const id =
        normalizePackId(
            packId
        );


    /*
     * Ensure the target pack exists.
     */
    await ensurePack({

        packId:
            id,

        name:
            id === DEFAULT_PACK_ID
                ? DEFAULT_PACK_NAME
                : id

    });


    word.packId =
        id;

    word.updatedAt =
        new Date().toISOString();


    await saveWord(
        word
    );


    return word;

}


/* =========================================================
   GET WORDS FOR PACK
========================================================= */

async function getWordsForPack(
    packId
) {

    const id =
        normalizePackId(
            packId
        );

    const words =
        await getAllWords();


    return (
        Array.isArray(words)
            ? words
            : []
    )
    .filter(
        word =>
            String(
                word.packId ||
                DEFAULT_PACK_ID
            ) === id
    );

}


/* =========================================================
   PACK WORD COUNT
========================================================= */

async function getPackWordCount(
    packId
) {

    const words =
        await getWordsForPack(
            packId
        );

    return words.length;

}


/* =========================================================
   UPDATE PACK WORD COUNTS
========================================================= */

async function updatePackWordCounts() {

    const packs =
        await getAllPacks();

    const words =
        await getAllWords();


    const counts =
        {};


    for (
        const word of words
    ) {

        const packId =
            normalizePackId(
                word.packId
            );

        counts[packId] =
            (
                counts[packId] ||
                0
            ) + 1;

    }


    for (
        const pack of packs
    ) {

        const count =
            counts[
                pack.packId
            ] || 0;


        if (
            Number(
                pack.wordCount
            ) !== count
        ) {

            pack.wordCount =
                count;

            pack.updatedAt =
                new Date().toISOString();

            await savePack(
                pack
            );

        }

    }


    return counts;

}


/* =========================================================
   PER-PACK STATISTICS
========================================================= */

async function getPackStatistics(
    packId
) {

    const words =
        await getWordsForPack(
            packId
        );


    /*
     * Use the same central statistics functions as the
     * Dashboard / filters.
     */
    const stats =
        typeof calculateVocabularyStats ===
        "function"
            ? calculateVocabularyStats(
                words
            )
            : calculateFallbackPackStats(
                words
            );


    const skills =
        typeof calculateSkillStats ===
        "function"
            ? calculateSkillStats(
                words
            )
            : {};


    return {

        packId:
            normalizePackId(
                packId
            ),

        wordCount:
            words.length,

        stats,

        skills

    };

}


/* =========================================================
   ALL PACK STATISTICS
========================================================= */

async function getAllPackStatistics() {

    const packs =
        await getAllPacks();


    const results = [];


    for (
        const pack of packs
    ) {

        const statistics =
            await getPackStatistics(
                pack.packId
            );


        results.push({

            pack,

            ...statistics

        });

    }


    return results;

}


/* =========================================================
   FALLBACK STATISTICS
========================================================= */

function calculateFallbackPackStats(
    words
) {

    const vocabulary =
        Array.isArray(words)
            ? words
            : [];


    const total =
        vocabulary.length;


    const mastered =
        vocabulary.filter(

            word =>
                Number(
                    word.mastery || 0
                ) >= 90

        ).length;


    const weak =
        vocabulary.filter(

            word => {

                const mastery =
                    Number(
                        word.mastery || 0
                    );

                return (
                    mastery > 0 &&
                    mastery < 40
                );

            }

        ).length;


    const masteryTotal =
        vocabulary.reduce(

            (sum, word) =>
                sum +
                Number(
                    word.mastery || 0
                ),

            0

        );


    return {

        total,

        learned:
            mastered,

        mastered,

        weak,

        averageMastery:
            total > 0
                ? Math.round(
                    masteryTotal /
                    total
                )
                : 0,

        progress:
            total > 0
                ? Math.round(
                    (
                        mastered /
                        total
                    ) *
                    100
                )
                : 0

    };

}


/* =========================================================
   IMPORT PACK METADATA
========================================================= */

/**
 * Import metadata without destroying existing metadata.
 *
 * Existing pack metadata is retained unless the incoming
 * property explicitly replaces it.
 */
async function importPackMetadata(
    metadata = {}
) {

    const packId =
        normalizePackId(
            metadata.packId
        );


    const existing =
        await getPack(
            packId
        );


    if (!existing) {

        return savePack(

            createPackRecord({

                ...metadata,

                packId

            })

        );

    }


    const mergedMetadata = {

        ...(existing.metadata || {}),

        ...(metadata.metadata || {})

    };


    const updated = {

        ...existing,

        ...metadata,

        packId:
            existing.packId,

        createdAt:
            existing.createdAt,

        metadata:
            mergedMetadata,

        updatedAt:
            new Date().toISOString()

    };


    return savePack(
        updated
    );

}


/* =========================================================
   IMPORT WORD PACK
========================================================= */

/**
 * Import a complete Word Pack.
 *
 * Expected structure can be either:
 *
 * {
 *   packId: "...",
 *   name: "...",
 *   metadata: {...},
 *   words: [...]
 * }
 *
 * or a V1.2-compatible object where words are supplied under
 * vocabulary / entries.
 */
async function importWordPack(
    packData
) {

    if (
        !packData ||
        typeof packData !== "object"
    ) {

        throw new Error(
            "Invalid Word Pack."
        );

    }


    const rawWords =
        packData.words ||
        packData.vocabulary ||
        packData.entries ||
        [];


    if (
        !Array.isArray(rawWords)
    ) {

        throw new Error(
            "Word Pack does not contain a valid word array."
        );

    }


    /*
     * IMPORTANT:
     *
     * Preserve the supplied packId if present.
     * Never generate a new ID when a packId already exists.
     */
    const suppliedPackId =
        packData.packId
            ? normalizePackId(
                packData.packId
            )
            : null;


    const pack =
        await ensurePack({

            packId:
                suppliedPackId,

            name:
                packData.name ||
                packData.packName ||
                DEFAULT_PACK_NAME,

            description:
                packData.description ||
                "",

            source:
                packData.source ||
                "import",

            type:
                PACK_TYPES.imported,

            metadata:
                packData.metadata ||
                {}

        });


    /*
     * Add/merge words.
     */
    let importedCount = 0;


    for (
        const rawWord of rawWords
    ) {

        if (
            !rawWord ||
            typeof rawWord !== "object"
        ) {

            continue;

        }


        /*
         * Preserve the original V1.2 word ID where possible.
         */
        const word = {

            ...rawWord,

            packId:
                pack.packId

        };


        /*
         * Only assign a new ID if absolutely necessary.
         */
        if (
            word.id === undefined ||
            word.id === null ||
            word.id === ""
        ) {

            word.id =
                generateWordId(
                    word.word ||
                    word.term ||
                    word.dutch ||
                    "word"
                );

        }


        /*
         * Preserve existing mastery/stats/history.
         */
        if (
            word.mastery === undefined
        ) {

            word.mastery = 0;

        }


        if (
            !word.stats
        ) {

            word.stats = {};

        }


        if (
            !Array.isArray(
                word.history
            )
        ) {

            word.history = [];

        }


        /*
         * A genuinely imported word with no practice history
         * remains new.
         */
        if (
            word.isNew === undefined
        ) {

            const stats =
                word.stats || {};

            const attempts =
                Number(
                    stats.correct || 0
                ) +
                Number(
                    stats.incorrect || 0
                );

            word.isNew =
                attempts === 0;

        }


        word.updatedAt =
            new Date().toISOString();


        await saveWord(
            word
        );

        importedCount++;

    }


    /*
     * Update metadata count.
     */
    pack.wordCount =
        await getPackWordCount(
            pack.packId
        );

    pack.updatedAt =
        new Date().toISOString();


    await savePack(
        pack
    );


    return {

        pack,

        importedCount,

        wordCount:
            pack.wordCount

    };

}


/* =========================================================
   WORD ID GENERATION
========================================================= */

function generateWordId(
    text
) {

    const base =
        String(
            text
        )
        .toLowerCase()
        .trim()
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        );


    return (

        base ||
        "word"

    ) +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random()
        .toString(36)
        .slice(2, 7);

}


/* =========================================================
   LEGACY V1.2 MIGRATION
========================================================= */

/**
 * Assign packId to old V1.2 vocabulary without changing the
 * actual vocabulary data.
 *
 * Existing words with a packId are left untouched.
 */
async function migrateLegacyVocabularyToPacks() {

    await ensureDefaultPack();


    const words =
        await getAllWords();


    if (!Array.isArray(words)) {

        return {

            migrated: 0,

            alreadyAssigned: 0

        };

    }


    let migrated = 0;
    let alreadyAssigned = 0;


    for (
        const word of words
    ) {

        if (
            word.packId !== undefined &&
            word.packId !== null &&
            String(
                word.packId
            ).trim() !== ""
        ) {

            alreadyAssigned++;

            continue;

        }


        /*
         * V1.2 may have stored pack information under several
         * legacy field names.
         */
        const legacyPackId =
            word.wordPackId ||
            word.pack ||
            word.packID ||
            null;


        if (legacyPackId) {

            word.packId =
                normalizePackId(
                    legacyPackId
                );

            /*
             * Create a pack record if the old data refers to a
             * pack that isn't in the new database yet.
             */
            await ensurePack({

                packId:
                    word.packId,

                name:
                    word.packName ||
                    word.packTitle ||
                    word.pack ||
                    word.packId,

                type:
                    PACK_TYPES.legacy,

                metadata:
                    word.packMetadata ||
                    {}

            });

        } else {

            /*
             * V1.2 words without pack information remain
             * available under the default pack.
             */
            word.packId =
                DEFAULT_PACK_ID;

        }


        word.updatedAt =
            word.updatedAt ||
            new Date().toISOString();


        await saveWord(
            word
        );

        migrated++;

    }


    await updatePackWordCounts();


    return {

        migrated,

        alreadyAssigned

    };

}


/* =========================================================
   PACK SUMMARY
========================================================= */

async function getPackSummary(
    packId
) {

    const pack =
        await getPack(
            packId
        );


    if (!pack) {

        return null;

    }


    const statistics =
        await getPackStatistics(
            pack.packId
        );


    return {

        ...pack,

        wordCount:
            statistics.wordCount,

        stats:
            statistics.stats,

        skills:
            statistics.skills

    };

}


/* =========================================================
   INITIALIZE PACK DATABASE
========================================================= */

async function initializePacks() {

    await ensureDefaultPack();

    /*
     * Migrate V1.2 words before calculating counts.
     */
    await migrateLegacyVocabularyToPacks();

    await updatePackWordCounts();


    console.log(
        "Word Pack database initialized."
    );

}


/* =========================================================
   PACK DATABASE DIAGNOSTICS
========================================================= */

async function getPackDatabaseSnapshot() {

    const packs =
        await getAllPacks();

    const statistics =
        await getAllPackStatistics();


    return {

        packs,

        statistics,

        count:
            packs.length

    };

}