/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Typed Answer Similarity / Validation

   Responsibilities:
   - Preserve V1.2 similarity threshold
   - Normalize typed answers
   - Compare typed answers with expected answers
   - Support multiple accepted answers
   - Return similarity score
   - Return correct / incorrect result
   - Handle Dutch accents and punctuation
   - Provide one API for all typed exercises

   Used by:
   - Recall
   - Fill Sentence
   - Production
========================================================= */


/* =========================================================
   V1.2 COMPATIBILITY
========================================================= */

/*
 * IMPORTANT:
 *
 * The V2 engine must not silently change the user's existing
 * typed-answer threshold.
 *
 * Several possible names are checked because V1.2 may have
 * stored the threshold under a different configuration key.
 */

const DEFAULT_SIMILARITY_THRESHOLD = 0.80;


/**
 * Find the existing V1.2 similarity threshold if one exists.
 */
function getSimilarityThreshold() {

    /*
     * Possible global configuration objects from V1.x.
     */
    const candidates = [

        typeof APP_CONFIG !== "undefined"
            ? APP_CONFIG?.similarityThreshold
            : undefined,

        typeof APP_CONFIG !== "undefined"
            ? APP_CONFIG?.typing?.similarityThreshold
            : undefined,

        typeof CONFIG !== "undefined"
            ? CONFIG?.similarityThreshold
            : undefined,

        typeof SETTINGS !== "undefined"
            ? SETTINGS?.similarityThreshold
            : undefined,

        typeof APP_SETTINGS !== "undefined"
            ? APP_SETTINGS?.similarityThreshold
            : undefined

    ];


    for (const candidate of candidates) {

        const value =
            Number(candidate);

        if (
            Number.isFinite(value) &&
            value >= 0 &&
            value <= 1
        ) {

            return value;

        }

    }


    /*
     * Check localStorage for an existing V1 setting.
     */
    const possibleKeys = [

        "similarityThreshold",
        "v1.similarityThreshold",
        "v1.2.similarityThreshold",
        "app.similarityThreshold",
        "dutchTrainer.similarityThreshold"

    ];


    for (
        const key of possibleKeys
    ) {

        try {

            const stored =
                localStorage.getItem(key);

            if (stored === null) {

                continue;

            }

            const value =
                Number(stored);

            if (
                Number.isFinite(value) &&
                value >= 0 &&
                value <= 1
            ) {

                return value;

            }

        } catch (error) {

            /*
             * Ignore storage errors.
             */

        }

    }


    /*
     * If V1.2 did not expose a threshold, use the V2 default.
     *
     * This is only a fallback.
     */
    return DEFAULT_SIMILARITY_THRESHOLD;

}


/* =========================================================
   THRESHOLD
========================================================= */

function SIMILARITY_THRESHOLD() {

    return getSimilarityThreshold();

}


/* =========================================================
   TEXT NORMALIZATION
========================================================= */

/**
 * Normalize text for comparison.
 *
 * This does NOT remove meaningful Dutch spelling differences.
 * It mainly removes formatting noise.
 */
