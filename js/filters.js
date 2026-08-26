/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Vocabulary Selection / Filtering

   Responsibilities:
   - Resolve persistent vocabulary selection
   - Filter by:
       all
       pack
       new
       weak
       due
   - Combine filter + packId correctly
   - Provide vocabulary to Dashboard and Practice
   - Calculate selected-vocabulary statistics
   - Keep selection logic in one place
========================================================= */


/* =========================================================
   FILTER DEFINITIONS
========================================================= */

const VOCABULARY_FILTERS = {

    all: {
        id: "all",
        label: "All Vocabulary"
    },

    pack: {
        id: "pack",
        label: "Imported Word Pack"
    },

    new: {
        id: "new",
        label: "New Words"
    },

    weak: {
        id: "weak",
        label: "Weak Words"
    },

    due: {
        id: "due",
        label: "Due Words"
    }

};


/* =========================================================
   MASTERY THRESHOLDS
========================================================= */

/*
 * Keep these values centralized.
 *
 * Other V2 modules should use these constants instead of
 * hardcoding mastery ranges.
 */

const FILTER_THRESHOLDS = {

    weak: 40,

    learned: 90

};


/* =========================================================
   BASIC WORD VALIDATION
========================================================= */

function isValidVocabularyWord(word) {

    if (
        !word ||
        typeof word !== "object"
    ) {

        return false;

    }

    /*
     * A valid record needs at least an identifier.
     */
    return (
        word.id !== undefined &&
        word.id !== null
    );

}


/* =========================================================
   DATE HELPERS
========================================================= */

function isWordDue(word, now = Date.now()) {

    if (!word) {

        return false;

    }

    /*
     * Missing nextReview means the word should be available.
     */
    if (
        word.nextReview === undefined ||
        word.nextReview === null
    ) {

        return true;

    }

    let reviewDate =
        word.nextReview;

    /*
     * Support both numeric timestamps and date strings.
     */
    if (
        typeof reviewDate !== "number"
    ) {

        reviewDate =
            Date.parse(reviewDate);

    }

    if (
        Number.isNaN(reviewDate)
    ) {

        return true;

    }

    return reviewDate <= now;

}


/* =========================================================
   NEW WORD
========================================================= */

function isWordNew(word) {

    if (!word) {

        return false;

    }

    /*
     * V2.0 canonical field.
     */
    if (word.isNew === true) {

        return true;

    }

    /*
     * Compatibility with possible older records.
     */
    if (
        word.isNew === undefined ||
        word.isNew === null
    ) {

        const stats =
            word.stats || {};

        const attempts =
            Number(stats.correct || 0) +
            Number(stats.incorrect || 0);

        return attempts === 0;

    }

    return false;

}


/* =========================================================
   WEAK WORD
========================================================= */

function isWordWeak(word) {

    if (!word) {

        return false;

    }

    const mastery =
        Number(word.mastery || 0);

    return (
        mastery > 0 &&
        mastery < FILTER_THRESHOLDS.weak
    );

}


/* =========================================================
   LEARNED WORD
========================================================= */

function isWordLearned(word) {

    if (!word) {

        return false;

    }

    return (
        Number(word.mastery || 0) >=
        FILTER_THRESHOLDS.learned
    );

}


/* =========================================================
   PACK MATCH
========================================================= */

function wordBelongsToPack(
    word,
    packId
) {

    if (
        !word ||
        !packId ||
        packId === "all"
    ) {

        return true;

    }

    return String(word.packId || "") ===
        String(packId);

}


/* =========================================================
   FILTER MATCH
========================================================= */

function wordMatchesFilter(
    word,
    filter,
    now = Date.now()
) {

    switch (filter) {

        case "all":

            return true;


        case "pack":

            /*
             * "pack" itself means that the selected pack should
             * be applied separately by wordBelongsToPack().
             *
             * If no pack is selected, don't accidentally return
             * zero words.
             */
            return true;


        case "new":

            return isWordNew(word);


        case "weak":

            return isWordWeak(word);


        case "due":

            return isWordDue(
                word,
                now
            );


        default:

            return true;

    }

}


/* =========================================================
   RESOLVE SELECTION
========================================================= */

/**
 * Resolve a persistent selection into actual vocabulary.
 *
 * Example:
 *
 * {
 *     filter: "weak",
 *     packId: "travel-001"
 * }
 *
 * means:
 *
 * weak words belonging to travel-001
 */
async function getSelectedVocabulary(
    selection = null
) {

    const words =
        await getAllWords();

    if (!Array.isArray(words)) {

        return [];

    }

    const resolvedSelection =
        selection
            ? normalizeVocabularySelection(
                selection
            )
            : getVocabularySelection();

    return filterVocabulary(
        words,
        resolvedSelection
    );

}


/* =========================================================
   FILTER VOCABULARY
========================================================= */

