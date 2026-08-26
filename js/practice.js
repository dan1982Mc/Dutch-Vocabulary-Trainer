/* =========================================================
   DUTCH TRAINER V2.0
   js/practice.js

   Practice session engine.

   Responsibilities:
   - Start Practice
   - Full Practice setup
   - Five exercise types
   - Mixed Practice
   - Controlled Mixed distribution
   - Persistent vocabulary selection
   - Question count
   - Answer checking
   - Feedback after every answer
   - Mastery update after every answer
   - Scheduling after every answer
   - Typed-answer similarity checking
   - Enter = Check Answer
   - Enter again = Next Question
   - Session completion
   - Imported AI exercises
   - Pack-aware statistics
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const PRACTICE_EXERCISE_TYPES = {

    MEANING:
        "meaning",

    RECALL:
        "recall",

    FILL_SENTENCE:
        "fill-sentence",

    CHOOSE_WORD:
        "choose-word",

    PRODUCTION:
        "production",

    MIXED:
        "mixed"

};


const PRACTICE_MODES = {

    START:
        "start",

    FULL:
        "full"

};


const PRACTICE_DEFAULTS = {

    questionCount:
        10,

    exerciseType:
        PRACTICE_EXERCISE_TYPES.MEANING,

    mode:
        PRACTICE_MODES.FULL,

    feedback:
        true,

    mixedDistribution:
        "balanced"

};


/* =========================================================
   SESSION STATE
========================================================= */

const PracticeState = {

    active:
        false,

    mode:
        PRACTICE_MODES.FULL,

    exerciseType:
        PRACTICE_EXERCISE_TYPES.MEANING,

    questionCount:
        PRACTICE_DEFAULTS.questionCount,

    questions:
        [],

    currentIndex:
        0,

    currentQuestion:
        null,

    currentExercise:
        null,

    currentWord:
        null,

    currentAnswer:
        null,

    answered:
        false,

    feedback:
        null,

    completed:
        false,

    startedAt:
        null,

    completedAt:
        null,

    correctCount:
        0,

    incorrectCount:
        0,

    answerCount:
        0,

    selectedVocabulary:
        [],

    selectedVocabularyIds:
        [],

    selectedPackId:
        null,

    vocabularySource:
        "all",

    mixedTypes:
        [],

    results:
        [],

    sessionId:
        null,

    lastAnswerAt:
        null

};


/* =========================================================
   EVENT HANDLERS
========================================================= */

const PracticeListeners = {

    answer:
        [],

    feedback:
        [],

    next:
        [],

    complete:
        [],

    start:
        [],

    state:
        []

};


/* =========================================================
   UTILITY
========================================================= */

function practiceClone(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return value;

    }


    try {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    } catch (
        error
    ) {

        return value;

    }

}


function practiceNow() {

    return new Date();

}


function practiceNowISO() {

    return practiceNow()
        .toISOString();

}


function practiceNormalizeCount(
    value
) {

    const count =
        Number(
            value
        );


    if (
        !Number.isFinite(
            count
        )
    ) {

        return PRACTICE_DEFAULTS.questionCount;

    }


    return Math.max(

        1,

        Math.min(
            500,
            Math.floor(
                count
            )
        )

    );

}


/* =========================================================
   ID HELPERS
========================================================= */

function practiceGetWordId(
    word
) {

    if (
        !word
    ) {

        return null;

    }


    return (

        word.id ??

        word.wordId ??

        word.uuid ??

        null

    );

}


function practiceGetPackId(
    word
) {

    if (
        !word
    ) {

        return null;

    }


    return (

        word.packId ??

        word.wordPackId ??

        word.pack?.id ??

        null

    );

}


/* =========================================================
   TEXT HELPERS
========================================================= */

function practiceNormalizeText(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(
        value
    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        );

}


function practiceCleanText(
    value
) {

    return String(
        value ?? ""
    )
        .trim();

}


/* =========================================================
   WORD FIELD HELPERS
========================================================= */

function practiceGetDutch(
    word
) {

    if (
        !word
    ) {

        return "";

    }


    return (

        word.dutch ??

        word.word ??

        word.term ??

        word.expression ??

        word.text ??

        ""

    );

}


function practiceGetMeaning(
    word
) {

    if (
        !word
    ) {

        return "";

    }


    return (

        word.meaning ??

        word.translation ??

        word.english ??

        word.definition ??

        ""

    );

}


function practiceGetExampleSentence(
    word
) {

    if (
        !word
    ) {

        return "";

    }


    return (

        word.exampleSentence ??

        word.example ??

        word.sentence ??

        word.context ??

        ""

    );

}


/* =========================================================
   ACCEPTED ANSWERS
========================================================= */

function practiceGetAcceptedAnswers(
    word,
    exercise = null
) {

    const values = [];


    if (
        exercise
    ) {

        if (
            Array.isArray(
                exercise.acceptedAnswers
            )
        ) {

            values.push(
                ...exercise.acceptedAnswers
            );

        }


        if (
            exercise.answer !==
            undefined
        ) {

            values.push(
                exercise.answer
            );

        }


        if (
            exercise.correctAnswer !==
            undefined
        ) {

            values.push(
                exercise.correctAnswer
            );

        }

    }


    if (
        word
    ) {

        if (
            Array.isArray(
                word.acceptedAnswers
            )
        ) {

            values.push(
                ...word.acceptedAnswers
            );

        }


        if (
            Array.isArray(
                word.answers
            )
        ) {

            values.push(
                ...word.answers
            );

        }


        if (
            Array.isArray(
                word.synonyms
            )
        ) {

            values.push(
                ...word.synonyms
            );

        }

    }


    const meaning =
        practiceGetMeaning(
            word
        );


    if (
        meaning
    ) {

        values.push(
            meaning
        );

    }


    return [

        ...new Set(

            values

                .filter(
                    value =>
                        value !==
                        null &&
                        value !==
                        undefined &&
                        String(
                            value
                        ).trim()
                )

                .map(
                    value =>
                        String(
                            value
                        ).trim()
                )

        )

    ];

}


/* =========================================================
   SIMILARITY
========================================================= */

function practiceSimilarity(
    answer,
    expected
) {

    const userAnswer =
        practiceNormalizeText(
            answer
        );


    const expectedAnswer =
        practiceNormalizeText(
            expected
        );


    if (
        !userAnswer ||
        !expectedAnswer
    ) {

        return 0;

    }


    /*
     * Use the project's existing similarity implementation.
     */
    if (
        typeof calculateSimilarity ===
        "function"
    ) {

        return Number(
            calculateSimilarity(
                userAnswer,
                expectedAnswer
            )
        );

    }


    if (
        typeof getSimilarityScore ===
        "function"
    ) {

        return Number(
            getSimilarityScore(
                userAnswer,
                expectedAnswer
            )
        );

    }


    if (
        window.DutchTrainerSimilarity
    ) {

        const similarity =
            window.DutchTrainerSimilarity;


        if (
            typeof similarity.calculate ===
            "function"
        ) {

            return Number(
                similarity.calculate(
                    userAnswer,
                    expectedAnswer
                )
            );

        }


        if (
            typeof similarity.score ===
            "function"
        ) {

            return Number(
                similarity.score(
                    userAnswer,
                    expectedAnswer
                )
            );

        }

    }


    /*
     * Safe fallback.
     *
     * This should normally not be reached because similarity.js
     * is part of V2.
     */
    return (
        userAnswer ===
        expectedAnswer
            ? 1
            : 0
    );

}


/* =========================================================
   SIMILARITY THRESHOLD
========================================================= */

function practiceGetSimilarityThreshold() {

    /*
     * Reuse the existing similarity.js threshold whenever
     * it exposes one.
     */
    if (
        window.DutchTrainerSimilarity
    ) {

        const similarity =
            window.DutchTrainerSimilarity;


        if (
            Number.isFinite(
                Number(
                    similarity.threshold
                )
            )
        ) {

            return Number(
                similarity.threshold
            );

        }


        if (
            Number.isFinite(
                Number(
                    similarity.config?.threshold
                )
            )
        ) {

            return Number(
                similarity.config.threshold
            );

        }

    }


    if (
        Number.isFinite(
            Number(
                window.SIMILARITY_THRESHOLD
            )
        )
    ) {

        return Number(
            window.SIMILARITY_THRESHOLD
        );

    }


    /*
     * V2 default.
     */
    return 0.75;

}


