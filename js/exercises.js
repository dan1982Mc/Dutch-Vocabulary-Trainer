/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Exercise Definitions / Question Factory

   Exercise types:
   1. Meaning
   2. Recall
   3. Fill Sentence
   4. Choose Word
   5. Production

   Responsibilities:
   - Define supported exercise types
   - Normalize imported AI exercises
   - Create fallback exercises
   - Preserve AI-generated exercises
   - Build a common question structure
   - Provide answers / accepted answers
   - Support Mixed Practice
========================================================= */


/* =========================================================
   EXERCISE TYPE DEFINITIONS
========================================================= */

const EXERCISE_TYPES = {

    meaning: {

        id: "meaning",

        label: "Meaning",

        description:
            "Choose the correct English meaning of the Dutch word.",

        inputType:
            "choice",

        typed:
            false

    },


    recall: {

        id: "recall",

        label: "Recall",

        description:
            "Recall the Dutch word from its English meaning.",

        inputType:
            "text",

        typed:
            true

    },


    fill: {

        id: "fill",

        label: "Fill Sentence",

        description:
            "Complete the Dutch sentence with the missing word.",

        inputType:
            "text",

        typed:
            true

    },


    choose: {

        id: "choose",

        label: "Choose Word",

        description:
            "Choose the Dutch word that best completes the sentence.",

        inputType:
            "choice",

        typed:
            false

    },


    production: {

        id: "production",

        label: "Production",

        description:
            "Produce the Dutch word or expression yourself.",

        inputType:
            "text",

        typed:
            true

    },


    mixed: {

        id: "mixed",

        label: "Mixed Practice",

        description:
            "Practice all five exercise types.",

        inputType:
            "mixed",

        typed:
            false

    }

};


/* =========================================================
   ORDER
========================================================= */

const EXERCISE_TYPE_ORDER = [

    "meaning",

    "recall",

    "fill",

    "choose",

    "production"

];


/* =========================================================
   NORMALIZE TYPE
========================================================= */

function normalizeExerciseType(
    type
) {

    const value =
        String(
            type || ""
        )
        .trim()
        .toLowerCase();


    const aliases = {

        meaning:
            "meaning",

        definition:
            "meaning",

        recall:
            "recall",

        reverse:
            "recall",

        fill:
            "fill",

        fillsentence:
            "fill",

        "fill-sentence":
            "fill",

        sentence:
            "fill",

        choose:
            "choose",

        chooseword:
            "choose",

        "choose-word":
            "choose",

        multiplechoice:
            "choose",

        production:
            "production",

        produce:
            "production",

        typing:
            "production",

        mixed:
            "mixed"

    };


    return (
        aliases[value] ||
        null
    );

}


/* =========================================================
   GET TYPE
========================================================= */

function getExerciseType(
    type
) {

    const normalized =
        normalizeExerciseType(
            type
        );


    return (
        EXERCISE_TYPES[
            normalized
        ] ||
        null
    );

}


/* =========================================================
   IS VALID TYPE
========================================================= */

function isValidExerciseType(
    type
) {

    return Boolean(
        normalizeExerciseType(
            type
        )
    );

}


/* =========================================================
   WORD FIELD HELPERS
========================================================= */

function getDutchWord(
    word
) {

    if (!word) {

        return "";

    }


    return String(

        word.word ??
        word.term ??
        word.dutch ??
        word.text ??
        ""

    ).trim();

}


function getEnglishMeaning(
    word
) {

    if (!word) {

        return "";

    }


    return String(

        word.meaning ??
        word.english ??
        word.translation ??
        word.definition ??
        ""

    ).trim();

}


/* =========================================================
   GET ACCEPTED ANSWERS FROM WORD
========================================================= */

