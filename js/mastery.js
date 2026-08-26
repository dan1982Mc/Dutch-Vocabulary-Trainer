/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Mastery Engine

   Responsibilities:
   - Update mastery after EVERY answer
   - Preserve V1.2 mastery/history data
   - Record answer history
   - Track performance by exercise type
   - Calculate accuracy
   - Update new / weak / due state
   - Schedule next review
   - Maintain packId association
   - Provide statistics for Dashboard
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const MASTERY_CONFIG = {

    /*
     * Existing mastery values remain valid.
     *
     * Correct answers increase mastery.
     * Incorrect answers decrease mastery.
     */
    correctDelta: 8,

    incorrectDelta: 10,

    /*
     * Small bonus for repeated correct performance.
     */
    consecutiveCorrectBonus: 2,

    /*
     * Maximum bonus that can be added by consecutive correct
     * answers.
     */
    maxConsecutiveBonus: 6,

    /*
     * Mastery limits.
     */
    minimumMastery: 0,

    maximumMastery: 100,

    /*
     * Weak threshold must match selection.js.
     */
    weakThreshold: 40,

    /*
     * Mastered threshold.
     */
    masteredThreshold: 90,

    /*
     * New words become learned after first answered question.
     */
    newAnswerCount: 0,

    /*
     * Review intervals in days.
     *
     * These are intentionally simple and deterministic.
     */
    intervals: {

        failed: 0,

        veryWeak: 1,

        weak: 2,

        developing: 4,

        familiar: 7,

        strong: 14,

        mastered: 30

    }

};


/* =========================================================
   EXERCISE WEIGHTS
========================================================= */

/**
 * Production and Recall require active retrieval and can
 * therefore carry slightly more weight.
 *
 * Meaning / Choose are recognition exercises.
 */
const EXERCISE_MASTERY_WEIGHTS = {

    meaning: 0.85,

    recall: 1.00,

    fill: 1.00,

    choose: 0.85,

    production: 1.10

};


/* =========================================================
   NORMALIZE MASTERY
========================================================= */

function normalizeMastery(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return 0;

    }


    return Math.round(

        Math.max(

            MASTERY_CONFIG.minimumMastery,

            Math.min(

                MASTERY_CONFIG.maximumMastery,

                number

            )

        )

    );

}


/* =========================================================
   GET WORD STATS
========================================================= */

function ensureWordStats(
    word
) {

    if (
        !word.stats ||
        typeof word.stats !== "object"
    ) {

        word.stats = {};

    }


    const stats =
        word.stats;


    /*
     * Preserve existing V1.2 fields while ensuring the V2
     * fields exist.
     */
    if (
        stats.attempts === undefined
    ) {

        stats.attempts = 0;

    }


    if (
        stats.correct === undefined
    ) {

        stats.correct = 0;

    }


    if (
        stats.incorrect === undefined
    ) {

        stats.incorrect = 0;

    }


    if (
        stats.accuracy === undefined
    ) {

        stats.accuracy = 0;

    }


    if (
        stats.consecutiveCorrect === undefined
    ) {

        stats.consecutiveCorrect = 0;

    }


    if (
        stats.consecutiveIncorrect === undefined
    ) {

        stats.consecutiveIncorrect = 0;

    }


    if (
        !stats.byExerciseType ||
        typeof stats.byExerciseType !== "object"
    ) {

        stats.byExerciseType = {};

    }


    for (
        const type of EXERCISE_TYPE_ORDER
    ) {

        if (
            !stats.byExerciseType[type]
        ) {

            stats.byExerciseType[type] = {

                attempts: 0,

                correct: 0,

                incorrect: 0,

                accuracy: 0

            };

        }

    }


    return stats;

}


/* =========================================================
   ENSURE HISTORY
========================================================= */

function ensureWordHistory(
    word
) {

    if (
        !Array.isArray(
            word.history
        )
    ) {

        /*
         * Preserve common V1.2 history field names.
         */
        if (
            Array.isArray(
                word.answerHistory
            )
        ) {

            word.history =
                word.answerHistory;

        } else if (
            Array.isArray(
                word.practiceHistory
            )
        ) {

            word.history =
                word.practiceHistory;

        } else {

            word.history = [];

        }

    }


    return word.history;

}