function filterVocabulary(
    words,
    selection
) {

    if (!Array.isArray(words)) {

        return [];

    }

    const normalized =
        normalizeVocabularySelection(
            selection
        );

    const filter =
        normalized.filter;

    const packId =
        normalized.packId;

    const now =
        Date.now();

    return words.filter(word => {

        if (
            !isValidVocabularyWord(word)
        ) {

            return false;

        }

        /*
         * Pack selection:
         *
         * If the user selected a specific pack, always apply
         * that restriction regardless of the secondary filter.
         */
        if (
            packId !== "all" &&
            !wordBelongsToPack(
                word,
                packId
            )
        ) {

            return false;

        }

        /*
         * Then apply All / New / Weak / Due / Pack.
         */
        return wordMatchesFilter(
            word,
            filter,
            now
        );

    });

}


/* =========================================================
   SELECTION LABEL
========================================================= */

async function getSelectionLabel(
    selection = null
) {

    const resolved =
        selection
            ? normalizeVocabularySelection(
                selection
            )
            : getVocabularySelection();

    let filterLabel =
        VOCABULARY_FILTERS[
            resolved.filter
        ]?.label ||
        "All Vocabulary";

    /*
     * A specific pack makes the selection more descriptive.
     */
    if (
        resolved.packId !== "all"
    ) {

        try {

            const pack =
                await getPack(
                    resolved.packId
                );

            if (pack) {

                if (
                    resolved.filter === "all" ||
                    resolved.filter === "pack"
                ) {

                    return pack.name;

                }

                return `${filterLabel} · ${pack.name}`;

            }

        } catch (error) {

            console.warn(
                "Could not load selected pack:",
                error
            );

        }

    }

    return filterLabel;

}


/* =========================================================
   SELECTION COUNTS
========================================================= */

/**
 * Returns the number of words currently selected.
 */
async function getSelectedVocabularyCount(
    selection = null
) {

    const words =
        await getSelectedVocabulary(
            selection
        );

    return words.length;

}


/* =========================================================
   ALL VOCABULARY
========================================================= */

async function getAllVocabulary() {

    const words =
        await getAllWords();

    if (!Array.isArray(words)) {

        return [];

    }

    return words.filter(
        isValidVocabularyWord
    );

}


/* =========================================================
   AVAILABLE FILTER COUNTS
========================================================= */

/**
 * Calculate counts for the current pack selection.
 *
 * Example result:
 *
 * {
 *   all: 120,
 *   new: 35,
 *   weak: 17,
 *   due: 24
 * }
 */
async function getVocabularyFilterCounts(
    packId = "all"
) {

    const allWords =
        await getAllVocabulary();

    const scopedWords =
        packId === "all"
            ? allWords
            : allWords.filter(
                word =>
                    wordBelongsToPack(
                        word,
                        packId
                    )
            );

    const now =
        Date.now();

    return {

        all:
            scopedWords.length,

        pack:
            scopedWords.length,

        new:
            scopedWords.filter(
                word =>
                    isWordNew(word)
            ).length,

        weak:
            scopedWords.filter(
                word =>
                    isWordWeak(word)
            ).length,

        due:
            scopedWords.filter(
                word =>
                    isWordDue(
                        word,
                        now
                    )
            ).length,

        learned:
            scopedWords.filter(
                word =>
                    isWordLearned(word)
            ).length

    };

}


/* =========================================================
   SELECTED VOCABULARY STATISTICS
========================================================= */

/**
 * Dashboard and other modules should use this function rather
 * than independently calculating statistics.
 */
async function getSelectedVocabularyStats(
    selection = null
) {

    const words =
        await getSelectedVocabulary(
            selection
        );

    return calculateVocabularyStats(
        words
    );

}


/* =========================================================
   GENERIC VOCABULARY STATISTICS
========================================================= */

function calculateVocabularyStats(
    words
) {

    if (!Array.isArray(words)) {

        words = [];

    }

    const total =
        words.length;

    const learned =
        words.filter(
            word =>
                isWordLearned(word)
        ).length;

    const weak =
        words.filter(
            word =>
                isWordWeak(word)
        ).length;

    const due =
        words.filter(
            word =>
                isWordDue(word)
        ).length;

    const newWords =
        words.filter(
            word =>
                isWordNew(word)
        ).length;

    const masterySum =
        words.reduce(
            (sum, word) =>
                sum +
                Number(word.mastery || 0),
            0
        );

    const averageMastery =
        total > 0
            ? Math.round(
                masterySum / total
            )
            : 0;

    const correct =
        words.reduce(
            (sum, word) =>
                sum +
                Number(
                    word.stats?.correct || 0
                ),
            0
        );

    const incorrect =
        words.reduce(
            (sum, word) =>
                sum +
                Number(
                    word.stats?.incorrect || 0
                ),
            0
        );

    const attempts =
        correct + incorrect;

    const accuracy =
        attempts > 0
            ? Math.round(
                (correct / attempts) * 100
            )
            : 0;

    const progress =
        calculateProgressPercentage(
            words
        );

    return {

        total,

        learned,

        weak,

        due,

        new: newWords,

        averageMastery,

        progress,

        correct,

        incorrect,

        attempts,

        accuracy

    };

}