function getWordAcceptedAnswers(
    word
) {

    if (!word) {

        return [];

    }


    const candidates = [

        word.acceptedAnswers,

        word.accepted_answers,

        word.answers,

        word.alternatives,

        word.synonyms,

        word.word

    ];


    for (
        const candidate of candidates
    ) {

        if (
            Array.isArray(candidate)
        ) {

            const values =
                candidate
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined &&
                            String(
                                value
                            ).trim() !== ""
                    )
                    .map(
                        value =>
                            String(value).trim()
                    );


            if (values.length) {

                return values;

            }

        }

    }


    const dutch =
        getDutchWord(
            word
        );


    return dutch
        ? [dutch]
        : [];

}


/* =========================================================
   AI EXERCISE DETECTION
========================================================= */

/**
 * Imported AI exercises can exist in different V1.2/V2
 * property names.
 */
function getImportedAIExercises(
    word
) {

    if (!word) {

        return [];

    }


    const candidates = [

        word.aiExercises,

        word.ai_exercises,

        word.generatedExercises,

        word.generated_exercises,

        word.exercises,

        word.questions

    ];


    for (
        const candidate of candidates
    ) {

        if (
            Array.isArray(candidate) &&
            candidate.length > 0
        ) {

            return candidate;

        }

    }


    return [];

}


/* =========================================================
   AI EXERCISE TYPE
========================================================= */

function getAIExerciseType(
    exercise
) {

    if (!exercise) {

        return null;

    }


    return normalizeExerciseType(

        exercise.type ??
        exercise.exerciseType ??
        exercise.exercise_type ??
        exercise.kind ??
        exercise.mode

    );

}


/* =========================================================
   NORMALIZE AI EXERCISE
========================================================= */

/**
 * Convert imported AI exercise data into the common V2
 * question format.
 *
 * Existing AI content is preserved.
 */
function normalizeAIExercise(
    exercise,
    word
) {

    if (!exercise) {

        return null;

    }


    const type =
        getAIExerciseType(
            exercise
        );


    if (!type || type === "mixed") {

        return null;

    }


    const dutch =
        getDutchWord(
            word
        );


    const meaning =
        getEnglishMeaning(
            word
        );


    const prompt =
        exercise.prompt ??
        exercise.question ??
        exercise.instruction ??
        exercise.text ??
        "";


    const sentence =
        exercise.sentence ??
        exercise.example ??
        exercise.context ??
        "";


    const options =
        normalizeExerciseOptions(

            exercise.options ??
            exercise.choices ??
            exercise.answers ??
            []

        );


    let acceptedAnswers =
        normalizeAcceptedAnswersForExercise(
            exercise
        );


    /*
     * If AI data does not contain an answer, use the word as
     * the fallback answer.
     */
    if (
        acceptedAnswers.length === 0 &&
        (
            type === "recall" ||
            type === "fill" ||
            type === "production"
        )
    ) {

        acceptedAnswers =
            getWordAcceptedAnswers(
                word
            );

    }


    return {

        id:
            exercise.id ??
            generateExerciseId(
                type
            ),

        type,

        source:
            "ai",

        wordId:
            word.id ?? null,

        packId:
            word.packId ?? null,

        prompt:
            String(prompt).trim(),

        sentence:
            String(sentence).trim(),

        meaning:
            meaning,

        dutchWord:
            dutch,

        options,

        acceptedAnswers,

        correctAnswer:
            getCorrectAnswer(
                exercise,
                type,
                acceptedAnswers
            ),

        explanation:
            String(

                exercise.explanation ??
                exercise.feedback ??
                exercise.explanationText ??
                ""

            ).trim(),

        example:
            String(
                exercise.example ||
                ""
            ).trim(),

        metadata:
            exercise.metadata &&
            typeof exercise.metadata === "object"
                ? {
                    ...exercise.metadata
                }
                : {}

    };

}


/* =========================================================
   NORMALIZE ACCEPTED ANSWERS
========================================================= */