/* =========================================================
   EXERCISE STATS
========================================================= */

function getExerciseStats(
    word,
    exerciseType
) {

    const stats =
        ensureWordStats(
            word
        );


    const type =
        normalizeExerciseType(
            exerciseType
        );


    if (
        !stats.byExerciseType[type]
    ) {

        stats.byExerciseType[type] = {

            attempts: 0,

            correct: 0,

            incorrect: 0,

            accuracy: 0

        };

    }


    return stats.byExerciseType[type];

}


/* =========================================================
   CALCULATE ACCURACY
========================================================= */

function calculateAccuracy(
    correct,
    attempts
) {

    const total =
        Number(
            attempts || 0
        );


    if (
        total <= 0
    ) {

        return 0;

    }


    return Math.round(

        (
            Number(
                correct || 0
            ) /
            total
        ) *
        100

    );

}


/* =========================================================
   GET CURRENT MASTERY
========================================================= */

function getCurrentMastery(
    word
) {

    if (!word) {

        return 0;

    }


    return normalizeMastery(

        word.mastery ??
        word.masteryScore ??
        word.score ??
        0

    );

}


/* =========================================================
   GET MASTERY LEVEL
========================================================= */

function getMasteryLevel(
    mastery
) {

    const score =
        normalizeMastery(
            mastery
        );


    if (
        score >=
        MASTERY_CONFIG.masteredThreshold
    ) {

        return "mastered";

    }


    if (
        score >= 70
    ) {

        return "strong";

    }


    if (
        score >= 50
    ) {

        return "familiar";

    }


    if (
        score >= 40
    ) {

        return "developing";

    }


    if (
        score > 0
    ) {

        return "weak";

    }


    return "new";

}


/* =========================================================
   GET REVIEW INTERVAL
========================================================= */

function getReviewIntervalDays(
    mastery,
    correct
) {

    const score =
        normalizeMastery(
            mastery
        );


    /*
     * Failed answer should be reviewed very soon.
     */
    if (
        !correct
    ) {

        return MASTERY_CONFIG
            .intervals
            .failed;

    }


    const level =
        getMasteryLevel(
            score
        );


    return (

        MASTERY_CONFIG
            .intervals[level] ??
        MASTERY_CONFIG
            .intervals
            .developing

    );

}


/* =========================================================
   CALCULATE NEXT REVIEW DATE
========================================================= */

function calculateNextReview(
    mastery,
    correct,
    now = new Date()
) {

    const days =
        getReviewIntervalDays(

            mastery,

            correct

        );


    const date =
        new Date(
            now
        );


    /*
     * Failed answers can be due immediately.
     */
    date.setDate(

        date.getDate() +
        days

    );


    return date.toISOString();

}


/* =========================================================
   ANSWER DELTA
========================================================= */

function calculateMasteryDelta(
    word,
    correct,
    exerciseType
) {

    const stats =
        ensureWordStats(
            word
        );


    const type =
        normalizeExerciseType(
            exerciseType
        );


    const weight =
        EXERCISE_MASTERY_WEIGHTS[type] ??
        1;


    if (
        correct
    ) {

        const consecutive =
            Number(
                stats.consecutiveCorrect ||
                0
            );


        const bonus =
            Math.min(

                MASTERY_CONFIG
                    .maxConsecutiveBonus,

                consecutive *
                MASTERY_CONFIG
                    .consecutiveCorrectBonus

            );


        return Math.round(

            (
                MASTERY_CONFIG
                    .correctDelta +
                bonus
            ) *
            weight

        );

    }


    /*
     * Incorrect answers use a slightly stronger penalty so
     * weak vocabulary naturally returns to the review pool.
     */
    return Math.round(

        MASTERY_CONFIG
            .incorrectDelta *
        weight

    );

}


/* =========================================================
   APPLY MASTERY DELTA
========================================================= */

function applyMasteryDelta(
    word,
    delta
) {

    const current =
        getCurrentMastery(
            word
        );


    const next =
        normalizeMastery(

            delta >= 0

                ? current + delta

                : current - Math.abs(
                    delta
                )

        );


    word.mastery =
        next;


    /*
     * Keep common legacy fields synchronized where they
     * already exist.
     */
    if (
        word.masteryScore !== undefined
    ) {

        word.masteryScore =
            next;

    }


    if (
        word.score !== undefined
    ) {

        word.score =
            next;

    }


    return next;

}


