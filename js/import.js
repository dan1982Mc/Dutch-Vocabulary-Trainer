/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   import.js

   Responsibilities:
   - Import JSON Word Packs
   - Validate imported data
   - Create / update explicit Word Pack records
   - Assign proper packId to every imported word
   - Preserve Word Pack metadata
   - Preserve imported AI exercises
   - Preserve existing V1.2 vocabulary data
   - Prevent accidental duplicate imports
   - Merge imported vocabulary safely
   - Refresh selection / dashboard after import
   - Expose import API to UI
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const IMPORT_VERSION = "2.0.0";

const IMPORT_LIMITS = {

    maxFileSize:
        10 * 1024 * 1024,

    maxWords:
        10000,

    maxExercisesPerWord:
        100

};


/* =========================================================
   IMPORT STATE
========================================================= */

const ImportState = {

    initialized:
        false,

    importing:
        false,

    lastResult:
        null,

    lastError:
        null

};


/* =========================================================
   NORMALIZE TEXT
========================================================= */

function normalizeImportText(
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
    ).trim();

}


/* =========================================================
   NORMALIZE ID
========================================================= */

function normalizeImportId(
    value
) {

    const text =
        normalizeImportText(
            value
        );


    if (!text) {

        return null;

    }


    return text;

}


/* =========================================================
   GENERATE ID
========================================================= */

function generateImportId(
    prefix = "id"
) {

    if (
        typeof crypto !==
        "undefined" &&
        typeof crypto.randomUUID ===
        "function"
    ) {

        return `${prefix}_${crypto.randomUUID()}`;

    }


    return (

        `${prefix}_` +

        Date.now().toString(36) +

        "_" +

        Math.random()
            .toString(36)
            .slice(2, 10)

    );

}


/* =========================================================
   SLUGIFY
========================================================= */