function normalizeAnswerText(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    let text =
        String(value);


    /*
     * Normalize Unicode so accented characters have a
     * consistent representation.
     */
    try {

        text =
            text.normalize("NFKC");

    } catch (error) {

        /*
         * Older environments may not support normalize().
         */

    }


    /*
     * Convert curly apostrophes to a standard apostrophe.
     */
    text =
        text
            .replace(/[’‘`´]/g, "'");


    /*
     * Normalize whitespace.
     */
    text =
        text
            .replace(/\s+/g, " ")
            .trim();


    /*
     * Case-insensitive comparison.
     */
    text =
        text.toLocaleLowerCase(
            "nl-NL"
        );


    return text;

}


/* =========================================================
   COMPARISON NORMALIZATION
========================================================= */

/**
 * Additional normalization used specifically for similarity.
 *
 * We remove punctuation but retain letters and numbers.
 *
 * Examples:
 *
 * "tekeer!"
 *      → "tekeer"
 *
 * "omringd."
 *      → "omringd"
 */
function normalizeForSimilarity(
    value
) {

    let text =
        normalizeAnswerText(
            value
        );


    /*
     * Keep letters/numbers from all scripts.
     * Keep whitespace.
     */
    text =
        text.replace(
            /[^\p{L}\p{N}\s]/gu,
            " "
        );


    text =
        text
            .replace(/\s+/g, " ")
            .trim();


    return text;

}


/* =========================================================
   TOKENIZATION
========================================================= */

function tokenizeAnswer(
    value
) {

    const normalized =
        normalizeForSimilarity(
            value
        );

    if (!normalized) {

        return [];

    }

    return normalized.split(
        /\s+/
    );

}


/* =========================================================
   EXACT MATCH
========================================================= */

function answersExactlyMatch(
    answer,
    expected
) {

    const a =
        normalizeForSimilarity(
            answer
        );

    const b =
        normalizeForSimilarity(
            expected
        );

    return (
        a.length > 0 &&
        a === b
    );

}


/* =========================================================
   LEVENSHTEIN DISTANCE
========================================================= */

function levenshteinDistance(
    a,
    b
) {

    a =
        String(a || "");

    b =
        String(b || "");


    if (a === b) {

        return 0;

    }

    if (a.length === 0) {

        return b.length;

    }

    if (b.length === 0) {

        return a.length;

    }


    /*
     * Keep the shorter string in the columns to reduce memory.
     */
    if (a.length > b.length) {

        const temp = a;

        a = b;

        b = temp;

    }


    let previousRow =
        new Array(
            a.length + 1
        );

    let currentRow =
        new Array(
            a.length + 1
        );


    for (
        let i = 0;
        i <= a.length;
        i++
    ) {

        previousRow[i] = i;

    }


    for (
        let j = 1;
        j <= b.length;
        j++
    ) {

        currentRow[0] = j;


        for (
            let i = 1;
            i <= a.length;
            i++
        ) {

            const insertion =
                currentRow[i - 1] + 1;

            const deletion =
                previousRow[i] + 1;

            const substitution =
                previousRow[i - 1] +
                (
                    a[i - 1] === b[j - 1]
                        ? 0
                        : 1
                );


            currentRow[i] =
                Math.min(
                    insertion,
                    deletion,
                    substitution
                );

        }


        const temp =
            previousRow;

        previousRow =
            currentRow;

        currentRow =
            temp;

    }


    return previousRow[
        a.length
    ];

}


/* =========================================================
   STRING SIMILARITY
========================================================= */

/**
 * Returns a value between 0 and 1.
 *
 * 1.00 = identical
 * 0.00 = completely different
 */
function calculateStringSimilarity(
    answer,
    expected
) {

    const a =
        normalizeForSimilarity(
            answer
        );

    const b =
        normalizeForSimilarity(
            expected
        );


    if (!a || !b) {

        return 0;

    }


    if (a === b) {

        return 1;

    }


    const distance =
        levenshteinDistance(
            a,
            b
        );

    const maxLength =
        Math.max(
            a.length,
            b.length
        );


    if (maxLength === 0) {

        return 1;

    }


    return Math.max(

        0,

        1 -
        (
            distance /
            maxLength
        )

    );

}


/* =========================================================
   TOKEN SIMILARITY
========================================================= */

/**
 * Useful for short multi-word answers.
 *
 * Example:
 *
 * "drukke handgebaren"
 *
 * versus
 *
 * "drukke hand gebaren"
 */
function calculateTokenSimilarity(
    answer,
    expected
) {

    const answerTokens =
        tokenizeAnswer(
            answer
        );

    const expectedTokens =
        tokenizeAnswer(
            expected
        );


    if (
        answerTokens.length === 0 ||
        expectedTokens.length === 0
    ) {

        return 0;

    }


    /*
     * Exact token sequence.
     */
    if (
        answerTokens.join(" ") ===
        expectedTokens.join(" ")
    ) {

        return 1;

    }


    const maxTokens =
        Math.max(
            answerTokens.length,
            expectedTokens.length
        );


    let matched = 0;

    const used =
        new Set();


    for (
        const answerToken of answerTokens
    ) {

        let bestIndex = -1;
        let bestScore = 0;


        for (
            let i = 0;
            i < expectedTokens.length;
            i++
        ) {

            if (
                used.has(i)
            ) {

                continue;

            }


            const score =
                calculateStringSimilarity(

                    answerToken,

                    expectedTokens[i]

                );


            if (
                score > bestScore
            ) {

                bestScore = score;

                bestIndex = i;

            }

        }


        if (
            bestIndex >= 0 &&
            bestScore >= 0.60
        ) {

            used.add(
                bestIndex
            );

            matched +=
                bestScore;

        }

    }


    return Math.max(

        0,

        Math.min(

            1,

            matched /
            maxTokens

        )

    );

}


/* =========================================================
   COMBINED SIMILARITY
========================================================= */

function calculateAnswerSimilarity(
    answer,
    expected
) {

    const stringScore =
        calculateStringSimilarity(
            answer,
            expected
        );

    const tokenScore =
        calculateTokenSimilarity(
            answer,
            expected
        );


    /*
     * For single words, normal Levenshtein similarity is the
     * most meaningful metric.
     *
     * For multi-word expressions, token similarity can recover
     * from harmless spacing differences.
     */
    const answerTokens =
        tokenizeAnswer(
            answer
        );

    const expectedTokens =
        tokenizeAnswer(
            expected
        );


    if (
        answerTokens.length <= 1 &&
        expectedTokens.length <= 1
    ) {

        return stringScore;

    }


    return Math.max(

        stringScore,

        tokenScore

    );

}


/* =========================================================
   ACCEPTED ANSWERS
========================================================= */

/**
 * Convert different accepted-answer formats into an array.
 */
function normalizeAcceptedAnswers(
    expected
) {

    if (
        Array.isArray(expected)
    ) {

        return expected
            .filter(
                value =>
                    value !== undefined &&
                    value !== null &&
                    String(value).trim() !== ""
            )
            .map(
                value =>
                    String(value)
            );

    }


    if (
        expected &&
        typeof expected === "object"
    ) {

        /*
         * Support common AI exercise formats.
         */
        const candidates = [

            expected.answer,

            expected.correctAnswer,

            expected.expectedAnswer,

            expected.acceptedAnswer,

            expected.acceptedAnswers,

            expected.answers

        ];


        for (
            const candidate of candidates
        ) {

            if (
                Array.isArray(candidate)
            ) {

                return normalizeAcceptedAnswers(
                    candidate
                );

            }

            if (
                candidate !== undefined &&
                candidate !== null
            ) {

                return [
                    String(candidate)
                ];

            }

        }

    }


    if (
        expected === undefined ||
        expected === null
    ) {

        return [];

    }


    return [
        String(expected)
    ];

}


/* =========================================================
   BEST MATCH
========================================================= */

/**
 * Compare an answer against one or more accepted answers.
 */
function getBestAnswerMatch(
    answer,
    expectedAnswers
) {

    const candidates =
        normalizeAcceptedAnswers(
            expectedAnswers
        );


    if (
        candidates.length === 0
    ) {

        return {

            similarity: 0,

            expectedAnswer: "",

            exact: false

        };

    }


    let best = {

        similarity: 0,

        expectedAnswer:
            candidates[0],

        exact: false

    };


    for (
        const expected of candidates
    ) {

        const exact =
            answersExactlyMatch(
                answer,
                expected
            );


        if (exact) {

            return {

                similarity: 1,

                expectedAnswer:
                    expected,

                exact: true

            };

        }


        const similarity =
            calculateAnswerSimilarity(

                answer,

                expected

            );


        if (
            similarity >
            best.similarity
        ) {

            best = {

                similarity,

                expectedAnswer:
                    expected,

                exact: false

            };

        }

    }


    return best;

}


/* =========================================================
   CHECK TYPED ANSWER
========================================================= */

/**
 * Main API for typed exercises.
 *
 * Returns:
 *
 * {
 *   correct,
 *   similarity,
 *   threshold,
 *   expectedAnswer,
 *   answer
 * }
 */
function checkTypedAnswer(
    answer,
    expectedAnswers,
    options = {}
) {

    const threshold =
        Number.isFinite(
            Number(
                options.threshold
            )
        )
            ? Number(
                options.threshold
            )
            : getSimilarityThreshold();


    const normalizedAnswer =
        normalizeAnswerText(
            answer
        );


    const best =
        getBestAnswerMatch(

            normalizedAnswer,

            expectedAnswers

        );


    const correct =
        best.exact ||
        best.similarity >=
        threshold;


    return {

        correct,

        similarity:
            Number(
                best.similarity.toFixed(4)
            ),

        threshold,

        expectedAnswer:
            best.expectedAnswer,

        answer:
            String(answer ?? ""),

        normalizedAnswer,

        exact:
            best.exact

    };

}


/* =========================================================
   CHECK TYPED ANSWER OBJECT
========================================================= */

/**
 * Convenience API when the caller already has a question
 * object.
 */
function checkQuestionAnswer(
    question,
    answer,
    options = {}
) {

    if (!question) {

        return {

            correct: false,

            similarity: 0,

            threshold:
                getSimilarityThreshold(),

            expectedAnswer: "",

            answer:
                String(answer ?? ""),

            error:
                "Missing question."

        };

    }


    const expectedAnswers =
        question.acceptedAnswers ??
        question.expectedAnswers ??
        question.expectedAnswer ??
        question.answer ??
        question.correctAnswer ??
        "";


    return checkTypedAnswer(

        answer,

        expectedAnswers,

        options

    );

}


/* =========================================================
   FEEDBACK LABEL
========================================================= */

function getSimilarityFeedback(
    result
) {

    if (!result) {

        return "";

    }


    if (result.correct) {

        if (result.exact) {

            return "Correct!";

        }

        return "Correct — close enough!";

    }


    if (
        result.similarity >=
        Math.max(
            0,
            result.threshold - 0.15
        )
    ) {

        return "Almost — check the spelling.";

    }


    return "Not quite.";

}


/* =========================================================
   SIMILARITY PERCENTAGE
========================================================= */

function similarityToPercentage(
    similarity
) {

    const value =
        Number(similarity);

    if (
        !Number.isFinite(value)
    ) {

        return 0;

    }

    return Math.round(

        Math.max(
            0,
            Math.min(
                1,
                value
            )
        ) * 100

    );

}


/* =========================================================
   THRESHOLD DIAGNOSTICS
========================================================= */

function getSimilarityDiagnostics() {

    const threshold =
        getSimilarityThreshold();

    return {

        threshold,

        percentage:
            similarityToPercentage(
                threshold
            ),

        source:
            threshold ===
            DEFAULT_SIMILARITY_THRESHOLD
                ? "V2 fallback"
                : "Existing V1.2 configuration"

    };

}