/* =========================================================
   UPDATE NEW STATUS
========================================================= */

function updateNewStatus(
    word,
    stats
) {

    const attempts =
        Number(
            stats.attempts || 0
        );


    /*
     * A word is no longer "new" after its first answered
     * question.
     */
    word.isNew =
        attempts <=
        MASTERY_CONFIG.newAnswerCount;


    /*
     * Keep common legacy status field useful.
     */
    if (
        word.status !== undefined
    ) {

        word.status =
            word.isNew
                ? "new"
                : getMasteryLevel(
                    word.mastery
                );

    }


    return word.isNew;

}


/* =========================================================
   UPDATE WEAK STATUS
========================================================= */

function updateWeakStatus(
    word
) {

    word.isWeak =
        getCurrentMastery(
            word
        ) <
        MASTERY_CONFIG.weakThreshold;


    return word.isWeak;

}


/* =========================================================
   UPDATE DUE STATUS
========================================================= */

function updateDueStatus(
    word
) {

    const dueAt =
        word.dueAt ||
        word.nextReview ||
        word.nextReviewAt ||
        null;


    if (!dueAt) {

        word.isDue =
            false;

        return false;

    }


    const timestamp =
        new Date(
            dueAt
        ).getTime();


    if (
        Number.isNaN(
            timestamp
        )
    ) {

        word.isDue =
            false;

        return false;

    }


    word.isDue =
        timestamp <=
        Date.now();


    return word.isDue;

}


/* =========================================================
   UPDATE REVIEW SCHEDULE
========================================================= */

function updateReviewSchedule(
    word,
    correct
) {

    const nextReview =
        calculateNextReview(

            word.mastery,

            correct

        );


    /*
     * V2 canonical field.
     */
    word.dueAt =
        nextReview;


    /*
     * Preserve compatibility with V1.2 fields if present.
     */
    if (
        word.nextReview !== undefined
    ) {

        word.nextReview =
            nextReview;

    }


    if (
        word.nextReviewAt !== undefined
    ) {

        word.nextReviewAt =
            nextReview;

    }


    if (
        word.dueDate !== undefined
    ) {

        word.dueDate =
            nextReview;

    }


    word.isDue =
        false;


    return nextReview;

}


/* =========================================================
   RECORD HISTORY ENTRY
========================================================= */

function createHistoryEntry(
    word,
    exercise,
    answerData
) {

    const now =
        new Date().toISOString();


    const type =
        normalizeExerciseType(

            exercise?.type ??
            answerData?.exerciseType

        );


    return {

        timestamp:
            now,

        wordId:
            word.id ??
            null,

        packId:
            word.packId ??
            "default",

        exerciseType:
            type,

        correct:
            Boolean(
                answerData.correct
            ),

        userAnswer:
            answerData.userAnswer ??
            "",

        expectedAnswer:
            answerData.expectedAnswer ??
            "",

        masteryBefore:
            normalizeMastery(
                answerData.masteryBefore
            ),

        masteryAfter:
            normalizeMastery(
                answerData.masteryAfter
            ),

        masteryDelta:
            Number(
                answerData.masteryDelta ||
                0
            ),

        source:
            exercise?.source ??
            "fallback"

    };

}


/* =========================================================
   LIMIT HISTORY
========================================================= */

function trimHistory(
    word,
    maximum = 500
) {

    const history =
        ensureWordHistory(
            word
        );


    if (
        history.length >
        maximum
    ) {

        word.history =
            history.slice(
                history.length -
                maximum
            );

    }


    return word.history;

}


/* =========================================================
   UPDATE WORD AFTER ANSWER
========================================================= */

/**
 * CENTRAL FUNCTION
 *
 * This is called after every answer.
 */