function normalizeAcceptedAnswersForExercise(
    exercise
) {

    const candidates = [

        exercise.acceptedAnswers,

        exercise.accepted_answers,

        exercise.correctAnswers,

        exercise.correct_answers,

        exercise.answer,

        exercise.correctAnswer,

        exercise.correct_answer,

        exercise.expectedAnswer,

        exercise.expected_answer

    ];


    for (
        const candidate of candidates
    ) {

        if (
            Array.isArray(candidate)
        ) {

            return candidate
                .filter(
                    value =>
                        value !== null &&
                        value !== undefined &&
                        String(value).trim() !== ""
                )
                .map(
                    value =>
                        String(value).trim()
                );

        }


        if (
            candidate !== null &&
            candidate !== undefined &&
            String(candidate).trim() !== ""
        ) {

            return [
                String(candidate).trim()
            ];

        }

    }


    return [];

}


/* =========================================================
   CORRECT ANSWER
========================================================= */

function getCorrectAnswer(
    exercise,
    type,
    acceptedAnswers
) {

    if (
        exercise.correctOption !== undefined
    ) {

        return exercise.correctOption;

    }


    if (
        exercise.correctIndex !== undefined
    ) {

        return exercise.correctIndex;

    }


    if (
        exercise.correctAnswer !== undefined
    ) {

        return exercise.correctAnswer;

    }


    if (
        exercise.answer !== undefined
    ) {

        return exercise.answer;

    }


    if (
        acceptedAnswers &&
        acceptedAnswers.length
    ) {

        return acceptedAnswers[0];

    }


    return "";

}


/* =========================================================
   NORMALIZE OPTIONS
========================================================= */

function normalizeExerciseOptions(
    options
) {

    if (
        !Array.isArray(options)
    ) {

        return [];

    }


    return options
        .map(
            (option, index) => {

                if (
                    option &&
                    typeof option === "object"
                ) {

                    return {

                        id:
                            option.id ??
                            index,

                        text:
                            String(

                                option.text ??
                                option.label ??
                                option.value ??
                                option.answer ??
                                ""

                            ).trim(),

                        correct:
                            Boolean(
                                option.correct ??
                                option.isCorrect
                            )

                    };

                }


                return {

                    id: index,

                    text:
                        String(
                            option
                        ).trim(),

                    correct: false

                };

            }
        )
        .filter(
            option =>
                option.text !== ""
        );

}


/* =========================================================
   GENERATE EXERCISE ID
========================================================= */

function generateExerciseId(
    type
) {

    return (

        "exercise-" +
        String(type) +
        "-" +
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 7)

    );

}


/* =========================================================
   FALLBACK: MEANING
========================================================= */

function createMeaningExercise(
    word
) {

    const dutch =
        getDutchWord(
            word
        );

    const meaning =
        getEnglishMeaning(
            word
        );


    const distractors =
        getMeaningDistractors(
            word
        );


    const options =
        shuffleArray([

            {
                id: "correct",

                text: meaning,

                correct: true

            },

            ...distractors.map(

                (value, index) => ({

                    id:
                        `wrong-${index}`,

                    text:
                        value,

                    correct:
                        false

                })

            )

        ]);


    return {

        id:
            generateExerciseId(
                "meaning"
            ),

        type:
            "meaning",

        source:
            "fallback",

        wordId:
            word.id ?? null,

        packId:
            word.packId ?? null,

        prompt:
            `What does "${dutch}" mean?`,

        sentence:
            "",

        meaning,

        dutchWord:
            dutch,

        options,

        acceptedAnswers:
            [meaning],

        correctAnswer:
            meaning,

        explanation:
            "",

        example:
            getWordExample(
                word
            ),

        metadata: {}

    };

}


/* =========================================================
   MEANING DISTRACTORS
========================================================= */

function getMeaningDistractors(
    word
) {

    /*
     * Prefer meanings supplied by the vocabulary data.
     */
    const candidates = [

        ...(Array.isArray(
            word?.meaningOptions
        )
            ? word.meaningOptions
            : []),

        ...(Array.isArray(
            word?.distractors
        )
            ? word.distractors
            : []),

        ...(Array.isArray(
            word?.wrongMeanings
        )
            ? word.wrongMeanings
            : [])

    ];


    const meaning =
        getEnglishMeaning(
            word
        );


    return candidates
        .map(
            value =>
                String(value).trim()
        )
        .filter(
            value =>
                value &&
                value.toLowerCase() !==
                meaning.toLowerCase()
        )
        .slice(
            0,
            3
        );

}