/* =========================================================
   TYPED ANSWER CHECK
========================================================= */

function practiceCheckTypedAnswer(
    answer,
    acceptedAnswers
) {

    const cleanAnswer =
        practiceCleanText(
            answer
        );


    if (
        !cleanAnswer
    ) {

        return {

            correct:
                false,

            score:
                0,

            matchedAnswer:
                null,

            empty:
                true

        };

    }


    const answers =
        Array.isArray(
            acceptedAnswers
        )
            ? acceptedAnswers
            : [
                acceptedAnswers
            ];


    let bestScore =
        0;

    let bestAnswer =
        null;


    for (
        const expected
        of answers
    ) {

        if (
            expected ===
            null ||
            expected ===
            undefined
        ) {

            continue;

        }


        const expectedText =
            practiceCleanText(
                expected
            );


        if (
            !expectedText
        ) {

            continue;

        }


        const score =
            practiceSimilarity(

                cleanAnswer,

                expectedText

            );


        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            bestAnswer =
                expectedText;

        }

    }


    const threshold =
        practiceGetSimilarityThreshold();


    return {

        correct:
            bestScore >=
            threshold,

        score:
            bestScore,

        threshold,

        matchedAnswer:
            bestAnswer,

        empty:
            false

    };

}


/* =========================================================
   MULTIPLE CHOICE CHECK
========================================================= */

function practiceCheckChoiceAnswer(
    answer,
    expected
) {

    const user =
        practiceNormalizeText(
            answer
        );


    const correct =
        practiceNormalizeText(
            expected
        );


    return {

        correct:
            Boolean(
                user &&
                correct &&
                user ===
                correct
            ),

        score:
            user ===
            correct
                ? 1
                : 0,

        threshold:
            1,

        matchedAnswer:
            expected

    };

}


/* =========================================================
   EXERCISE TYPE NORMALIZATION
========================================================= */

function normalizePracticeExerciseType(
    type
) {

    if (
        !type
    ) {

        return PRACTICE_EXERCISE_TYPES.MEANING;

    }


    const value =
        String(
            type
        )
            .trim()
            .toLowerCase()
            .replace(
                /[_\s]+/g,
                "-"
            );


    const aliases = {

        meaning:
            PRACTICE_EXERCISE_TYPES.MEANING,

        translation:
            PRACTICE_EXERCISE_TYPES.MEANING,

        recall:
            PRACTICE_EXERCISE_TYPES.RECALL,

        "free-recall":
            PRACTICE_EXERCISE_TYPES.RECALL,

        sentence:
            PRACTICE_EXERCISE_TYPES.FILL_SENTENCE,

        "fill-sentence":
            PRACTICE_EXERCISE_TYPES.FILL_SENTENCE,

        fill:
            PRACTICE_EXERCISE_TYPES.FILL_SENTENCE,

        "fill-in-the-blank":
            PRACTICE_EXERCISE_TYPES.FILL_SENTENCE,

        choose:
            PRACTICE_EXERCISE_TYPES.CHOOSE_WORD,

        "choose-word":
            PRACTICE_EXERCISE_TYPES.CHOOSE_WORD,

        choice:
            PRACTICE_EXERCISE_TYPES.CHOOSE_WORD,

        production:
            PRACTICE_EXERCISE_TYPES.PRODUCTION,

        produce:
            PRACTICE_EXERCISE_TYPES.PRODUCTION,

        mixed:
            PRACTICE_EXERCISE_TYPES.MIXED

    };


    return (

        aliases[value] ??

        value

    );

}


/* =========================================================
   EXERCISE TYPE LIST
========================================================= */

function getPracticeExerciseTypes() {

    return [

        PRACTICE_EXERCISE_TYPES.MEANING,

        PRACTICE_EXERCISE_TYPES.RECALL,

        PRACTICE_EXERCISE_TYPES.FILL_SENTENCE,

        PRACTICE_EXERCISE_TYPES.CHOOSE_WORD,

        PRACTICE_EXERCISE_TYPES.PRODUCTION

    ];

}


/* =========================================================
   MIXED DISTRIBUTION
========================================================= */

/*
 * Mixed Practice must distribute the five exercise types
 * deliberately.
 *
 * For example:
 *
 * 5 questions:
 *   Meaning
 *   Recall
 *   Fill Sentence
 *   Choose Word
 *   Production
 *
 * 10 questions:
 *   each type twice
 *
 * 7 questions:
 *   first two types get 2 questions,
 *   remaining three get 1.
 *
 * This is NOT random uncontrolled mixing.
 */
function buildMixedExerciseTypes(
    questionCount
) {

    const count =
        practiceNormalizeCount(
            questionCount
        );


    const types =
        getPracticeExerciseTypes();


    const result = [];


    for (
        let index = 0;
        index < count;
        index++
    ) {

        result.push(

            types[
                index %
                types.length
            ]

        );

    }


    return result;

}


/* =========================================================
   SHUFFLE
========================================================= */

function practiceShuffle(
    array
) {

    const result = [
        ...array
    ];


    for (
        let i =
            result.length - 1;

        i > 0;

        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            result[i],
            result[j]
        ] = [

            result[j],
            result[i]

        ];

    }


    return result;

}


/* =========================================================
   GET ALL WORDS
========================================================= */

async function practiceGetAllWords() {

    if (
        typeof getAllWords ===
        "function"
    ) {

        const words =
            await getAllWords();


        return Array.isArray(
            words
        )
            ? words
            : [];

    }


    if (
        window.DutchTrainerDB &&
        typeof window.DutchTrainerDB.getAllWords ===
        "function"
    ) {

        const words =
            await window.DutchTrainerDB
                .getAllWords();


        return Array.isArray(
            words
        )
            ? words
            : [];

    }


    if (
        window.DutchTrainerStorage &&
        typeof window.DutchTrainerStorage.getAllWords ===
        "function"
    ) {

        const words =
            await window.DutchTrainerStorage
                .getAllWords();


        return Array.isArray(
            words
        )
            ? words
            : [];

    }


    return [];

}


/* =========================================================
   PERSIST WORD
========================================================= */

async function practiceSaveWord(
    word
) {

    if (
        !word
    ) {

        return null;

    }


    if (
        typeof saveWord ===
        "function"
    ) {

        return await saveWord(
            word
        );

    }


    if (
        typeof upsertWord ===
        "function"
    ) {

        return await upsertWord(
            word
        );

    }


    if (
        window.DutchTrainerDB &&
        typeof window.DutchTrainerDB.saveWord ===
        "function"
    ) {

        return await window.DutchTrainerDB
            .saveWord(
                word
            );

    }


    return word;

}


/* =========================================================
   SELECTION STORAGE
========================================================= */

function practiceGetStoredSelection() {

    /*
     * selection.js is the canonical owner.
     */
    if (
        window.DutchTrainerSelection
    ) {

        const selection =
            window.DutchTrainerSelection;


        if (
            typeof selection.getSelection ===
            "function"
        ) {

            return selection.getSelection();

        }


        if (
            typeof selection.getSelectedVocabulary ===
            "function"
        ) {

            return selection.getSelectedVocabulary();

        }

    }


    /*
     * Compatibility with global functions.
     */
    if (
        typeof getVocabularySelection ===
        "function"
    ) {

        return getVocabularySelection();

    }


    return null;

}


/* =========================================================
   SAVE SELECTION
========================================================= */

function practiceSaveSelection(
    selection
) {

    if (
        !selection
    ) {

        return;

    }


    if (
        window.DutchTrainerSelection
    ) {

        const manager =
            window.DutchTrainerSelection;


        if (
            typeof manager.setSelection ===
            "function"
        ) {

            manager.setSelection(
                selection
            );

            return;

        }


        if (
            typeof manager.saveSelection ===
            "function"
        ) {

            manager.saveSelection(
                selection
            );

            return;

        }

    }


    if (
        typeof saveVocabularySelection ===
        "function"
    ) {

        saveVocabularySelection(
            selection
        );

    }

}


/* =========================================================
   NORMALIZE SELECTION
========================================================= */

function normalizePracticeSelection(
    selection
) {

    if (
        !selection
    ) {

        return {

            source:
                "all",

            packId:
                null,

            wordIds:
                [],

            persistent:
                true

        };

    }


    return {

        source:

            selection.source ??

            selection.type ??

            selection.category ??

            "all",

        packId:

            selection.packId ??

            selection.wordPackId ??

            null,

        wordIds:

            Array.isArray(
                selection.wordIds
            )
                ? [
                    ...selection.wordIds
                ]
                : Array.isArray(
                    selection.ids
                )
                    ? [
                        ...selection.ids
                    ]
                    : [],

        persistent:
            selection.persistent !==
            false

    };

}