function importSlugify(
    value
) {

    return normalizeImportText(
        value
    )
        .toLowerCase()
        .normalize(
            "NFD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        );

}


/* =========================================================
   GET PACK NAME
========================================================= */

function getImportedPackName(
    data
) {

    const metadata =
        data?.metadata ||
        data?.pack ||
        data?.wordPack ||
        {};


    return (

        normalizeImportText(

            metadata.name ??

            data.name ??

            data.packName ??

            data.title ??

            "Imported Word Pack"

        )

    );

}


/* =========================================================
   GET PACK DESCRIPTION
========================================================= */

function getImportedPackDescription(
    data
) {

    const metadata =
        data?.metadata ||
        data?.pack ||
        data?.wordPack ||
        {};


    return (

        normalizeImportText(

            metadata.description ??

            data.description ??

            ""

        )

    );

}


/* =========================================================
   GET PACK AUTHOR
========================================================= */

function getImportedPackAuthor(
    data
) {

    const metadata =
        data?.metadata ||
        data?.pack ||
        data?.wordPack ||
        {};


    return (

        normalizeImportText(

            metadata.author ??

            data.author ??

            ""

        )

    );

}


/* =========================================================
   GET PACK VERSION
========================================================= */

function getImportedPackVersion(
    data
) {

    const metadata =
        data?.metadata ||
        data?.pack ||
        data?.wordPack ||
        {};


    return (

        normalizeImportText(

            metadata.version ??

            data.packVersion ??

            data.version ??

            "1.0"

        )

    );

}


/* =========================================================
   GET PACK SOURCE
========================================================= */

function getImportedPackSource(
    data
) {

    const metadata =
        data?.metadata ||
        data?.pack ||
        data?.wordPack ||
        {};


    return (

        normalizeImportText(

            metadata.source ??

            data.source ??

            ""

        )

    );

}


/* =========================================================
   GET PACK IMAGE
========================================================= */

function getImportedPackImage(
    data
) {

    const metadata =
        data?.metadata ||
        data?.pack ||
        data?.wordPack ||
        {};


    return (

        metadata.image ??
        metadata.cover ??
        data.image ??
        data.cover ??
        null

    );

}


/* =========================================================
   GET WORD ARRAY
========================================================= */

function extractImportedWords(
    data
) {

    if (
        Array.isArray(
            data
        )
    ) {

        return data;

    }


    const candidates = [

        data?.words,

        data?.vocabulary,

        data?.terms,

        data?.entries,

        data?.items,

        data?.data?.words,

        data?.data?.vocabulary

    ];


    for (
        const candidate
        of candidates
    ) {

        if (
            Array.isArray(
                candidate
            )
        ) {

            return candidate;

        }

    }


    return [];

}


/* =========================================================
   VALIDATE JSON STRUCTURE
========================================================= */

function validateImportedData(
    data
) {

    const errors = [];


    if (
        data === null ||
        data === undefined
    ) {

        errors.push(
            "The imported file is empty."
        );


        return {

            valid:
                false,

            errors

        };

    }


    if (
        typeof data !==
            "object"
    ) {

        errors.push(
            "The imported file must contain JSON data."
        );


        return {

            valid:
                false,

            errors

        };

    }


    const words =
        extractImportedWords(
            data
        );


    if (
        words.length === 0
    ) {

        errors.push(
            "No vocabulary words were found in the imported file."
        );

    }


    if (
        words.length >
        IMPORT_LIMITS.maxWords
    ) {

        errors.push(

            `The Word Pack contains ${words.length} words. ` +
            `The maximum allowed is ${IMPORT_LIMITS.maxWords}.`

        );

    }


    return {

        valid:
            errors.length === 0,

        errors,

        wordCount:
            words.length

    };

}


/* =========================================================
   NORMALIZE EXERCISE
========================================================= */

function normalizeImportedExercise(
    exercise,
    word
) {

    if (
        !exercise ||
        typeof exercise !==
            "object"
    ) {

        return null;

    }


    const normalized = {

        ...exercise

    };


    /*
     * Preserve the imported AI-generated exercise source.
     */
    normalized.source =
        exercise.source ??
        exercise.generatedBy ??
        exercise.aiGenerated
            ? "ai"
            : (
                exercise.source ??
                "import"
            );


    normalized.type =
        normalizeImportedExerciseType(

            exercise.type ??
            exercise.exerciseType ??
            "meaning"

        );


    /*
     * Preserve all common question/answer fields.
     */
    if (
        exercise.question !==
        undefined
    ) {

        normalized.question =
            exercise.question;

    }


    if (
        exercise.prompt !==
        undefined
    ) {

        normalized.prompt =
            exercise.prompt;

    }


    if (
        exercise.sentence !==
        undefined
    ) {

        normalized.sentence =
            exercise.sentence;

    }


    if (
        exercise.answer !==
        undefined
    ) {

        normalized.answer =
            exercise.answer;

    }


    if (
        exercise.correctAnswer !==
        undefined
    ) {

        normalized.correctAnswer =
            exercise.correctAnswer;

    }


    if (
        exercise.acceptedAnswers !==
        undefined
    ) {

        normalized.acceptedAnswers =
            Array.isArray(
                exercise.acceptedAnswers
            )
                ? [
                    ...exercise.acceptedAnswers
                ]
                : exercise.acceptedAnswers;

    }


    if (
        exercise.options !==
        undefined
    ) {

        normalized.options =
            Array.isArray(
                exercise.options
            )
                ? [
                    ...exercise.options
                ]
                : exercise.options;

    }


    /*
     * Keep AI metadata.
     */
    if (
        exercise.ai !==
        undefined
    ) {

        normalized.ai =
            exercise.ai;

    }


    if (
        exercise.aiGenerated !==
        undefined
    ) {

        normalized.aiGenerated =
            exercise.aiGenerated;

    }


    if (
        exercise.model !==
        undefined
    ) {

        normalized.model =
            exercise.model;

    }


    if (
        exercise.generatedAt !==
        undefined
    ) {

        normalized.generatedAt =
            exercise.generatedAt;

    }


    /*
     * Attach word reference where possible.
     */
    normalized.wordId =
        exercise.wordId ??
        word.id ??
        null;


    return normalized;

}


/* =========================================================
   NORMALIZE EXERCISE TYPE
========================================================= */

function normalizeImportedExerciseType(
    type
) {

    const value =
        normalizeImportText(
            type
        )
        .toLowerCase()
        .replace(
            /[\s_-]+/g,
            ""
        );


    const aliases = {

        meaning:
            "meaning",

        definition:
            "meaning",

        recall:
            "recall",

        recognition:
            "recall",

        fillsentence:
            "fill",

        sentence:
            "fill",

        fill:
            "fill",

        chooseword:
            "choose",

        multiplechoice:
            "choose",

        choose:
            "choose",

        production:
            "production",

        translate:
            "production",

        translation:
            "production"

    };


    return (

        aliases[value] ??
        "meaning"

    );

}


/* =========================================================
   NORMALIZE EXERCISE ARRAY
========================================================= */

function normalizeImportedExercises(
    word
) {

    const source =
        word.exercises ??
        word.aiExercises ??
        word.generatedExercises ??
        [];


    if (
        !Array.isArray(
            source
        )
    ) {

        return [];

    }


    return source

        .slice(
            0,
            IMPORT_LIMITS.maxExercisesPerWord
        )

        .map(

            exercise =>

                normalizeImportedExercise(
                    exercise,
                    word
                )

        )

        .filter(
            Boolean
        );

}


/* =========================================================
   NORMALIZE IMPORTED WORD
========================================================= */

function normalizeImportedWord(
    rawWord,
    packId
) {

    if (
        !rawWord ||
        typeof rawWord !==
            "object"
    ) {

        return null;

    }


    const word =
        {

            ...rawWord

        };


    /*
     * -------------------------------------------------------
     * IDENTITY
     * -------------------------------------------------------
     */

    const importedId =
        normalizeImportId(

            rawWord.id ??
            rawWord.wordId ??
            rawWord.termId

        );


    word.id =
        importedId ??
        generateImportId(
            "word"
        );


    /*
     * -------------------------------------------------------
     * WORD TEXT
     * -------------------------------------------------------
     */

    word.word =
        normalizeImportText(

            rawWord.word ??
            rawWord.term ??
            rawWord.dutch ??
            rawWord.text

        );


    word.term =
        normalizeImportText(

            rawWord.term ??
            word.word

        );


    /*
     * -------------------------------------------------------
     * MEANING
     * -------------------------------------------------------
     */

    word.meaning =

        rawWord.meaning ??
        rawWord.definition ??
        rawWord.translation ??
        "";


    /*
     * Preserve alternative fields if they exist.
     */
    if (
        rawWord.example !==
        undefined
    ) {

        word.example =
            rawWord.example;

    }


    if (
        rawWord.examples !==
        undefined
    ) {

        word.examples =
            rawWord.examples;

    }


    if (
        rawWord.notes !==
        undefined
    ) {

        word.notes =
            rawWord.notes;

    }


    if (
        rawWord.partOfSpeech !==
        undefined
    ) {

        word.partOfSpeech =
            rawWord.partOfSpeech;

    }


    if (
        rawWord.grammar !==
        undefined
    ) {

        word.grammar =
            rawWord.grammar;

    }


    /*
     * -------------------------------------------------------
     * PROPER PACK ID
     * -------------------------------------------------------
     *
     * This is the canonical V2 field.
     */
    word.packId =
        packId;


    /*
     * Preserve the original pack information where present.
     */
    if (
        rawWord.packName !==
        undefined
    ) {

        word.packName =
            rawWord.packName;

    }


    /*
     * -------------------------------------------------------
     * EXERCISES
     * -------------------------------------------------------
     *
     * Imported AI exercises are intentionally preserved.
     */
    word.exercises =
        normalizeImportedExercises(
            rawWord
        );


    /*
     * -------------------------------------------------------
     * MASTERY
     * -------------------------------------------------------
     *
     * Imported mastery is retained.
     * Missing mastery starts at zero.
     */
    if (
        rawWord.mastery !==
        undefined
    ) {

        word.mastery =
            Number(
                rawWord.mastery
            );

    } else if (
        rawWord.masteryScore !==
        undefined
    ) {

        word.mastery =
            Number(
                rawWord.masteryScore
            );

    } else if (
        rawWord.score !==
        undefined
    ) {

        word.mastery =
            Number(
                rawWord.score
            );

    } else {

        word.mastery =
            0;

    }


    if (
        !Number.isFinite(
            word.mastery
        )
    ) {

        word.mastery =
            0;

    }


    word.mastery =
        Math.max(

            0,

            Math.min(

                100,

                Math.round(
                    word.mastery
                )

            )

        );


    /*
     * -------------------------------------------------------
     * STATS
     * -------------------------------------------------------
     *
     * Existing V1.2 statistics are preserved.
     */
    if (
        rawWord.stats &&
        typeof rawWord.stats ===
            "object"
    ) {

        word.stats = {

            ...rawWord.stats,

            byExerciseType:
                rawWord.stats.byExerciseType
                    ? {
                        ...rawWord.stats
                            .byExerciseType
                    }
                    : {}

        };

    }


    /*
     * -------------------------------------------------------
     * HISTORY
     * -------------------------------------------------------
     */

    if (
        Array.isArray(
            rawWord.history
        )
    ) {

        word.history =
            [
                ...rawWord.history
            ];

    } else if (
        Array.isArray(
            rawWord.answerHistory
        )
    ) {

        word.history =
            [
                ...rawWord.answerHistory
            ];

    }


    /*
     * -------------------------------------------------------
     * REVIEW DATA
     * -------------------------------------------------------
     */

    if (
        rawWord.dueAt !==
        undefined
    ) {

        word.dueAt =
            rawWord.dueAt;

    }


    if (
        rawWord.nextReview !==
        undefined &&
        word.dueAt ===
        undefined
    ) {

        word.dueAt =
            rawWord.nextReview;

    }


    if (
        rawWord.nextReviewAt !==
        undefined &&
        word.dueAt ===
        undefined
    ) {

        word.dueAt =
            rawWord.nextReviewAt;

    }


    /*
     * -------------------------------------------------------
     * TIMESTAMPS
     * -------------------------------------------------------
     */

    word.createdAt =
        rawWord.createdAt ??
        new Date().toISOString();


    word.updatedAt =
        new Date().toISOString();


    /*
     * -------------------------------------------------------
     * SOURCE
     * -------------------------------------------------------
     */

    word.source =
        rawWord.source ??
        "import";


    /*
     * -------------------------------------------------------
     * IMPORT METADATA
     * -------------------------------------------------------
     */

    word.imported =
        true;


    word.importedAt =
        new Date().toISOString();


    return word;

}


/* =========================================================
   CREATE PACK OBJECT
========================================================= */

function createImportedPack(
    data
) {

    const name =
        getImportedPackName(
            data
        );


    const metadata =
        data?.metadata ||
        data?.pack ||
        data?.wordPack ||
        {};


    /*
     * Prefer an explicitly supplied packId.
     *
     * If absent, generate one from metadata/name.
     */
    const suppliedPackId =
        normalizeImportId(

            metadata.packId ??
            data.packId ??
            metadata.id ??
            data.pack?.id

        );


    const packId =
        suppliedPackId ??
        (
            "pack_" +
            importSlugify(
                name
            ) +
            "_" +
            Date.now().toString(36)
        );


    const now =
        new Date().toISOString();


    return {

        packId,

        id:
            packId,

        name,

        description:
            getImportedPackDescription(
                data
            ),

        author:
            getImportedPackAuthor(
                data
            ),

        version:
            getImportedPackVersion(
                data
            ),

        source:
            getImportedPackSource(
                data
            ),

        image:
            getImportedPackImage(
                data
            ),

        language:
            metadata.language ??
            data.language ??
            "nl",

        targetLanguage:
            metadata.targetLanguage ??
            data.targetLanguage ??
            "en",

        category:
            metadata.category ??
            data.category ??
            "",

        tags:
            Array.isArray(
                metadata.tags
            )
                ? [
                    ...metadata.tags
                ]
                : (
                    Array.isArray(
                        data.tags
                    )
                        ? [
                            ...data.tags
                        ]
                        : []
                ),

        wordCount:
            extractImportedWords(
                data
            ).length,

        imported:
            true,

        importedAt:
            now,

        createdAt:
            metadata.createdAt ??
            now,

        updatedAt:
            now,

        metadata: {

            ...metadata

        }

    };

}


/* =========================================================
   GET EXISTING WORD
========================================================= */

async function getExistingImportedWord(
    wordId
) {

    if (
        !wordId
    ) {

        return null;

    }


    if (
        typeof getWordById ===
        "function"
    ) {

        return await getWordById(
            wordId
        );

    }


    if (
        typeof getVocabularyWord ===
        "function"
    ) {

        return await getVocabularyWord(
            wordId
        );

    }


    if (
        typeof getAllWords ===
        "function"
    ) {

        const words =
            await getAllWords();


        return words.find(

            word =>
                String(
                    word.id
                ) ===
                String(
                    wordId
                )

        ) ?? null;

    }


    return null;

}


/* =========================================================
   FIND DUPLICATE BY WORD + PACK
========================================================= */

async function findDuplicateImportedWord(
    word,
    packId
) {

    if (
        typeof findWordByTextAndPack ===
        "function"
    ) {

        return await findWordByTextAndPack(

            word.word,

            packId

        );

    }


    if (
        typeof getAllWords !==
        "function"
    ) {

        return null;

    }


    const words =
        await getAllWords();


    const normalizedWord =
        normalizeImportText(
            word.word
        ).toLowerCase();


    return words.find(

        existing =>

            String(
                existing.packId ??
                ""
            ) ===
            String(
                packId
            ) &&

            normalizeImportText(
                existing.word ??
                existing.term
            ).toLowerCase() ===
            normalizedWord

    ) ?? null;

}


/* =========================================================
   MERGE STATS
========================================================= */

function mergeImportedStats(
    existing,
    imported
) {

    if (
        !existing &&
        !imported
    ) {

        return undefined;

    }


    const result = {

        ...(existing || {}),

        ...(imported || {})

    };


    /*
     * Preserve existing performance rather than replacing
     * it with zero values from a newly imported copy.
     */
    if (
        existing
    ) {

        result.attempts =
            Number(
                existing.attempts ||
                0
            );

        result.correct =
            Number(
                existing.correct ||
                0
            );

        result.incorrect =
            Number(
                existing.incorrect ||
                0
            );

        result.consecutiveCorrect =
            Number(
                existing.consecutiveCorrect ||
                0
            );

        result.consecutiveIncorrect =
            Number(
                existing.consecutiveIncorrect ||
                0
            );

    }


    /*
     * Preserve per-exercise statistics.
     */
    result.byExerciseType = {

        ...(existing?.byExerciseType || {}),

        ...(imported?.byExerciseType || {})

    };


    return result;

}


/* =========================================================
   MERGE HISTORY
========================================================= */

function mergeImportedHistory(
    existing,
    imported
) {

    const existingHistory =
        Array.isArray(
            existing?.history
        )
            ? existing.history
            : [];


    const importedHistory =
        Array.isArray(
            imported?.history
        )
            ? imported.history
            : [];


    if (
        existingHistory.length ===
        0
    ) {

        return importedHistory;

    }


    if (
        importedHistory.length ===
        0
    ) {

        return existingHistory;

    }


    /*
     * Do not blindly duplicate identical history records.
     */
    const combined = [

        ...existingHistory,

        ...importedHistory

    ];


    const seen =
        new Set();


    return combined.filter(

        entry => {

            const key =
                JSON.stringify({

                    timestamp:
                        entry.timestamp,

                    wordId:
                        entry.wordId,

                    exerciseType:
                        entry.exerciseType,

                    correct:
                        entry.correct,

                    userAnswer:
                        entry.userAnswer

                });


            if (
                seen.has(
                    key
                )
            ) {

                return false;

            }


            seen.add(
                key
            );


            return true;

        }

    );

}


/* =========================================================
   MERGE EXERCISES
========================================================= */

function mergeImportedExercises(
    existing,
    imported
) {

    const existingExercises =
        Array.isArray(
            existing?.exercises
        )
            ? existing.exercises
            : [];


    const importedExercises =
        Array.isArray(
            imported?.exercises
        )
            ? imported.exercises
            : [];


    if (
        importedExercises.length ===
        0
    ) {

        return existingExercises;

    }


    if (
        existingExercises.length ===
        0
    ) {

        return importedExercises;

    }


    /*
     * Preserve existing exercises and add imported AI
     * exercises which do not already exist.
     */
    const result = [

        ...existingExercises

    ];


    for (
        const exercise
        of importedExercises
    ) {

        const duplicate =
            existingExercises.some(

                existingExercise =>

                    normalizeImportedExerciseType(
                        existingExercise.type
                    ) ===
                    normalizeImportedExerciseType(
                        exercise.type
                    ) &&

                    normalizeImportText(
                        existingExercise.question ??
                        existingExercise.prompt ??
                        existingExercise.sentence
                    ) ===
                    normalizeImportText(
                        exercise.question ??
                        exercise.prompt ??
                        exercise.sentence
                    )

            );


        if (
            !duplicate
        ) {

            result.push(
                exercise
            );

        }

    }


    return result.slice(
        0,
        IMPORT_LIMITS.maxExercisesPerWord
    );

}


/* =========================================================
   MERGE WORD
========================================================= */

function mergeImportedWord(
    existing,
    imported
) {

    if (
        !existing
    ) {

        return imported;

    }


    const merged = {

        ...existing,

        ...imported

    };


    /*
     * Existing mastery MUST survive import.
     *
     * Importing a Word Pack must never reset a user's
     * learning progress.
     */
    if (
        existing.mastery !==
        undefined
    ) {

        merged.mastery =
            existing.mastery;

    }


    /*
     * Existing stats survive.
     */
    merged.stats =
        mergeImportedStats(

            existing.stats,

            imported.stats

        );


    /*
     * Existing history survives.
     */
    const mergedHistory =
        mergeImportedHistory(

            existing,

            imported

        );


    if (
        mergedHistory.length > 0
    ) {

        merged.history =
            mergedHistory;

    }


    /*
     * Preserve all exercises while adding new imported AI
     * exercises.
     */
    merged.exercises =
        mergeImportedExercises(

            existing,

            imported

        );


    /*
     * Existing review state should survive importing a
     * duplicate word.
     */
    if (
        existing.dueAt !==
        undefined
    ) {

        merged.dueAt =
            existing.dueAt;

    }


    if (
        existing.isDue !==
        undefined
    ) {

        merged.isDue =
            existing.isDue;

    }


    if (
        existing.lastPracticedAt !==
        undefined
    ) {

        merged.lastPracticedAt =
            existing.lastPracticedAt;

    }


    /*
     * Keep the existing canonical identity.
     */
    merged.id =
        existing.id;


    /*
     * The pack remains the imported pack.
     */
    merged.packId =
        imported.packId;


    merged.updatedAt =
        new Date().toISOString();


    return merged;

}


/* =========================================================
   SAVE PACK
========================================================= */

async function saveImportedPack(
    pack
) {

    if (
        typeof savePack ===
        "function"
    ) {

        return await savePack(
            pack
        );

    }


    if (
        typeof createPack ===
        "function"
    ) {

        return await createPack(
            pack
        );

    }


    if (
        typeof upsertPack ===
        "function"
    ) {

        return await upsertPack(
            pack
        );

    }


    throw new Error(
        "No pack storage function is available."
    );

}


/* =========================================================
   SAVE WORD
========================================================= */

async function saveImportedWord(
    word
) {

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
        typeof addWord ===
        "function"
    ) {

        return await addWord(
            word
        );

    }


    throw new Error(
        "No vocabulary storage function is available."
    );

}