/* =========================================================
   PROGRESS
========================================================= */

/**
 * Progress means the proportion of selected vocabulary that
 * has reached the learned/mastered threshold.
 */
function calculateProgressPercentage(
    words
) {

    if (
        !Array.isArray(words) ||
        words.length === 0
    ) {

        return 0;

    }

    const learned =
        words.filter(
            word =>
                isWordLearned(word)
        ).length;

    return Math.round(
        (learned / words.length) * 100
    );

}


/* =========================================================
   SKILL STATISTICS
========================================================= */

/**
 * Calculate skill performance only from selected vocabulary.
 *
 * Each exercise has:
 *
 * correct / attempts
 */
function calculateSkillStats(
    words
) {

    const types = [

        "meaning",
        "recall",
        "fill",
        "choose",
        "production"

    ];

    const result = {};

    for (const type of types) {

        let correct = 0;
        let attempts = 0;

        for (const word of words || []) {

            const stats =
                word.stats || {};

            correct +=
                Number(
                    stats[type] || 0
                );

            attempts +=
                Number(
                    stats[
                        `${type}Attempts`
                    ] || 0
                );

        }

        /*
         * Compatibility fallback:
         *
         * If an older record has a correct count but not an
         * exercise-specific attempts counter, don't fabricate
         * an accuracy percentage.
         */
        const accuracy =
            attempts > 0
                ? Math.round(
                    (correct / attempts) * 100
                )
                : 0;

        result[type] = {

            correct,

            attempts,

            accuracy

        };

    }

    return result;

}


/* =========================================================
   COMPLETE SELECTED VOCABULARY SUMMARY
========================================================= */

async function getSelectedVocabularySummary(
    selection = null
) {

    const resolved =
        selection
            ? normalizeVocabularySelection(
                selection
            )
            : getVocabularySelection();

    const words =
        await getSelectedVocabulary(
            resolved
        );

    const stats =
        calculateVocabularyStats(
            words
        );

    const skills =
        calculateSkillStats(
            words
        );

    const label =
        await getSelectionLabel(
            resolved
        );

    return {

        selection:
            resolved,

        label,

        words,

        stats,

        skills

    };

}


/* =========================================================
   PACK VOCABULARY
========================================================= */

async function getVocabularyForPack(
    packId
) {

    if (
        !packId ||
        packId === "all"
    ) {

        return getAllVocabulary();

    }

    const words =
        await getAllVocabulary();

    return words.filter(
        word =>
            wordBelongsToPack(
                word,
                packId
            )
    );

}


/* =========================================================
   PACK IDS PRESENT IN VOCABULARY
========================================================= */

async function getVocabularyPackIds() {

    const words =
        await getAllVocabulary();

    const ids =
        new Set();

    for (const word of words) {

        if (word.packId) {

            ids.add(
                String(word.packId)
            );

        }

    }

    return Array.from(ids);

}


/* =========================================================
   PERSIST SELECTION FROM UI
========================================================= */

/**
 * Update both filter and pack selection at once.
 */
function updateVocabularySelection(
    filter,
    packId = "all"
) {

    const selection = {

        filter:
            normalizeVocabularyFilter(
                filter
            ),

        packId:
            packId || "all"

    };

    /*
     * A pack selection without the explicit "pack" filter is
     * allowed. It means "this pack, all words".
     */
    return saveVocabularySelection(
        selection
    );

}


/* =========================================================
   SELECTION VALIDATION
========================================================= */

/**
 * Verify that a selected pack still exists.
 *
 * If it doesn't, automatically fall back to all packs.
 */
async function validateVocabularySelection(
    selection = null
) {

    const normalized =
        selection
            ? normalizeVocabularySelection(
                selection
            )
            : getVocabularySelection();

    if (
        normalized.packId === "all"
    ) {

        return normalized;

    }

    const pack =
        await getPack(
            normalized.packId
        );

    if (!pack) {

        normalized.packId = "all";

        /*
         * If the selection was specifically "pack", falling
         * back to all vocabulary is safer than leaving a
         * selection that can return nothing.
         */
        if (
            normalized.filter === "pack"
        ) {

            normalized.filter = "all";

        }

        saveVocabularySelection(
            normalized
        );

    }

    return normalized;

}


/* =========================================================
   EMPTY SELECTION HANDLING
========================================================= */

/**
 * Useful for Practice.
 *
 * If the selected filter contains no words, provide a useful
 * diagnostic object instead of making the practice engine
 * guess what to do.
 */
async function getSelectionAvailability(
    selection = null
) {

    const resolved =
        await validateVocabularySelection(
            selection
        );

    const words =
        await getSelectedVocabulary(
            resolved
        );

    const label =
        await getSelectionLabel(
            resolved
        );

    return {

        available:
            words.length > 0,

        count:
            words.length,

        label,

        selection:
            resolved

    };

}