/* =========================================================
   APPLY VOCABULARY SELECTION
========================================================= */

async function resolvePracticeVocabulary(
    options = {}
) {

    const allWords =
        await practiceGetAllWords();


    let selection =
        options.selection ??
        practiceGetStoredSelection();


    selection =
        normalizePracticeSelection(
            selection
        );


    /*
     * Explicit options override persistent selection.
     */
    if (
        options.source
    ) {

        selection.source =
            options.source;

    }


    if (
        options.packId !==
        undefined
    ) {

        selection.packId =
            options.packId;

    }


    if (
        Array.isArray(
            options.wordIds
        )
    ) {

        selection.wordIds =
            [
                ...options.wordIds
            ];

    }


    let words =
        [];


    const source =
        String(
            selection.source ||
            "all"
        )
            .toLowerCase();


    /*
     * ALL
     */
    if (
        source ===
        "all"
    ) {

        words =
            [
                ...allWords
            ];

    }


    /*
     * IMPORTED WORD PACK
     */
    else if (
        source ===
            "pack" ||
        source ===
            "imported" ||
        source ===
            "word-pack" ||
        source ===
            "wordpack"
    ) {

        const packId =
            selection.packId;


        if (
            packId !==
            null &&
            packId !==
            undefined
        ) {

            words =
                allWords.filter(

                    word =>
                        String(
                            practiceGetPackId(
                                word
                            )
                        ) ===
                        String(
                            packId
                        )

                );

        }

    }


    /*
     * NEW
     */
    else if (
        source ===
        "new"
    ) {

        if (
            typeof getNewWords ===
            "function"
        ) {

            words =
                getNewWords(
                    allWords
                );

        } else {

            words =
                allWords.filter(

                    word =>
                        word.isNew ===
                        true ||
                        Number(
                            word.attempts ??
                            0
                        ) ===
                        0

                );

        }

    }


    /*
     * WEAK
     */
    else if (
        source ===
        "weak"
    ) {

        if (
            typeof getWeakWords ===
            "function"
        ) {

            words =
                getWeakWords(
                    allWords
                );

        } else {

            words =
                allWords.filter(

                    word =>
                        Number(
                            word.mastery ??
                            word.masteryScore ??
                            0
                        ) <
                        40

                );

        }

    }


    /*
     * DUE
     */
    else if (
        source ===
        "due"
    ) {

        if (
            typeof getDueWords ===
            "function"
        ) {

            words =
                getDueWords(
                    allWords
                );

        } else {

            const now =
                Date.now();


            words =
                allWords.filter(

                    word => {

                        if (
                            word.isDue ===
                            true
                        ) {

                            return true;

                        }


                        const due =
                            new Date(

                                word.dueAt ??

                                word.nextReviewAt ??

                                word.nextReview ??

                                ""

                            );


                        return (

                            !Number.isNaN(
                                due.getTime()
                            ) &&

                            due.getTime() <=
                            now

                        );

                    }

                );

        }

    }


    /*
     * EXPLICIT WORD IDS
     */
    else if (
        source ===
        "selected" ||
        source ===
        "custom"
    ) {

        const idSet =
            new Set(

                selection.wordIds.map(
                    id =>
                        String(
                            id
                        )
                )

            );


        words =
            allWords.filter(

                word =>
                    idSet.has(
                        String(
                            practiceGetWordId(
                                word
                            )
                        )
                    )

            );

    }


    /*
     * Unknown source:
     * fall back to all rather than silently producing
     * an empty session.
     */
    else {

        words =
            [
                ...allWords
            ];

    }


    /*
     * Persist the resolved selection.
     */
    practiceSaveSelection(
        selection
    );


    return {

        words,

        selection,

        allWords

    };

}


/* =========================================================
   IMPORTED AI EXERCISE LOOKUP
========================================================= */

function practiceGetImportedExercise(
    word,
    type
) {

    if (
        !word
    ) {

        return null;

    }


    const normalizedType =
        normalizePracticeExerciseType(
            type
        );


    /*
     * Common locations for imported AI exercises.
     */
    const containers = [

        word.aiExercises,

        word.importedExercises,

        word.exercises,

        word.ai?.exercises,

        word.generatedExercises

    ];


    for (
        const container
        of containers
    ) {

        if (
            !container
        ) {

            continue;

        }


        if (
            Array.isArray(
                container
            )
        ) {

            const match =
                container.find(

                    exercise =>
                        normalizePracticeExerciseType(
                            exercise.type ??
                            exercise.exerciseType
                        ) ===
                        normalizedType

                );


            if (
                match
            ) {

                return match;

            }

        }


        if (
            typeof container ===
            "object"
        ) {

            const direct =
                container[
                    normalizedType
                ];


            if (
                direct
            ) {

                return direct;

            }

        }

    }


    return null;

}


/* =========================================================
   EXERCISE BUILDER
========================================================= */

function buildPracticeExercise(
    word,
    type,
    vocabulary
) {

    const normalizedType =
        normalizePracticeExerciseType(
            type
        );


    /*
     * Imported AI exercise has priority.
     */
    const imported =
        practiceGetImportedExercise(

            word,

            normalizedType

        );


    if (
        imported
    ) {

        return {

            ...practiceClone(
                imported
            ),

            type:
                normalizedType,

            wordId:
                practiceGetWordId(
                    word
                ),

            word

        };

    }


    /*
     * Use exercises.js where available.
     */
    if (
        window.DutchTrainerExercises
    ) {

        const exercises =
            window.DutchTrainerExercises;


        const builders = [

            exercises.createExercise,

            exercises.buildExercise,

            exercises.generateExercise,

            exercises.create

        ];


        for (
            const builder
            of builders
        ) {

            if (
                typeof builder !==
                "function"
            ) {

                continue;

            }


            try {

                const result =
                    builder.call(

                        exercises,

                        word,

                        normalizedType,

                        vocabulary

                    );


                if (
                    result
                ) {

                    return {

                        ...result,

                        type:
                            normalizedType,

                        wordId:
                            practiceGetWordId(
                                word
                            ),

                        word

                    };

                }

            } catch (
                error
            ) {

                console.warn(

                    "Exercise builder failed:",

                    error

                );

            }

        }

    }


    /*
     * Fallback exercise definitions.
     */
    return buildFallbackPracticeExercise(

        word,

        normalizedType,

        vocabulary

    );

}


/* =========================================================
   FALLBACK EXERCISES
========================================================= */

function buildFallbackPracticeExercise(
    word,
    type,
    vocabulary
) {

    const dutch =
        practiceGetDutch(
            word
        );


    const meaning =
        practiceGetMeaning(
            word
        );


    const sentence =
        practiceGetExampleSentence(
            word
        );


    switch (
        type
    ) {

        /* -------------------------------------------------
           MEANING
        ------------------------------------------------- */

        case PRACTICE_EXERCISE_TYPES.MEANING:

            return {

                type,

                prompt:
                    `What does "${dutch}" mean?`,

                instruction:
                    "Type the meaning.",

                answerType:
                    "text",

                acceptedAnswers:
                    practiceGetAcceptedAnswers(
                        word
                    ),

                correctAnswer:
                    meaning,

                wordId:
                    practiceGetWordId(
                        word
                    )

            };


        /* -------------------------------------------------
           RECALL
        ------------------------------------------------- */

        case PRACTICE_EXERCISE_TYPES.RECALL:

            return {

                type,

                prompt:
                    "Recall the Dutch word for this meaning:",

                instruction:
                    practiceCleanText(
                        meaning
                    ),

                answerType:
                    "text",

                acceptedAnswers: [

                    dutch

                ],

                correctAnswer:
                    dutch,

                wordId:
                    practiceGetWordId(
                        word
                    )

            };


        /* -------------------------------------------------
           FILL SENTENCE
        ------------------------------------------------- */

        case PRACTICE_EXERCISE_TYPES.FILL_SENTENCE:

            return {

                type,

                prompt:

                    sentence
                        ? sentence.replace(
                            new RegExp(
                                practiceEscapeRegExp(
                                    dutch
                                ),
                                "ig"
                            ),
                            "_____"
                        )
                        : `Complete a sentence using "${dutch}".`,

                instruction:
                    sentence
                        ? "Fill in the missing word."
                        : "Type the Dutch word.",

                answerType:
                    "text",

                acceptedAnswers: [

                    dutch

                ],

                correctAnswer:
                    dutch,

                sentence,

                wordId:
                    practiceGetWordId(
                        word
                    )

            };


        /* -------------------------------------------------
           CHOOSE WORD
        ------------------------------------------------- */

        case PRACTICE_EXERCISE_TYPES.CHOOSE_WORD:

            return buildFallbackChoiceExercise(

                word,

                vocabulary

            );


        /* -------------------------------------------------
           PRODUCTION
        ------------------------------------------------- */

        case PRACTICE_EXERCISE_TYPES.PRODUCTION:

            return {

                type,

                prompt:
                    meaning
                        ? `Produce the Dutch word for: "${meaning}"`
                        : "Produce the Dutch word.",

                instruction:
                    "Type the Dutch word.",

                answerType:
                    "text",

                acceptedAnswers: [

                    dutch

                ],

                correctAnswer:
                    dutch,

                wordId:
                    practiceGetWordId(
                        word
                    )

            };


        default:

            return buildFallbackPracticeExercise(

                word,

                PRACTICE_EXERCISE_TYPES.MEANING,

                vocabulary

            );

    }

}