/* =========================================================
   IMPORT DATA
========================================================= */

/**
 * Main import function.
 *
 * Options:
 *
 * {
 *   mode: "merge" | "replace",
 *   selectImportedPack: true | false
 * }
 */
async function importWordPack(
    data,
    options = {}
) {

    if (
        ImportState.importing
    ) {

        throw new Error(
            "An import is already in progress."
        );

    }


    ImportState.importing =
        true;

    ImportState.lastError =
        null;


    try {

        /*
         * ---------------------------------------------------
         * Validate
         * ---------------------------------------------------
         */

        const validation =
            validateImportedData(
                data
            );


        if (
            !validation.valid
        ) {

            throw new Error(

                validation.errors.join(
                    " "
                )

            );

        }


        /*
         * ---------------------------------------------------
         * Create explicit pack
         * ---------------------------------------------------
         */

        const pack =
            createImportedPack(
                data
            );


        const rawWords =
            extractImportedWords(
                data
            );


        /*
         * ---------------------------------------------------
         * Save pack first
         * ---------------------------------------------------
         */

        await saveImportedPack(
            pack
        );


        let added = 0;

        let updated = 0;

        let skipped = 0;


        const importedWords = [];


        /*
         * ---------------------------------------------------
         * Import each word
         * ---------------------------------------------------
         */

        for (
            const rawWord
            of rawWords
        ) {

            const normalizedWord =
                normalizeImportedWord(

                    rawWord,

                    pack.packId

                );


            if (
                !normalizedWord ||
                !normalizedWord.word
            ) {

                skipped++;

                continue;

            }


            /*
             * First check explicit word ID.
             */
            let existing =
                await getExistingImportedWord(

                    normalizedWord.id

                );


            /*
             * Then check same word inside same pack.
             */
            if (
                !existing
            ) {

                existing =
                    await findDuplicateImportedWord(

                        normalizedWord,

                        pack.packId

                    );

            }


            if (
                existing
            ) {

                const merged =
                    mergeImportedWord(

                        existing,

                        normalizedWord

                    );


                await saveImportedWord(
                    merged
                );


                importedWords.push(
                    merged
                );


                updated++;

            } else {

                await saveImportedWord(
                    normalizedWord
                );


                importedWords.push(
                    normalizedWord
                );


                added++;

            }

        }


        /*
         * ---------------------------------------------------
         * Update pack word count
         * ---------------------------------------------------
         */

        pack.wordCount =
            importedWords.length;


        pack.updatedAt =
            new Date().toISOString();


        await saveImportedPack(
            pack
        );


        /*
         * ---------------------------------------------------
         * Refresh application state
         * ---------------------------------------------------
         */

        if (
            typeof initializeMasteryData ===
            "function"
        ) {

            await initializeMasteryData();

        }


        if (
            typeof refreshApplicationSelectionState ===
            "function"
        ) {

            refreshApplicationSelectionState();

        }


        /*
         * Optionally make the imported pack the current
         * persistent selection.
         */
        if (
            options.selectImportedPack !==
            false
        ) {

            await selectImportedPack(
                pack.packId
            );

        }


        if (
            typeof refreshApplicationStatistics ===
            "function"
        ) {

            await refreshApplicationStatistics();

        }


        const result = {

            success:
                true,

            pack,

            packId:
                pack.packId,

            words:
                importedWords,

            added,

            updated,

            skipped,

            total:
                importedWords.length,

            importedAt:
                new Date().toISOString()

        };


        ImportState.lastResult =
            result;


        /*
         * Notify app.js.
         */
        if (
            typeof notifyImportCompleted ===
            "function"
        ) {

            await notifyImportCompleted(
                result
            );

        }


        return result;

    } catch (error) {

        ImportState.lastError =
            error;


        throw error;

    } finally {

        ImportState.importing =
            false;

    }

}