/* =========================================================
   FALLBACK: RECALL
========================================================= */

function createRecallExercise(
    word
) {

    const meaning =
        getEnglishMeaning(
            word
        );

    const dutch =
        getDutchWord(
            word
        );


    return {

        id:
            generateExerciseId(
                "recall"
            ),

        type:
            "recall",

        source:
            "fallback",

        wordId:
            word.id ?? null,

        packId:
            word.packId ?? null,

        prompt:
            `What is the Dutch word for "${meaning}"?`,

        sentence:
            "",

        meaning,

        dutchWord:
            dutch,

        options: [],

        acceptedAnswers:
            getWordAcceptedAnswers(
                word
            ),

        correctAnswer:
            dutch,

        explanation:
            "",

        example:
            getWordExample(
                word
            ),

        metadata: {}

    };

}


/* =========================================================
   FALLBACK: FILL SENTENCE
========================================================= */

function createFillExercise(
    word
) {

    const dutch =
        getDutchWord(
            word
        );


    const sentence =
        getWordExample(
            word
        );


    const masked =
        maskWordInSentence(
            sentence,
            dutch
        );


    return {

        id:
            generateExerciseId(
                "fill"
            ),

        type:
            "fill",

        source:
            "fallback",

        wordId:
            word.id ?? null,

        packId:
            word.packId ?? null,

        prompt:
            "Complete the sentence with the missing word.",

        sentence:
            masked,

        meaning:
            getEnglishMeaning(
                word
            ),

        dutchWord:
            dutch,

        options: [],

        acceptedAnswers:
            getWordAcceptedAnswers(
                word
            ),

        correctAnswer:
            dutch,

        explanation:
            "",

        example:
            sentence,

        metadata: {}

    };

}


/* =========================================================
   MASK WORD
========================================================= */

function maskWordInSentence(
    sentence,
    word
) {

    if (
        !sentence
    ) {

        return `... ______ ...`;

    }


    if (
        !word
    ) {

        return sentence;

    }


    const escaped =
        escapeRegExp(
            word
        );


    const regex =
        new RegExp(
            escaped,
            "iu"
        );


    if (
        regex.test(
            sentence
        )
    ) {

        return sentence.replace(
            regex,
            "______"
        );

    }


    /*
     * If the example doesn't contain the word exactly,
     * append a blank rather than destroying the example.
     */
    return (
        sentence +
        " ______"
    );

}


/* =========================================================
   FALLBACK: CHOOSE WORD
========================================================= */

function createChooseWordExercise(
    word
) {

    const dutch =
        getDutchWord(
            word
        );

    const sentence =
        getWordExample(
            word
        );


    const distractors =
        getWordDistractors(
            word
        );


    const options =
        shuffleArray([

            {

                id:
                    "correct",

                text:
                    dutch,

                correct:
                    true

            },

            ...distractors.map(

                (value, index) => ({

                    id:
                        `wrong-${index}`,

                    text:
                        value,

                    correct:
                        false

                })

            )

        ]);


    return {

        id:
            generateExerciseId(
                "choose"
            ),

        type:
            "choose",

        source:
            "fallback",

        wordId:
            word.id ?? null,

        packId:
            word.packId ?? null,

        prompt:
            "Which word best completes the sentence?",

        sentence:
            maskWordInSentence(
                sentence,
                dutch
            ),

        meaning:
            getEnglishMeaning(
                word
            ),

        dutchWord:
            dutch,

        options,

        acceptedAnswers:
            [dutch],

        correctAnswer:
            dutch,

        explanation:
            "",

        example:
            sentence,

        metadata: {}

    };

}