async function updateWordAfterAnswer(
    word,
    answerData = {},
    exercise = null
) {

    if (!word) {

        throw new Error(
            "Cannot update mastery without a word."
        );

    }


    const correct =
        Boolean(
            answerData.correct
        );


    const exerciseType =
        normalizeExerciseType(

            exercise?.type ??
            answerData.exerciseType ??
            "meaning"

        );


    const stats =
        ensureWordStats(
            word
        );


    const exerciseStats =
        getExerciseStats(

            word,

            exerciseType

        );


    const masteryBefore =
        getCurrentMastery(
            word
        );


    /*
     * -------------------------------------------------------
     * GENERAL STATS
     * -------------------------------------------------------
     */

    stats.attempts =
        Number(
            stats.attempts
        ) + 1;


    if (correct) {

        stats.correct =
            Number(
                stats.correct
            ) + 1;

        stats.consecutiveCorrect =
            Number(
                stats.consecutiveCorrect
            ) + 1;

        stats.consecutiveIncorrect =
            0;

    } else {

        stats.incorrect =
            Number(
                stats.incorrect
            ) + 1;

        stats.consecutiveIncorrect =
            Number(
                stats.consecutiveIncorrect
            ) + 1;

        stats.consecutiveCorrect =
            0;

    }


    stats.accuracy =
        calculateAccuracy(

            stats.correct,

            stats.attempts

        );


    /*
     * -------------------------------------------------------
     * EXERCISE-SPECIFIC STATS
     * -------------------------------------------------------
     */

    exerciseStats.attempts =
        Number(
            exerciseStats.attempts
        ) + 1;


    if (correct) {

        exerciseStats.correct =
            Number(
                exerciseStats.correct
            ) + 1;

    } else {

        exerciseStats.incorrect =
            Number(
                exerciseStats.incorrect
            ) + 1;

    }


    exerciseStats.accuracy =
        calculateAccuracy(

            exerciseStats.correct,

            exerciseStats.attempts

        );


    /*
     * -------------------------------------------------------
     * MASTERY
     * -------------------------------------------------------
     */

    const masteryDelta =
        calculateMasteryDelta(

            word,

            correct,

            exerciseType

        );


    const masteryAfter =
        applyMasteryDelta(

            word,

            correct
                ? masteryDelta
                : -masteryDelta

        );


    /*
     * -------------------------------------------------------
     * STATE FLAGS
     * -------------------------------------------------------
     */

    updateNewStatus(
        word,
        stats
    );


    updateWeakStatus(
        word
    );


    /*
     * -------------------------------------------------------
     * REVIEW DATE
     * -------------------------------------------------------
     */

    const nextReview =
        updateReviewSchedule(

            word,

            correct

        );


    /*
     * -------------------------------------------------------
     * HISTORY
     * -------------------------------------------------------
     */

    const historyEntry =
        createHistoryEntry(

            word,

            exercise,

            {

                ...answerData,

                correct,

                exerciseType,

                masteryBefore,

                masteryAfter,

                masteryDelta:
                    correct
                        ? masteryDelta
                        : -masteryDelta,

                expectedAnswer:
                    answerData.expectedAnswer ??
                    exercise?.correctAnswer ??
                    "",

                userAnswer:
                    answerData.userAnswer ??
                    ""

            }

        );


    const history =
        ensureWordHistory(
            word
        );


    history.push(
        historyEntry
    );


    trimHistory(
        word
    );


    /*
     * -------------------------------------------------------
     * TIMESTAMPS
     * -------------------------------------------------------
     */

    const now =
        new Date().toISOString();


    word.lastPracticedAt =
        now;


    word.lastAnswerAt =
        now;


    word.updatedAt =
        now;


    word.lastExerciseType =
        exerciseType;


    word.lastAnswerCorrect =
        correct;


    /*
     * Keep due state consistent.
     */
    word.isDue =
        false;


    /*
     * -------------------------------------------------------
     * SAVE
     * -------------------------------------------------------
     */

    if (
        typeof saveWord ===
        "function"
    ) {

        await saveWord(
            word
        );

    }


    /*
     * Return everything needed by the Practice UI.
     */
    return {

        word,

        correct,

        exerciseType,

        masteryBefore,

        masteryAfter,

        masteryDelta:
            correct
                ? masteryDelta
                : -masteryDelta,

        nextReview,

        stats: {

            ...stats,

            byExerciseType: {

                ...stats.byExerciseType

            }

        },

        historyEntry

    };

}


/* =========================================================
   GET WORD ACCURACY
========================================================= */