/* =========================================================
   SELECT IMPORTED PACK
========================================================= */

async function selectImportedPack(
    packId
) {

    if (
        !packId
    ) {

        return false;

    }


    /*
     * Use the persistent selection module when available.
     */
    if (
        typeof selectVocabularyPack ===
        "function"
    ) {

        await selectVocabularyPack(
            packId
        );

    } else if (
        typeof setVocabularySelection ===
        "function"
    ) {

        await setVocabularySelection({

            source:
                "pack",

            packId

        });

    } else if (
        typeof changeVocabularySelection ===
        "function"
    ) {

        await changeVocabularySelection(

            "pack",

            packId

        );

    }


    if (
        typeof refreshApplicationSelectionState ===
        "function"
    ) {

        refreshApplicationSelectionState();

    }


    return true;

}


/* =========================================================
   IMPORT JSON TEXT
========================================================= */

async function importWordPackFromText(
    jsonText,
    options = {}
) {

    if (
        typeof jsonText !==
        "string"
    ) {

        throw new Error(
            "The imported JSON must be text."
        );

    }


    if (
        !jsonText.trim()
    ) {

        throw new Error(
            "The imported JSON is empty."
        );

    }


    let data;


    try {

        data =
            JSON.parse(
                jsonText
            );

    } catch (error) {

        throw new Error(
            "The imported file is not valid JSON."
        );

    }


    return await importWordPack(

        data,

        options

    );

}