/* =========================================================
   ESCAPE REGEXP
========================================================= */

function practiceEscapeRegExp(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

}


/* =========================================================
   CHOICE EXERCISE
========================================================= */

function buildFallbackChoiceExercise(
    word,
    vocabulary
) {

    const dutch =
        practiceGetDutch(
            word
        );


    const meaning =
        practiceGetMeaning(
            word
        );


    const candidates =
        Array.isArray(
            vocabulary
        )
            ? vocabulary.filter(
                item =>
                    practiceGetWordId(
                        item
                    ) !==
                    practiceGetWordId(
                        word
                    )
            )
            : [];


    const distractors =
        practiceShuffle(
            candidates
        )
            .slice(
                0,
                3
            )
            .map(
                item =>
                    practiceGetDutch(
                        item
                    )
            )
            .filter(
                Boolean
            );


    const choices =
        practiceShuffle(

            [

                dutch,

                ...distractors

            ]

        );


    return {

        type:
            PRACTICE_EXERCISE_TYPES.CHOOSE_WORD,

        prompt:

            meaning
                ? `Which Dutch word means "${meaning}"?`
                : "Choose the correct Dutch word.",

        instruction:
            "Select one answer.",

        answerType:
            "choice",

        choices,

        options:
            choices,

        acceptedAnswers: [

            dutch

        ],

        correctAnswer:
            dutch,

        wordId:
            practiceGetWordId(
                word
            )

    };

}


/* =========================================================
   QUESTION BUILDER
========================================================= */

function buildPracticeQuestion(
    word,
    type,
    vocabulary
) {

    const exercise =
        buildPracticeExercise(

            word,

            type,

            vocabulary

        );


    return {

        id:

            `${practiceGetWordId(
                word
            ) || "word"}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`,

        wordId:
            practiceGetWordId(
                word
            ),

        packId:
            practiceGetPackId(
                word
            ),

        type:
            normalizePracticeExerciseType(
                type
            ),

        word,

        exercise,

        answered:
            false,

        answer:
            null,

        result:
            null,

        feedback:
            null

    };

}


/* =========================================================
   QUESTION SELECTION
========================================================= */

function selectPracticeWords(
    words,
    questionCount,
    options = {}
) {

    if (
        !Array.isArray(
            words
        ) ||
        words.length ===
        0
    ) {

        return [];

    }


    const count =
        practiceNormalizeCount(
            questionCount
        );


    let candidates =
        [
            ...words
        ];


    /*
     * Start Practice should prioritize new/due/weak.
     */
    if (
        options.mode ===
        PRACTICE_MODES.START
    ) {

        if (
            typeof selectStartPracticeWords ===
            "function"
        ) {

            const selected =
                selectStartPracticeWords(

                    candidates,

                    count

                );


            if (
                selected.length
            ) {

                return selected;

            }

        }

    }


    /*
     * If there are enough unique words, use each once.
     */
    if (
        candidates.length >=
        count
    ) {

        /*
         * Preserve scheduler priority when Start Practice
         * is active. Full Practice can use the selection
         * engine if available.
         */
        if (
            options.mode ===
            PRACTICE_MODES.START &&
            typeof sortActionableWords ===
            "function"
        ) {

            return sortActionableWords(

                candidates,

                options.now

            ).slice(
                0,
                count
            );

        }


        /*
         * Delegate to selection.js if available.
         */
        if (
            window.DutchTrainerSelection
        ) {

            const selection =
                window.DutchTrainerSelection;


            const methods = [

                "selectWords",

                "selectForPractice",

                "buildPracticeSelection"

            ];


            for (
                const method
                of methods
            ) {

                if (
                    typeof selection[
                        method
                    ] !==
                    "function"
                ) {

                    continue;

                }


                try {

                    const result =
                        selection[
                            method
                        ](

                            candidates,

                            count,

                            options

                        );


                    if (
                        Array.isArray(
                            result
                        ) &&
                        result.length
                    ) {

                        return result.slice(
                            0,
                            count
                        );

                    }

                } catch (
                    error
                ) {

                    console.warn(

                        "Vocabulary selection method failed:",

                        error

                    );

                }

            }

        }


        return practiceShuffle(
            candidates
        ).slice(
            0,
            count
        );

    }


    /*
     * More questions than unique words:
     * cycle through the selected vocabulary.
     *
     * This allows the user to explicitly request, for example,
     * 20 questions from a 7-word pack.
     */
    const result =
        [];


    let index =
        0;


    while (
        result.length <
        count
    ) {

        result.push(

            candidates[
                index %
                candidates.length
            ]

        );


        index++;

    }


    return result;

}


/* =========================================================
   BUILD SESSION QUESTIONS
========================================================= */

function buildPracticeQuestions(
    words,
    options = {}
) {

    const count =
        practiceNormalizeCount(
            options.questionCount
        );


    const selectedWords =
        selectPracticeWords(

            words,

            count,

            options

        );


    if (
        !selectedWords.length
    ) {

        return [];

    }


    let types =
        [];


    const exerciseType =
        normalizePracticeExerciseType(

            options.exerciseType

        );


    if (
        exerciseType ===
        PRACTICE_EXERCISE_TYPES.MIXED
    ) {

        types =
            buildMixedExerciseTypes(
                count
            );

    } else {

        /*
         * One exercise type per session.
         */
        types =
            Array(
                selectedWords.length
            )
                .fill(
                    exerciseType
                );

    }


    return selectedWords.map(

        (
            word,
            index
        ) => {

            return buildPracticeQuestion(

                word,

                types[
                    index
                ],

                words

            );

        }

    );

}


/* =========================================================
   START SESSION
========================================================= */