/* =========================================================
   WORD DISTRACTORS
========================================================= */

function getWordDistractors(
    word
) {

    const candidates = [

        ...(Array.isArray(
            word?.wordOptions
        )
            ? word.wordOptions
            : []),

        ...(Array.isArray(
            word?.distractorWords
        )
            ? word.distractorWords
            : []),

        ...(Array.isArray(
            word?.alternatives
        )
            ? word.alternatives
            : [])

    ];


    const dutch =
        getDutchWord(
            word
        );


    return candidates
        .map(
            value =>
                String(value).trim()
        )
        .filter(
            value =>
                value &&
                value.toLowerCase() !==
                dutch.toLowerCase()
        )
        .slice(
            0,
            3
        );

}


/* =========================================================
   FALLBACK: PRODUCTION
========================================================= */

function createProductionExercise(
    word
) {

    const meaning =
        getEnglishMeaning(
            word
        );

    const dutch =
        getDutchWord(
            word
        );


    return {

        id:
            generateExerciseId(
                "production"
            ),

        type:
            "production",

        source:
            "fallback",

        wordId:
            word.id ?? null,

        packId:
            word.packId ?? null,

        prompt:
            `Produce the Dutch word or expression for "${meaning}".`,

        sentence:
            "",

        meaning,

        dutchWord:
            dutch,

        options: [],

        acceptedAnswers:
            getWordAcceptedAnswers(
                word
            ),

        correctAnswer:
            dutch,

        explanation:
            "",

        example:
            getWordExample(
                word
            ),

        metadata: {}

    };

}


/* =========================================================
   EXAMPLE
========================================================= */

function getWordExample(
    word
) {

    if (!word) {

        return "";

    }


    return String(

        word.example ??
        word.exampleSentence ??
        word.sentence ??
        word.context ??
        ""

    ).trim();

}


/* =========================================================
   ESCAPE REGEXP
========================================================= */

function escapeRegExp(
    value
) {

    return String(
        value
    ).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}


/* =========================================================
   CREATE FALLBACK EXERCISE
========================================================= */

function createFallbackExercise(
    word,
    type
) {

    const normalized =
        normalizeExerciseType(
            type
        );


    switch (
        normalized
    ) {

        case "meaning":

            return createMeaningExercise(
                word
            );


        case "recall":

            return createRecallExercise(
                word
            );


        case "fill":

            return createFillExercise(
                word
            );


        case "choose":

            return createChooseWordExercise(
                word
            );


        case "production":

            return createProductionExercise(
                word
            );


        default:

            return createMeaningExercise(
                word
            );

    }

}


/* =========================================================
   FIND AI EXERCISE
========================================================= */

/**
 * Find an imported AI exercise matching the requested type.
 *
 * AI exercises are preferred over fallback exercises.
 */
function findAIExerciseForType(
    word,
    type
) {

    const normalized =
        normalizeExerciseType(
            type
        );


    const imported =
        getImportedAIExercises(
            word
        );


    if (
        imported.length === 0
    ) {

        return null;

    }


    const matching =
        imported.find(
            exercise =>
                getAIExerciseType(
                    exercise
                ) === normalized
        );


    if (!matching) {

        return null;

    }


    return normalizeAIExercise(
        matching,
        word
    );

}


/* =========================================================
   CREATE EXERCISE
========================================================= */

/**
 * Main exercise factory.
 *
 * Priority:
 *
 * 1. Existing AI-generated exercise
 * 2. Existing compatible exercise data
 * 3. Generated fallback exercise
 */
function createExercise(
    word,
    type
) {

    if (!word) {

        throw new Error(
            "Cannot create exercise without a word."
        );

    }


    const normalized =
        normalizeExerciseType(
            type
        );


    if (
        !normalized ||
        normalized === "mixed"
    ) {

        throw new Error(
            `Invalid exercise type: ${type}`
        );

    }


    /*
     * FIRST: use imported AI content.
     */
    const aiExercise =
        findAIExerciseForType(
            word,
            normalized
        );


    if (aiExercise) {

        return aiExercise;

    }


    /*
     * SECOND: fallback.
     */
    return createFallbackExercise(
        word,
        normalized
    );

}