/* =========================================================
   IMPORT FILE
========================================================= */

async function importWordPackFile(
    file,
    options = {}
) {

    if (!file) {

        throw new Error(
            "No file was selected."
        );

    }


    if (
        file.size >
        IMPORT_LIMITS.maxFileSize
    ) {

        throw new Error(

            `The selected file is too large. ` +
            `Maximum size is ` +
            `${Math.round(
                IMPORT_LIMITS.maxFileSize /
                1024 /
                1024
            )} MB.`

        );

    }


    const filename =
        normalizeImportText(
            file.name
        ).toLowerCase();


    if (
        !filename.endsWith(
            ".json"
        )
    ) {

        throw new Error(
            "Please select a JSON Word Pack file."
        );

    }


    const text =
        await file.text();


    return await importWordPackFromText(

        text,

        options

    );

}


/* =========================================================
   FILE INPUT HANDLER
========================================================= */

async function handleWordPackFileInput(
    event,
    options = {}
) {

    const input =
        event?.target ??
        event?.currentTarget ??
        null;


    const file =
        input?.files?.[0];


    if (!file) {

        return null;

    }


    try {

        const result =
            await importWordPackFile(

                file,

                options

            );


        showImportSuccess(
            result
        );


        return result;

    } catch (error) {

        showImportError(
            error
        );


        throw error;

    } finally {

        /*
         * Allow selecting the same file again.
         */
        if (
            input
        ) {

            input.value =
                "";

        }

    }

}