async function startPractice(
    options = {}
) {

    const mode =
        options.mode ??
        PRACTICE_MODES.FULL;


    const questionCount =
        practiceNormalizeCount(

            options.questionCount ??

            PRACTICE_DEFAULTS.questionCount

        );


    const exerciseType =
        normalizePracticeExerciseType(

            options.exerciseType ??

            (
                mode ===
                PRACTICE_MODES.START

                    ? PRACTICE_EXERCISE_TYPES.MEANING

                    : PRACTICE_DEFAULTS.exerciseType

            )

        );


    const vocabulary =
        await resolvePracticeVocabulary(

            {

                ...options,

                /*
                 * Start Practice always uses the current
                 * selected vocabulary, then narrows it to
                 * new/due/weak.
                 */
                source:
                    options.source

            }

        );


    let words =
        vocabulary.words;


    /*
     * Start Practice explicitly narrows to actionable words.
     */
    if (
        mode ===
        PRACTICE_MODES.START
    ) {

        if (
            typeof getActionableWords ===
            "function"
        ) {

            words =
                getActionableWords(
                    words
                );

        } else {

            words =
                words.filter(

                    word =>

                        word.isNew ===
                        true ||

                        word.isDue ===
                        true ||

                        Number(
                            word.mastery ??
                            word.masteryScore ??
                            0
                        ) <
                        40

                );

        }

    }


    const questions =
        buildPracticeQuestions(

            words,

            {

                ...options,

                mode,

                questionCount,

                exerciseType

            }

        );


    /*
     * Reset session.
     */
    PracticeState.active =
        questions.length >
        0;


    PracticeState.mode =
        mode;


    PracticeState.exerciseType =
        exerciseType;


    PracticeState.questionCount =
        questionCount;


    PracticeState.questions =
        questions;


    PracticeState.currentIndex =
        0;


    PracticeState.currentQuestion =
        questions[0] ??
        null;


    PracticeState.currentExercise =
        questions[0]?.exercise ??
        null;


    PracticeState.currentWord =
        questions[0]?.word ??
        null;


    PracticeState.currentAnswer =
        null;


    PracticeState.answered =
        false;


    PracticeState.feedback =
        null;


    PracticeState.completed =
        false;


    PracticeState.startedAt =
        practiceNowISO();


    PracticeState.completedAt =
        null;


    PracticeState.correctCount =
        0;


    PracticeState.incorrectCount =
        0;


    PracticeState.answerCount =
        0;


    PracticeState.selectedVocabulary =
        words;


    PracticeState.selectedVocabularyIds =

        words.map(
            practiceGetWordId
        )
            .filter(
                id =>
                    id !==
                    null
            );


    PracticeState.selectedPackId =
        vocabulary.selection.packId ??
        null;


    PracticeState.vocabularySource =
        vocabulary.selection.source ??
        "all";


    PracticeState.mixedTypes =

        questions.map(
            question =>
                question.type
        );


    PracticeState.results =
        [];


    PracticeState.sessionId =
        createPracticeSessionId();


    PracticeState.lastAnswerAt =
        null;


    emitPracticeEvent(
        "start",
        getPracticeState()
    );


    emitPracticeEvent(
        "state",
        getPracticeState()
    );


    return getPracticeState();

}


/* =========================================================
   START PRACTICE SHORTCUT
========================================================= */

async function startQuickPractice(
    options = {}
) {

    return await startPractice(

        {

            ...options,

            mode:
                PRACTICE_MODES.START,

            exerciseType:
                PRACTICE_EXERCISE_TYPES.MEANING

        }

    );

}


/* =========================================================
   START MEANING
========================================================= */

async function startMeaningPractice(
    options = {}
) {

    return await startPractice(

        {

            ...options,

            mode:
                PRACTICE_MODES.FULL,

            exerciseType:
                PRACTICE_EXERCISE_TYPES.MEANING

        }

    );

}


/* =========================================================
   START RECALL
========================================================= */

async function startRecallPractice(
    options = {}
) {

    return await startPractice(

        {

            ...options,

            mode:
                PRACTICE_MODES.FULL,

            exerciseType:
                PRACTICE_EXERCISE_TYPES.RECALL

        }

    );

}


/* =========================================================
   START FILL SENTENCE
========================================================= */

async function startFillSentencePractice(
    options = {}
) {

    return await startPractice(

        {

            ...options,

            mode:
                PRACTICE_MODES.FULL,

            exerciseType:
                PRACTICE_EXERCISE_TYPES.FILL_SENTENCE

        }

    );

}


/* =========================================================
   START CHOOSE WORD
========================================================= */

async function startChooseWordPractice(
    options = {}
) {

    return await startPractice(

        {

            ...options,

            mode:
                PRACTICE_MODES.FULL,

            exerciseType:
                PRACTICE_EXERCISE_TYPES.CHOOSE_WORD

        }

    );

}


/* =========================================================
   START PRODUCTION
========================================================= */

async function startProductionPractice(
    options = {}
) {

    return await startPractice(

        {

            ...options,

            mode:
                PRACTICE_MODES.FULL,

            exerciseType:
                PRACTICE_EXERCISE_TYPES.PRODUCTION

        }

    );

}


/* =========================================================
   START MIXED
========================================================= */

async function startMixedPractice(
    options = {}
) {

    return await startPractice(

        {

            ...options,

            mode:
                PRACTICE_MODES.FULL,

            exerciseType:
                PRACTICE_EXERCISE_TYPES.MIXED

        }

    );

}


/* =========================================================
   GET CURRENT QUESTION
========================================================= */

function getCurrentPracticeQuestion() {

    return PracticeState.currentQuestion;

}


/* =========================================================
   GET CURRENT EXERCISE
========================================================= */

function getCurrentPracticeExercise() {

    return PracticeState.currentExercise;

}


/* =========================================================
   GET CURRENT WORD
========================================================= */

function getCurrentPracticeWord() {

    return PracticeState.currentWord;

}


/* =========================================================
   SET ANSWER
========================================================= */

function setPracticeAnswer(
    answer
) {

    if (
        !PracticeState.active ||
        PracticeState.answered
    ) {

        return false;

    }


    PracticeState.currentAnswer =
        answer;


    emitPracticeEvent(
        "state",
        getPracticeState()
    );


    return true;

}


/* =========================================================
   EXTRACT ANSWER
========================================================= */

function extractPracticeAnswer(
    answer,
    question
) {

    if (
        answer !==
        undefined
    ) {

        return answer;

    }


    if (
        question?.answer !==
        undefined
    ) {

        return question.answer;

    }


    return PracticeState.currentAnswer;

}


/* =========================================================
   EXPECTED ANSWER
========================================================= */

function getPracticeExpectedAnswers(
    question
) {

    if (
        !question
    ) {

        return [];

    }


    const exercise =
        question.exercise;


    const word =
        question.word;


    return practiceGetAcceptedAnswers(

        word,

        exercise

    );

}


/* =========================================================
   CHECK ANSWER
========================================================= */

async function checkPracticeAnswer(
    answer
) {

    if (
        !PracticeState.active
    ) {

        return {

            success:
                false,

            reason:
                "no-active-session"

        };

    }


    if (
        PracticeState.answered
    ) {

        return {

            success:
                false,

            reason:
                "already-answered",

            feedback:
                PracticeState.feedback

        };

    }


    const question =
        PracticeState.currentQuestion;


    if (
        !question
    ) {

        return {

            success:
                false,

            reason:
                "no-question"

        };

    }


    const exercise =
        question.exercise;


    const word =
        question.word;


    const submittedAnswer =
        extractPracticeAnswer(

            answer,

            question

        );


    let result;


    /*
     * Choice exercise.
     */
    if (
        question.type ===
        PRACTICE_EXERCISE_TYPES.CHOOSE_WORD ||
        exercise?.answerType ===
        "choice"
    ) {

        result =
            practiceCheckChoiceAnswer(

                submittedAnswer,

                exercise?.correctAnswer ??

                exercise?.answer ??

                practiceGetDutch(
                    word
                )

            );

    }


    /*
     * All typed-answer exercises.
     */
    else {

        result =
            practiceCheckTypedAnswer(

                submittedAnswer,

                getPracticeExpectedAnswers(
                    question
                )

            );

    }


    /*
     * Empty answer is not submitted.
     */
    if (
        result.empty
    ) {

        return {

            success:
                false,

            reason:
                "empty-answer",

            result

        };

    }


    /*
     * Mark question answered BEFORE async persistence.
     * This prevents double Enter from creating two answers.
     */
    question.answered =
        true;


    question.answer =
        submittedAnswer;


    question.result =
        result;


    PracticeState.answered =
        true;


    PracticeState.answerCount++;


    if (
        result.correct
    ) {

        PracticeState.correctCount++;

    } else {

        PracticeState.incorrectCount++;

    }


    PracticeState.lastAnswerAt =
        practiceNowISO();


    /*
     * -----------------------------------------------------
     * MASTERY UPDATE
     * -----------------------------------------------------
     *
     * mastery.js is the authoritative implementation.
     */
    const masteryResult =
        await updatePracticeMastery(

            word,

            {

                correct:
                    result.correct,

                score:
                    result.score,

                exerciseType:
                    question.type,

                answer:
                    submittedAnswer,

                sessionId:
                    PracticeState.sessionId

            }

        );


    /*
     * -----------------------------------------------------
     * SCHEDULING
     * -----------------------------------------------------
     *
     * scheduler.js receives the UPDATED mastery.
     */
    const updatedMastery =
        extractPracticeMastery(

            masteryResult,

            word

        );


    const scheduleResult =
        await updatePracticeSchedule(

            word,

            {

                correct:
                    result.correct,

                mastery:
                    updatedMastery,

                exerciseType:
                    question.type,

                sessionId:
                    PracticeState.sessionId

            }

        );


    /*
     * Feedback is generated for EVERY answer.
     */
    const feedback =
        buildPracticeFeedback(

            question,

            result,

            masteryResult,

            scheduleResult

        );


    question.feedback =
        feedback;


    PracticeState.feedback =
        feedback;


    /*
     * Save the answer result in the session.
     */
    PracticeState.results.push(

        {

            questionId:
                question.id,

            wordId:
                question.wordId,

            packId:
                question.packId,

            type:
                question.type,

            answer:
                submittedAnswer,

            correct:
                result.correct,

            score:
                result.score,

            threshold:
                result.threshold ??

                null,

            mastery:
                updatedMastery,

            dueAt:
                scheduleResult?.dueAt ??
                word.dueAt ??
                null,

            intervalDays:
                scheduleResult?.intervalDays ??
                word.intervalDays ??
                null,

            answeredAt:
                PracticeState.lastAnswerAt

        }

    );


    /*
     * Notify UI immediately after every answer.
     */
    emitPracticeEvent(
        "answer",
        {

            result,

            feedback,

            mastery:
                updatedMastery,

            schedule:
                scheduleResult,

            question,

            state:
                getPracticeState()

        }

    );


    emitPracticeEvent(
        "feedback",
        feedback
    );


    emitPracticeEvent(
        "state",
        getPracticeState()
    );


    return {

        success:
            true,

        correct:
            result.correct,

        score:
            result.score,

        threshold:
            result.threshold,

        feedback,

        mastery:
            updatedMastery,

        schedule:
            scheduleResult,

        question,

        state:
            getPracticeState()

    };

}