/* =========================================================
   CREATE ALL EXERCISES FOR WORD
========================================================= */

function createExercisesForWord(
    word
) {

    return EXERCISE_TYPE_ORDER.map(
        type =>
            createExercise(
                word,
                type
            )
    );

}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffleArray(
    array
) {

    const result =
        Array.isArray(array)
            ? [...array]
            : [];


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
        ] =
        [
            result[j],
            result[i]
        ];

    }


    return result;

}


/* =========================================================
   MIXED EXERCISE DISTRIBUTION
========================================================= */

/**
 * Create a controlled Mixed Practice sequence.
 *
 * This intentionally does NOT randomly choose an exercise type
 * for every question.
 *
 * Instead, the five exercise types are distributed across the
 * requested question count as evenly as possible.
 *
 * Example:
 *
 * 10 questions:
 *
 * Meaning      2
 * Recall       2
 * Fill         2
 * Choose       2
 * Production   2
 *
 *
 * 7 questions:
 *
 * Meaning      2
 * Recall       2
 * Fill         1
 * Choose       1
 * Production   1
 */
function buildMixedExerciseTypes(
    questionCount
) {

    const count =
        Math.max(
            1,
            Number(
                questionCount || 1
            )
        );


    const result = [];


    /*
     * Round-robin distribution guarantees that every exercise
     * type is represented before any type receives a second
     * question.
     */
    for (
        let i = 0;
        i < count;
        i++
    ) {

        result.push(

            EXERCISE_TYPE_ORDER[
                i %
                EXERCISE_TYPE_ORDER.length
            ]

        );

    }


    /*
     * Shuffle only the completed distribution.
     *
     * This preserves balanced counts while preventing every
     * Mixed session from always starting with Meaning.
     */
    return shuffleArray(
        result
    );

}


/* =========================================================
   BUILD SESSION EXERCISES
========================================================= */

/**
 * Build exercises for a complete practice session.
 *
 * `type` can be:
 *
 * meaning
 * recall
 * fill
 * choose
 * production
 * mixed
 */
function buildSessionExercises(
    words,
    type,
    questionCount
) {

    const vocabulary =
        Array.isArray(words)
            ? words
            : [];


    const count =
        Math.min(

            Math.max(
                1,
                Number(
                    questionCount ||
                    vocabulary.length
                )
            ),

            vocabulary.length

        );


    if (
        count === 0
    ) {

        return [];

    }


    const normalizedType =
        normalizeExerciseType(
            type
        );


    /*
     * Select words first.
     *
     * This guarantees that question count refers to words,
     * not generated exercise records.
     */
    const selectedWords =
        selectWordsForSession(
            vocabulary,
            count
        );


    /*
     * MIXED
     */
    if (
        normalizedType === "mixed"
    ) {

        const exerciseTypes =
            buildMixedExerciseTypes(
                count
            );


        return selectedWords.map(

            (word, index) => {

                const exerciseType =
                    exerciseTypes[index];


                const exercise =
                    createExercise(
                        word,
                        exerciseType
                    );


                return {

                    ...exercise,

                    sessionIndex:
                        index,

                    requestedType:
                        "mixed",

                    actualType:
                        exerciseType

                };

            }

        );

    }


    /*
     * SINGLE TYPE
     */
    return selectedWords.map(

        (word, index) => {

            const exercise =
                createExercise(
                    word,
                    normalizedType
                );


            return {

                ...exercise,

                sessionIndex:
                    index,

                requestedType:
                    normalizedType,

                actualType:
                    normalizedType

            };

        }

    );

}


/* =========================================================
   SELECT WORDS FOR SESSION
========================================================= */

/**
 * Select words without duplicates.
 *
 * The caller is expected to pass the already filtered
 * "selected vocabulary".
 */