/* =========================================================
   IMPORT SUCCESS UI
========================================================= */

function showImportSuccess(
    result
) {

    const packName =
        result?.pack?.name ??
        "Word Pack";


    const message =

        `${packName} imported successfully. ` +

        `${result.added} new words, ` +

        `${result.updated} updated, ` +

        `${result.skipped} skipped.`;


    if (
        typeof showToast ===
        "function"
    ) {

        showToast(
            message,
            "success"
        );

    }


    /*
     * Update optional import status element.
     */
    const status =
        document.querySelector(
            "[data-import-status]"
        );


    if (
        status
    ) {

        status.textContent =
            message;

        status.classList.remove(
            "error"
        );

        status.classList.add(
            "success"
        );

    }

}


/* =========================================================
   IMPORT ERROR UI
========================================================= */

function showImportError(
    error
) {

    const message =
        error?.message ??
        "Import failed.";


    if (
        typeof showToast ===
        "function"
    ) {

        showToast(
            message,
            "error"
        );

    }


    const status =
        document.querySelector(
            "[data-import-status]"
        );


    if (
        status
    ) {

        status.textContent =
            message;

        status.classList.remove(
            "success"
        );

        status.classList.add(
            "error"
        );

    }

}


/* =========================================================
   BUILD IMPORT PREVIEW
========================================================= */