/* =========================================================
   MASTERY UPDATE ADAPTER
========================================================= */

async function updatePracticeMastery(
    word,
    options
) {

    /*
     * V2 mastery.js public API.
     */
    if (
        window.DutchTrainerMastery
    ) {

        const mastery =
            window.DutchTrainerMastery;


        const methods = [

            "recordAnswer",

            "updateAfterAnswer",

            "updateMastery",

            "processAnswer"

        ];


        for (
            const method
            of methods
        ) {

            if (
                typeof mastery[
                    method
                ] !==
                "function"
            ) {

                continue;

            }


            try {

                return await mastery[
                    method
                ](

                    word,

                    options

                );

            } catch (
                error
            ) {

                console.warn(

                    `Mastery method ${method} failed:`,

                    error

                );

            }

        }

    }


    /*
     * Global compatibility APIs.
     */
    const globalMethods = [

        "recordAnswer",

        "updateMastery",

        "updateWordMastery",

        "applyMasteryUpdate"

    ];


    for (
        const method
        of globalMethods
    ) {

        if (
            typeof window[
                method
            ] !==
            "function"
        ) {

            continue;

        }


        try {

            return await window[
                method
            ](

                word,

                options

            );

        } catch (
            error
        ) {

            console.warn(

                `Global mastery method ${method} failed:`,

                error

            );

        }

    }


    /*
     * Compatibility fallback.
     *
     * This only executes when mastery.js does not expose
     * a callable API. It does not overwrite an existing
     * mastery implementation.
     */
    return fallbackPracticeMasteryUpdate(

        word,

        options

    );

}


/* =========================================================
   FALLBACK MASTERY
========================================================= */

function fallbackPracticeMasteryUpdate(
    word,
    options
) {

    const previous =
        Number(

            word.mastery ??

            word.masteryScore ??

            0

        );


    let mastery;


    if (
        options.correct
    ) {

        mastery =
            Math.min(

                100,

                previous +
                Math.max(
                    4,
                    10 *
                    Number(
                        options.score ??
                        1
                    )
                )

            );

    } else {

        mastery =
            Math.max(

                0,

                previous -
                8

            );

    }


    word.mastery =
        mastery;


    word.masteryScore =
        mastery;


    const attempts =
        Number(
            word.attempts ??
            0
        );


    word.attempts =
        attempts + 1;


    const correct =
        Number(
            word.correct ??
            0
        );


    if (
        options.correct
    ) {

        word.correct =
            correct + 1;

    }


    if (
        word.stats &&
        typeof word.stats ===
        "object"
    ) {

        word.stats.attempts =
            word.attempts;


        word.stats.correct =
            word.correct ??
            correct;

    }


    return {

        word,

        mastery,

        previousMastery:
            previous,

        correct:
            Boolean(
                options.correct
            )

    };

}


/* =========================================================
   EXTRACT MASTERY
========================================================= */

function extractPracticeMastery(
    masteryResult,
    word
) {

    const candidates = [

        masteryResult?.mastery,

        masteryResult?.score,

        masteryResult?.masteryScore,

        masteryResult?.newMastery,

        masteryResult?.word?.mastery,

        masteryResult?.word?.masteryScore,

        word?.mastery,

        word?.masteryScore

    ];


    for (
        const candidate
        of candidates
    ) {

        const value =
            Number(
                candidate
            );


        if (
            Number.isFinite(
                value
            )
        ) {

            return Math.max(

                0,

                Math.min(
                    100,
                    value
                )

            );

        }

    }


    return 0;

}


/* =========================================================
   SCHEDULER UPDATE ADAPTER
========================================================= */

async function updatePracticeSchedule(
    word,
    options
) {

    if (
        typeof scheduleAndSaveAfterAnswer ===
        "function"
    ) {

        return await scheduleAndSaveAfterAnswer(

            word,

            options

        );

    }


    if (
        window.DutchTrainerScheduler
    ) {

        const scheduler =
            window.DutchTrainerScheduler;


        if (
            typeof scheduler.scheduleAndSaveAfterAnswer ===
            "function"
        ) {

            return await scheduler
                .scheduleAndSaveAfterAnswer(

                    word,

                    options

                );

        }


        if (
            typeof scheduler.scheduleAfterAnswer ===
            "function"
        ) {

            const result =
                scheduler.scheduleAfterAnswer(

                    word,

                    options

                );


            await practiceSaveWord(
                word
            );


            return result;

        }

    }


    /*
     * Global compatibility.
     */
    if (
        typeof scheduleAfterAnswer ===
        "function"
    ) {

        const result =
            scheduleAfterAnswer(

                word,

                options

            );


        await practiceSaveWord(
            word
        );


        return result;

    }


    /*
     * Minimal fallback.
     */
    const now =
        practiceNow();


    const intervalDays =
        options.correct
            ? 1
            : 0;


    const dueAt =
        options.correct

            ? new Date(

                now.getTime() +

                intervalDays *
                24 *
                60 *
                60 *
                1000

            ).toISOString()

            : now.toISOString();


    word.dueAt =
        dueAt;


    word.nextReviewAt =
        dueAt;


    word.lastPracticedAt =
        now.toISOString();


    await practiceSaveWord(
        word
    );


    return {

        word,

        dueAt,

        intervalDays

    };

}


/* =========================================================
   FEEDBACK
========================================================= */

function buildPracticeFeedback(
    question,
    result,
    masteryResult,
    scheduleResult
) {

    const expected =
        getPracticeExpectedAnswers(
            question
        );


    const correctAnswer =

        question.exercise?.correctAnswer ??

        question.exercise?.answer ??

        expected[0] ??

        practiceGetDutch(
            question.word
        );


    const mastery =
        extractPracticeMastery(

            masteryResult,

            question.word

        );


    const nextReview =
        scheduleResult?.dueAt ??

        question.word?.dueAt ??

        null;


    let message;


    if (
        result.correct
    ) {

        message =
            "Correct!";

    } else {

        message =
            "Not quite.";

    }


    return {

        correct:
            result.correct,

        message,

        answer:
            question.answer,

        correctAnswer,

        score:
            result.score,

        threshold:
            result.threshold ??
            null,

        mastery,

        masteryChange:
            calculatePracticeMasteryChange(

                masteryResult,

                question.word

            ),

        nextReview,

        nextReviewLabel:

            typeof getNextReviewLabel ===
            "function"

                ? getNextReviewLabel(
                    question.word
                )

                : null

    };

}


/* =========================================================
   MASTERY CHANGE
========================================================= */