function getWordAccuracy(
    word
) {

    if (!word) {

        return 0;

    }


    const stats =
        ensureWordStats(
            word
        );


    return calculateAccuracy(

        stats.correct,

        stats.attempts

    );

}


/* =========================================================
   GET EXERCISE ACCURACY
========================================================= */

function getWordExerciseAccuracy(
    word,
    exerciseType
) {

    if (!word) {

        return 0;

    }


    const stats =
        getExerciseStats(

            word,

            exerciseType

        );


    return calculateAccuracy(

        stats.correct,

        stats.attempts

    );

}


/* =========================================================
   GET WORD STATUS
========================================================= */

function getWordMasteryStatus(
    word
) {

    if (!word) {

        return "new";

    }


    if (
        isVocabularyWordNew &&
        isVocabularyWordNew(
            word
        )
    ) {

        return "new";

    }


    return getMasteryLevel(
        word.mastery
    );

}


/* =========================================================
   GET WORD PRACTICE SUMMARY
========================================================= */

function getWordPracticeSummary(
    word
) {

    if (!word) {

        return null;

    }


    const stats =
        ensureWordStats(
            word
        );


    return {

        wordId:
            word.id ??
            null,

        packId:
            word.packId ??
            "default",

        mastery:
            getCurrentMastery(
                word
            ),

        status:
            getMasteryLevel(
                word.mastery
            ),

        isNew:
            Boolean(
                word.isNew
            ),

        isWeak:
            Boolean(
                word.isWeak
            ),

        isDue:
            Boolean(
                word.isDue
            ),

        attempts:
            Number(
                stats.attempts
            ),

        correct:
            Number(
                stats.correct
            ),

        incorrect:
            Number(
                stats.incorrect
            ),

        accuracy:
            Number(
                stats.accuracy
            ),

        lastPracticedAt:
            word.lastPracticedAt ||
            null,

        dueAt:
            word.dueAt ||
            null

    };

}


/* =========================================================
   RECALCULATE WORD STATE
========================================================= */

/**
 * Useful when loading V1.2 data into V2.0.
 *
 * It recalculates flags without changing mastery.
 */
function recalculateWordMasteryState(
    word
) {

    if (!word) {

        return null;

    }


    const stats =
        ensureWordStats(
            word
        );


    word.mastery =
        getCurrentMastery(
            word
        );


    updateNewStatus(
        word,
        stats
    );


    updateWeakStatus(
        word
    );


    updateDueStatus(
        word
    );


    stats.accuracy =
        calculateAccuracy(

            stats.correct,

            stats.attempts

        );


    return word;

}


/* =========================================================
   RECALCULATE ALL WORDS
========================================================= */

async function recalculateAllMasteryStates() {

    if (
        typeof getAllWords !==
        "function"
    ) {

        return {

            processed: 0

        };

    }


    const words =
        await getAllWords();


    let processed = 0;


    for (
        const word of words
    ) {

        recalculateWordMasteryState(
            word
        );


        if (
            typeof saveWord ===
            "function"
        ) {

            await saveWord(
                word
            );

        }


        processed++;

    }


    return {

        processed

    };

}


/* =========================================================
   GLOBAL VOCABULARY STATISTICS
========================================================= */

function calculateVocabularyStats(
    words
) {

    const vocabulary =
        Array.isArray(words)
            ? words
            : [];


    const total =
        vocabulary.length;


    if (
        total === 0
    ) {

        return {

            total: 0,

            attempted: 0,

            newWords: 0,

            weak: 0,

            due: 0,

            mastered: 0,

            averageMastery: 0,

            accuracy: 0,

            progress: 0

        };

    }


    let masteryTotal = 0;

    let attempts = 0;

    let correct = 0;

    let newWords = 0;

    let weak = 0;

    let due = 0;

    let mastered = 0;


    for (
        const word of vocabulary
    ) {

        const stats =
            ensureWordStats(
                word
            );


        const mastery =
            getCurrentMastery(
                word
            );


        masteryTotal +=
            mastery;


        attempts +=
            Number(
                stats.attempts ||
                0
            );


        correct +=
            Number(
                stats.correct ||
                0
            );


        if (
            isVocabularyWordNew &&
            isVocabularyWordNew(
                word
            )
        ) {

            newWords++;

        }


        if (
            getCurrentMastery(
                word
            ) <
            MASTERY_CONFIG.weakThreshold
        ) {

            weak++;

        }


        if (
            isVocabularyWordDue &&
            isVocabularyWordDue(
                word
            )
        ) {

            due++;

        }


        if (
            mastery >=
            MASTERY_CONFIG.masteredThreshold
        ) {

            mastered++;

        }

    }


    const attempted =
        vocabulary.filter(

            word =>
                Number(
                    word.stats?.attempts ||
                    0
                ) > 0

        ).length;


    return {

        total,

        attempted,

        newWords,

        weak,

        due,

        mastered,

        averageMastery:
            Math.round(
                masteryTotal /
                total
            ),

        accuracy:
            calculateAccuracy(
                correct,
                attempts
            ),

        progress:
            Math.round(
                (
                    mastered /
                    total
                ) *
                100
            )

    };

}