function buildImportPreview(
    data
) {

    const validation =
        validateImportedData(
            data
        );


    if (
        !validation.valid
    ) {

        return {

            valid:
                false,

            errors:
                validation.errors

        };

    }


    const words =
        extractImportedWords(
            data
        );


    const packName =
        getImportedPackName(
            data
        );


    const exerciseCount =
        words.reduce(

            (
                total,
                word
            ) => {

                const exercises =
                    word.exercises ??
                    word.aiExercises ??
                    word.generatedExercises ??
                    [];


                return (

                    total +

                    (
                        Array.isArray(
                            exercises
                        )
                            ? exercises.length
                            : 0
                    )

                );

            },

            0

        );


    return {

        valid:
            true,

        packName,

        wordCount:
            words.length,

        exerciseCount,

        hasAIExercises:
            exerciseCount > 0,

        description:
            getImportedPackDescription(
                data
            ),

        author:
            getImportedPackAuthor(
                data
            ),

        version:
            getImportedPackVersion(
                data
            )

    };

}


/* =========================================================
   READ FILE FOR PREVIEW
========================================================= */

async function previewWordPackFile(
    file
) {

    if (!file) {

        throw new Error(
            "No file selected."
        );

    }


    if (
        file.size >
        IMPORT_LIMITS.maxFileSize
    ) {

        throw new Error(
            "The selected file is too large."
        );

    }


    const text =
        await file.text();


    let data;


    try {

        data =
            JSON.parse(
                text
            );

    } catch (error) {

        throw new Error(
            "The selected file is not valid JSON."
        );

    }


    return buildImportPreview(
        data
    );

}