function calculatePracticeMasteryChange(
    masteryResult,
    word
) {

    const current =
        extractPracticeMastery(

            masteryResult,

            word

        );


    const previousCandidates = [

        masteryResult?.previousMastery,

        masteryResult?.oldMastery,

        masteryResult?.before,

        masteryResult?.previousScore

    ];


    for (
        const value
        of previousCandidates
    ) {

        const previous =
            Number(
                value
            );


        if (
            Number.isFinite(
                previous
            )
        ) {

            return (
                current -
                previous
            );

        }

    }


    return null;

}


/* =========================================================
   NEXT QUESTION
========================================================= */

function nextPracticeQuestion() {

    if (
        !PracticeState.active
    ) {

        return {

            success:
                false,

            reason:
                "no-active-session"

        };

    }


    if (
        !PracticeState.answered
    ) {

        return {

            success:
                false,

            reason:
                "answer-required"

        };

    }


    PracticeState.currentIndex++;


    if (
        PracticeState.currentIndex >=
        PracticeState.questions.length
    ) {

        completePracticeSession();


        return {

            success:
                true,

            completed:
                true,

            state:
                getPracticeState()

        };

    }


    const question =
        PracticeState.questions[
            PracticeState.currentIndex
        ];


    PracticeState.currentQuestion =
        question;


    PracticeState.currentExercise =
        question.exercise;


    PracticeState.currentWord =
        question.word;


    PracticeState.currentAnswer =
        null;


    PracticeState.answered =
        false;


    PracticeState.feedback =
        null;


    emitPracticeEvent(
        "next",
        getPracticeState()
    );


    emitPracticeEvent(
        "state",
        getPracticeState()
    );


    return {

        success:
            true,

        completed:
            false,

        question,

        state:
            getPracticeState()

    };

}


/* =========================================================
   ENTER KEY BEHAVIOR
========================================================= */

/*
 * Enter is deliberately a two-step action:
 *
 * First Enter:
 *   Check Answer
 *
 * Second Enter:
 *   Next Question
 *
 * This function is intended to be called by ui.js.
 */
async function handlePracticeEnter(
    answer = undefined
) {

    if (
        !PracticeState.active
    ) {

        return {

            handled:
                false,

            reason:
                "no-active-session"

        };

    }


    /*
     * First Enter checks the answer.
     */
    if (
        !PracticeState.answered
    ) {

        const result =
            await checkPracticeAnswer(
                answer
            );


        return {

            handled:
                true,

            action:
                "check",

            result

        };

    }


    /*
     * Second Enter advances.
     */
    const result =
        nextPracticeQuestion();


    return {

        handled:
            true,

        action:
            "next",

        result

    };

}


/* =========================================================
   COMPLETE SESSION
========================================================= */

async function completePracticeSession() {

    if (
        PracticeState.completed
    ) {

        return getPracticeState();

    }


    PracticeState.completed =
        true;


    PracticeState.active =
        false;


    PracticeState.completedAt =
        practiceNowISO();


    /*
     * Persist session statistics if storage exposes a
     * session API.
     */
    await persistPracticeSession();


    emitPracticeEvent(
        "complete",
        getPracticeSessionSummary()
    );


    emitPracticeEvent(
        "state",
        getPracticeState()
    );


    return getPracticeState();

}


/* =========================================================
   PERSIST SESSION
========================================================= */

async function persistPracticeSession() {

    const summary =
        getPracticeSessionSummary();


    if (
        window.DutchTrainerStorage
    ) {

        const storage =
            window.DutchTrainerStorage;


        const methods = [

            "savePracticeSession",

            "saveSession",

            "recordPracticeSession"

        ];


        for (
            const method
            of methods
        ) {

            if (
                typeof storage[
                    method
                ] !==
                "function"
            ) {

                continue;

            }


            try {

                return await storage[
                    method
                ](
                    summary
                );

            } catch (
                error
            ) {

                console.warn(

                    `Could not persist practice session using ${method}:`,

                    error

                );

            }

        }

    }


    const globalMethods = [

        "savePracticeSession",

        "savePracticeSessionResult",

        "recordPracticeSession"

    ];


    for (
        const method
        of globalMethods
    ) {

        if (
            typeof window[
                method
            ] !==
            "function"
        ) {

            continue;

        }


        try {

            return await window[
                method
            ](
                summary
            );

        } catch (
            error
        ) {

            console.warn(

                `Could not persist practice session using ${method}:`,

                error

            );

        }

    }


    return summary;

}


/* =========================================================
   SESSION ID
========================================================= */

function createPracticeSessionId() {

    return (

        `practice-${Date.now()}-` +

        Math.random()
            .toString(36)
            .slice(2, 10)

    );

}


/* =========================================================
   SESSION SUMMARY
========================================================= */

function getPracticeSessionSummary() {

    const total =
        PracticeState.answerCount;


    const correct =
        PracticeState.correctCount;


    const accuracy =
        total >
        0

            ? (
                correct /
                total
            ) * 100

            : 0;


    const packIds = [

        ...new Set(

            PracticeState.results

                .map(
                    result =>
                        result.packId
                )

                .filter(
                    id =>
                        id !==
                        null &&
                        id !==
                        undefined
                )

        )

    ];


    return {

        sessionId:
            PracticeState.sessionId,

        mode:
            PracticeState.mode,

        exerciseType:
            PracticeState.exerciseType,

        questionCount:
            PracticeState.questionCount,

        selectedVocabularySource:
            PracticeState.vocabularySource,

        selectedPackId:
            PracticeState.selectedPackId,

        selectedVocabularyIds:
            [
                ...PracticeState.selectedVocabularyIds
            ],

        packIds,

        startedAt:
            PracticeState.startedAt,

        completedAt:
            PracticeState.completedAt,

        total,

        correct,

        incorrect:
            PracticeState.incorrectCount,

        accuracy,

        results:
            practiceClone(
                PracticeState.results
            )

    };

}


/* =========================================================
   GET STATE
========================================================= */

function getPracticeState() {

    return {

        active:
            PracticeState.active,

        mode:
            PracticeState.mode,

        exerciseType:
            PracticeState.exerciseType,

        questionCount:
            PracticeState.questionCount,

        currentIndex:
            PracticeState.currentIndex,

        currentQuestion:
            PracticeState.currentQuestion,

        currentExercise:
            PracticeState.currentExercise,

        currentWord:
            PracticeState.currentWord,

        currentAnswer:
            PracticeState.currentAnswer,

        answered:
            PracticeState.answered,

        feedback:
            PracticeState.feedback,

        completed:
            PracticeState.completed,

        startedAt:
            PracticeState.startedAt,

        completedAt:
            PracticeState.completedAt,

        correctCount:
            PracticeState.correctCount,

        incorrectCount:
            PracticeState.incorrectCount,

        answerCount:
            PracticeState.answerCount,

        totalQuestions:
            PracticeState.questions.length,

        selectedVocabulary:
            PracticeState.selectedVocabulary,

        selectedVocabularyIds:
            [
                ...PracticeState.selectedVocabularyIds
            ],

        selectedPackId:
            PracticeState.selectedPackId,

        vocabularySource:
            PracticeState.vocabularySource,

        mixedTypes:
            [
                ...PracticeState.mixedTypes
            ],

        sessionId:
            PracticeState.sessionId

    };

}


/* =========================================================
   GET PROGRESS
========================================================= */

function getPracticeProgress() {

    const total =
        PracticeState.questions.length;


    const current =
        PracticeState.currentIndex;


    return {

        current:
            total >
            0
                ? current + 1
                : 0,

        total,

        answered:
            PracticeState.answerCount,

        remaining:
            Math.max(

                0,

                total -
                current -
                1

            ),

        percentage:

            total >
            0

                ? (
                    (
                        current + 1
                    ) /
                    total
                ) * 100

                : 0

    };

}


/* =========================================================
   EVENT EMITTER
========================================================= */

function emitPracticeEvent(
    type,
    data
) {

    const listeners =
        PracticeListeners[
            type
        ];


    if (
        Array.isArray(
            listeners
        )
    ) {

        for (
            const listener
            of [
                ...listeners
            ]
        ) {

            try {

                listener(
                    data
                );

            } catch (
                error
            ) {

                console.error(

                    `Practice ${type} listener failed:`,

                    error

                );

            }

        }

    }


    /*
     * DOM event for ui.js and other UI code.
     */
    if (
        typeof document !==
        "undefined"
    ) {

        document.dispatchEvent(

            new CustomEvent(

                `dutchtrainer:practice:${type}`,

                {

                    detail:
                        data

                }

            )

        );

    }

}


/* =========================================================
   EVENT SUBSCRIBE
========================================================= */