/* =========================================================
   SKILL STATISTICS
========================================================= */

/**
 * Skills are calculated from the supplied vocabulary only.
 *
 * Therefore Dashboard can pass the selected vocabulary and
 * skills automatically represent the current selection.
 */
function calculateSkillStats(
    words
) {

    const vocabulary =
        Array.isArray(words)
            ? words
            : [];


    const skills = {};


    for (
        const type of EXERCISE_TYPE_ORDER
    ) {

        let attempts = 0;

        let correct = 0;


        for (
            const word of vocabulary
        ) {

            const exerciseStats =
                word.stats
                    ?.byExerciseType
                    ?.[
                        type
                    ];


            if (
                !exerciseStats
            ) {

                continue;

            }


            attempts +=
                Number(
                    exerciseStats.attempts ||
                    0
                );


            correct +=
                Number(
                    exerciseStats.correct ||
                    0
                );

        }


        skills[type] = {

            type,

            label:
                getExerciseDisplayTitle(
                    type
                ),

            attempts,

            correct,

            accuracy:
                calculateAccuracy(
                    correct,
                    attempts
                )

        };

    }


    return skills;

}


/* =========================================================
   PER-PACK STATISTICS
========================================================= */

function calculatePackStatistics(
    words
) {

    const vocabulary =
        Array.isArray(words)
            ? words
            : [];


    const grouped =
        {};


    for (
        const word of vocabulary
    ) {

        const packId =
            String(
                word.packId ||
                "default"
            );


        if (
            !grouped[packId]
        ) {

            grouped[packId] = [];

        }


        grouped[packId].push(
            word
        );

    }


    const result =
        {};


    for (
        const [packId, packWords]
        of Object.entries(
            grouped
        )
    ) {

        result[packId] = {

            packId,

            stats:
                calculateVocabularyStats(
                    packWords
                ),

            skills:
                calculateSkillStats(
                    packWords
                )

        };

    }


    return result;

}


/* =========================================================
   MASTERY CHANGE PREVIEW
========================================================= */

/**
 * Used by the feedback UI before/after saving.
 */
function previewMasteryChange(
    word,
    correct,
    exerciseType
) {

    const current =
        getCurrentMastery(
            word
        );


    const delta =
        calculateMasteryDelta(

            word,

            correct,

            exerciseType

        );


    const next =
        applyPreviewDelta(
            current,
            correct
                ? delta
                : -delta
        );


    return {

        before:
            current,

        delta:
            correct
                ? delta
                : -delta,

        after:
            next

    };

}


/* =========================================================
   APPLY PREVIEW DELTA
========================================================= */

function applyPreviewDelta(
    mastery,
    delta
) {

    return normalizeMastery(

        Number(
            mastery || 0
        ) +
        Number(
            delta || 0
        )

    );

}


/* =========================================================
   INITIALIZE EXISTING DATA
========================================================= */

async function initializeMasteryData() {

    if (
        typeof getAllWords !==
        "function"
    ) {

        return {

            processed: 0

        };

    }


    const words =
        await getAllWords();


    let processed = 0;


    for (
        const word of words
    ) {

        /*
         * This only fills missing fields and recalculates
         * state. It does NOT reset mastery.
         */
        recalculateWordMasteryState(
            word
        );


        if (
            typeof saveWord ===
            "function"
        ) {

            await saveWord(
                word
            );

        }


        processed++;

    }


    return {

        processed

    };

}