/* =========================================================
   INITIALIZE IMPORT UI
========================================================= */

function initializeImport() {

    if (
        ImportState.initialized
    ) {

        return true;

    }


    /*
     * Support multiple possible file input IDs.
     */
    const inputSelectors = [

        "#wordPackFile",

        "#importFile",

        "#jsonImport",

        "[data-word-pack-import]",

        "[data-import-file]"

    ];


    let input =
        null;


    for (
        const selector
        of inputSelectors
    ) {

        input =
            document.querySelector(
                selector
            );


        if (
            input
        ) {

            break;

        }

    }


    if (
        input
    ) {

        input.addEventListener(

            "change",

            event => {

                handleWordPackFileInput(
                    event
                )
                .catch(
                    () => {}
                );

            }

        );

    }


    ImportState.initialized =
        true;


    return true;

}


/* =========================================================
   ALIAS
========================================================= */

const initImport =
    initializeImport;


/* =========================================================
   PUBLIC API
========================================================= */

window.DutchTrainerImport = {

    version:
        IMPORT_VERSION,

    state:
        ImportState,

    importWordPack,

    importFromText:
        importWordPackFromText,

    importFile:
        importWordPackFile,

    preview:
        buildImportPreview,

    previewFile:
        previewWordPackFile,

    selectPack:
        selectImportedPack,

    validate:
        validateImportedData

};


/* =========================================================
   GLOBAL COMPATIBILITY API
========================================================= */

window.importWordPack =
    importWordPack;


window.importWordPackFile =
    importWordPackFile;


window.handleWordPackFileInput =
    handleWordPackFileInput;


/* =========================================================
   DOM INITIALIZATION
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(

        "DOMContentLoaded",

        initializeImport,

        {
            once:
                true
        }

    );

} else {

    initializeImport();

}