function onPracticeEvent(
    type,
    callback
) {

    if (
        !PracticeListeners[
            type
        ] ||
        typeof callback !==
        "function"
    ) {

        return () => {};

    }


    PracticeListeners[
        type
    ].push(
        callback
    );


    return () => {

        const list =
            PracticeListeners[
                type
            ];


        const index =
            list.indexOf(
                callback
            );


        if (
            index >=
            0
        ) {

            list.splice(
                index,
                1
            );

        }

    };

}


/* =========================================================
   CANCEL SESSION
========================================================= */

function cancelPracticeSession() {

    PracticeState.active =
        false;


    PracticeState.completed =
        false;


    PracticeState.currentQuestion =
        null;


    PracticeState.currentExercise =
        null;


    PracticeState.currentWord =
        null;


    PracticeState.currentAnswer =
        null;


    PracticeState.answered =
        false;


    PracticeState.feedback =
        null;


    emitPracticeEvent(
        "state",
        getPracticeState()
    );


    return true;

}


/* =========================================================
   RESET SESSION
========================================================= */

function resetPracticeSession() {

    Object.assign(

        PracticeState,

        {

            active:
                false,

            mode:
                PRACTICE_MODES.FULL,

            exerciseType:
                PRACTICE_EXERCISE_TYPES.MEANING,

            questionCount:
                PRACTICE_DEFAULTS.questionCount,

            questions:
                [],

            currentIndex:
                0,

            currentQuestion:
                null,

            currentExercise:
                null,

            currentWord:
                null,

            currentAnswer:
                null,

            answered:
                false,

            feedback:
                null,

            completed:
                false,

            startedAt:
                null,

            completedAt:
                null,

            correctCount:
                0,

            incorrectCount:
                0,

            answerCount:
                0,

            selectedVocabulary:
                [],

            selectedVocabularyIds:
                [],

            selectedPackId:
                null,

            vocabularySource:
                "all",

            mixedTypes:
                [],

            results:
                [],

            sessionId:
                null,

            lastAnswerAt:
                null

        }

    );


    emitPracticeEvent(
        "state",
        getPracticeState()
    );

}


/* =========================================================
   GET AVAILABLE COUNTS
========================================================= */

async function getPracticeAvailableCounts(
    options = {}
) {

    const vocabulary =
        await resolvePracticeVocabulary(
            options
        );


    const words =
        vocabulary.words;


    const statistics = {

        all:
            words.length,

        new:
            0,

        due:
            0,

        weak:
            0,

        actionable:
            0

    };


    if (
        typeof getScheduleStatistics ===
        "function"
    ) {

        const schedule =
            getScheduleStatistics(
                words
            );


        statistics.new =
            schedule.new ??
            0;


        statistics.due =
            schedule.due ??
            0;


        statistics.weak =
            schedule.weak ??
            0;


        statistics.actionable =
            schedule.actionable ??
            (
                statistics.new +
                statistics.due +
                statistics.weak
            );

    } else {

        for (
            const word
            of words
        ) {

            if (
                word.isNew ===
                true
            ) {

                statistics.new++;

            }


            if (
                word.isDue ===
                true
            ) {

                statistics.due++;

            }


            const mastery =
                Number(

                    word.mastery ??

                    word.masteryScore ??

                    0

                );


            if (
                mastery <
                40 &&
                word.isNew !==
                true
            ) {

                statistics.weak++;

            }

        }


        statistics.actionable =

            statistics.new +

            statistics.due +

            statistics.weak;

    }


    return {

        ...statistics,

        selection:
            vocabulary.selection

    };

}


/* =========================================================
   SESSION HAS NEXT
========================================================= */

function practiceHasNextQuestion() {

    return (

        PracticeState.active &&

        PracticeState.answered &&

        PracticeState.currentIndex <
        PracticeState.questions.length - 1

    );

}


/* =========================================================
   SESSION IS COMPLETE
========================================================= */

function practiceIsComplete() {

    return (
        PracticeState.completed
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

window.DutchTrainerPractice = {

    state:
        PracticeState,

    constants: {

        EXERCISE_TYPES:
            PRACTICE_EXERCISE_TYPES,

        MODES:
            PRACTICE_MODES,

        DEFAULTS:
            PRACTICE_DEFAULTS

    },

    start:
        startPractice,

    startQuick:
        startQuickPractice,

    startMeaning:
        startMeaningPractice,

    startRecall:
        startRecallPractice,

    startFillSentence:
        startFillSentencePractice,

    startChooseWord:
        startChooseWordPractice,

    startProduction:
        startProductionPractice,

    startMixed:
        startMixedPractice,

    checkAnswer:
        checkPracticeAnswer,

    setAnswer:
        setPracticeAnswer,

    next:
        nextPracticeQuestion,

    handleEnter:
        handlePracticeEnter,

    getCurrentQuestion:
        getCurrentPracticeQuestion,

    getCurrentExercise:
        getCurrentPracticeExercise,

    getCurrentWord:
        getCurrentPracticeWord,

    getState:
        getPracticeState,

    getProgress:
        getPracticeProgress,

    getSummary:
        getPracticeSessionSummary,

    getAvailableCounts:
        getPracticeAvailableCounts,

    hasNext:
        practiceHasNextQuestion,

    isComplete:
        practiceIsComplete,

    cancel:
        cancelPracticeSession,

    reset:
        resetPracticeSession,

    on:
        onPracticeEvent,

    buildQuestion:
        buildPracticeQuestion,

    buildQuestions:
        buildPracticeQuestions,

    buildMixedTypes:
        buildMixedExerciseTypes,

    normalizeExerciseType:
        normalizePracticeExerciseType,

    getExerciseTypes:
        getPracticeExerciseTypes,

    resolveVocabulary:
        resolvePracticeVocabulary,

    checkTypedAnswer:
        practiceCheckTypedAnswer

};


/* =========================================================
   GLOBAL COMPATIBILITY API
========================================================= */

window.startPractice =
    startPractice;


window.startQuickPractice =
    startQuickPractice;


window.startMeaningPractice =
    startMeaningPractice;


window.startRecallPractice =
    startRecallPractice;


window.startFillSentencePractice =
    startFillSentencePractice;


window.startChooseWordPractice =
    startChooseWordPractice;


window.startProductionPractice =
    startProductionPractice;


window.startMixedPractice =
    startMixedPractice;


window.checkPracticeAnswer =
    checkPracticeAnswer;


window.nextPracticeQuestion =
    nextPracticeQuestion;


window.handlePracticeEnter =
    handlePracticeEnter;


window.getCurrentPracticeQuestion =
    getCurrentPracticeQuestion;


window.getCurrentPracticeExercise =
    getCurrentPracticeExercise;


window.getCurrentPracticeWord =
    getCurrentPracticeWord;


window.getPracticeState =
    getPracticeState;


window.getPracticeProgress =
    getPracticeProgress;


window.cancelPracticeSession =
    cancelPracticeSession;


/* =========================================================
   KEYBOARD HANDLING
========================================================= */

/*
 * practice.js owns the session logic, but UI elements may
 * handle their own key events.
 *
 * This listener provides the global Enter behavior only
 * when an answer control is not already handling it.
 */
document.addEventListener(

    "keydown",

    async event => {

        if (
            event.key !==
            "Enter"
        ) {

            return;

        }


        if (
            event.defaultPrevented
        ) {

            return;

        }


        /*
         * Do not interfere with textarea Enter.
         */
        const target =
            event.target;


        if (
            target &&
            target.tagName ===
            "TEXTAREA"
        ) {

            return;

        }


        /*
         * Only handle Enter when a practice session exists.
         */
        if (
            !PracticeState.active
        ) {

            return;

        }


        /*
         * If ui.js is managing the answer, it can call
         * handlePracticeEnter directly. Avoid double handling
         * buttons and form controls.
         */
        if (
            target &&
            (
                target.tagName ===
                "BUTTON" ||

                target.tagName ===
                "SELECT"
            )
        ) {

            return;

        }


        event.preventDefault();


        let answer;


        /*
         * Try to obtain the currently focused/input answer.
         */
        if (
            target &&
            (
                target.tagName ===
                "INPUT"
            )
        ) {

            answer =
                target.value;

        }


        await handlePracticeEnter(
            answer
        );

    }

);


/* =========================================================
   INITIAL STATE
========================================================= */

resetPracticeSession();