function selectWordsForSession(
    words,
    count
) {

    const vocabulary =
        Array.isArray(words)
            ? words.filter(Boolean)
            : [];


    if (
        vocabulary.length <= count
    ) {

        return shuffleArray(
            vocabulary
        );

    }


    /*
     * Random selection without duplicates.
     */
    return shuffleArray(
        vocabulary
    ).slice(
        0,
        count
    );

}


/* =========================================================
   EXERCISE ANSWER TYPE
========================================================= */

function isTypedExercise(
    exercise
) {

    if (!exercise) {

        return false;

    }


    return (

        exercise.type === "recall" ||
        exercise.type === "fill" ||
        exercise.type === "production"

    );

}


/* =========================================================
   EXERCISE IS MULTIPLE CHOICE
========================================================= */

function isChoiceExercise(
    exercise
) {

    if (!exercise) {

        return false;

    }


    return (

        exercise.type === "meaning" ||
        exercise.type === "choose"

    );

}


/* =========================================================
   CHECK CHOICE ANSWER
========================================================= */

/**
 * Check a Meaning / Choose Word answer.
 *
 * Typed exercises must use similarity.js instead.
 */
function checkChoiceAnswer(
    exercise,
    selectedOption
) {

    if (!exercise) {

        return {

            correct: false,

            selectedOption,

            expectedAnswer: ""

        };

    }


    const options =
        exercise.options || [];


    /*
     * Support either an option ID, index, or text.
     */
    let selected =
        null;


    if (
        typeof selectedOption === "number"
    ) {

        selected =
            options[
                selectedOption
            ] || null;

    } else {

        selected =
            options.find(

                option =>
                    String(
                        option.id
                    ) ===
                    String(
                        selectedOption
                    )

            ) ||

            options.find(

                option =>
                    String(
                        option.text
                    ) ===
                    String(
                        selectedOption
                    )

            ) ||

            null;

    }


    /*
     * AI exercises may not have `correct: true` on the option
     * but may instead specify a correctAnswer.
     */
    if (!selected) {

        return {

            correct: false,

            selectedOption,

            expectedAnswer:
                exercise.correctAnswer ?? ""

        };

    }


    let correct =
        Boolean(
            selected.correct
        );


    if (
        !correct &&
        exercise.correctAnswer !== undefined
    ) {

        correct =
            String(
                selected.text
            ).trim().toLocaleLowerCase(
                "nl-NL"
            ) ===
            String(
                exercise.correctAnswer
            ).trim().toLocaleLowerCase(
                "nl-NL"
            );

    }


    return {

        correct,

        selectedOption:
            selected.text,

        selectedOptionId:
            selected.id,

        expectedAnswer:
            exercise.correctAnswer ??
            options.find(
                option =>
                    option.correct
            )?.text ??
            ""

    };

}


/* =========================================================
   GET DISPLAY TITLE
========================================================= */

function getExerciseDisplayTitle(
    type
) {

    const normalized =
        normalizeExerciseType(
            type
        );


    return (
        EXERCISE_TYPES[
            normalized
        ]?.label ||
        "Practice"
    );

}


/* =========================================================
   GET DISPLAY DESCRIPTION
========================================================= */

function getExerciseDisplayDescription(
    type
) {

    const normalized =
        normalizeExerciseType(
            type
        );


    return (
        EXERCISE_TYPES[
            normalized
        ]?.description ||
        ""
    );

}


/* =========================================================
   EXERCISE SUMMARY
========================================================= */

function getExerciseSummary(
    exercise
) {

    if (!exercise) {

        return null;

    }


    return {

        id:
            exercise.id,

        type:
            exercise.type,

        label:
            getExerciseDisplayTitle(
                exercise.type
            ),

        source:
            exercise.source ||
            "fallback",

        wordId:
            exercise.wordId,

        packId:
            exercise.packId,

        typed:
            isTypedExercise(
                exercise
            ),

        choice:
            isChoiceExercise(
                exercise
            )

    };

}