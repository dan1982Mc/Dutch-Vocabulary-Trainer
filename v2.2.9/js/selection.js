/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Vocabulary Selection Manager

   Responsibilities:
   - Persistent vocabulary selection
   - All vocabulary
   - Word Pack selection
   - New words
   - Weak words
   - Due words
   - Combined filters
   - Selected vocabulary used by Practice + Dashboard
   - Selection persistence across page reloads
========================================================= */


/* =========================================================
   STORAGE
========================================================= */

const VOCABULARY_SELECTION_STORAGE_KEY =
    "dutchTrainer.v2.vocabularySelection";


/* =========================================================
   DEFAULT SELECTION
========================================================= */

const DEFAULT_VOCABULARY_SELECTION = {

    /*
     * "all" means all loaded vocabulary.
     *
     * Other possible values:
     * - "pack"
     * - "new"
     * - "weak"
     * - "due"
     */
    source:
        "all",

    /*
     * Used when source === "pack".
     */
    packId:
        null,

    /*
     * Additional filters can be combined with a pack.
     */
    newOnly:
        false,

    weakOnly:
        false,

    dueOnly:
        false,

    /*
     * Keep the selected vocabulary mode independent from
     * the practice exercise type.
     */
    updatedAt:
        null

};


/* =========================================================
   SELECTION MANAGER STATE
========================================================= */

let vocabularySelection = {

    ...DEFAULT_VOCABULARY_SELECTION

};


/* =========================================================
   NORMALIZE SELECTION
========================================================= */

function normalizeVocabularySelection(
    selection
) {

    const input =
        selection &&
        typeof selection === "object"
            ? selection
            : {};


    let source =
        String(
            input.source ||
            "all"
        )
        .trim()
        .toLowerCase();


    const validSources = [

        "all",
        "pack",
        "new",
        "weak",
        "due"

    ];


    if (
        !validSources.includes(
            source
        )
    ) {

        source =
            "all";

    }


    let packId =
        input.packId;


    if (
        packId === undefined ||
        packId === null ||
        String(
            packId
        ).trim() === ""
    ) {

        packId =
            null;

    } else {

        packId =
            String(
                packId
            ).trim();

    }


    /*
     * If a pack isn't selected, the source cannot remain
     * "pack".
     */
    if (
        source === "pack" &&
        !packId
    ) {

        source =
            "all";

    }


    return {

        source,

        packId,

        newOnly:
            Boolean(
                input.newOnly
            ),

        weakOnly:
            Boolean(
                input.weakOnly
            ),

        dueOnly:
            Boolean(
                input.dueOnly
            ),

        updatedAt:
            input.updatedAt ||
            null

    };

}


/* =========================================================
   LOAD PERSISTENT SELECTION
========================================================= */

function loadVocabularySelection() {

    try {

        const raw =
            localStorage.getItem(
                VOCABULARY_SELECTION_STORAGE_KEY
            );


        if (!raw) {

            vocabularySelection =
                {
                    ...DEFAULT_VOCABULARY_SELECTION
                };

            return {
                ...vocabularySelection
            };

        }


        const parsed =
            JSON.parse(
                raw
            );


        vocabularySelection =
            normalizeVocabularySelection(
                parsed
            );


        return {
            ...vocabularySelection
        };

    } catch (error) {

        console.warn(
            "Could not load vocabulary selection:",
            error
        );


        vocabularySelection =
            {
                ...DEFAULT_VOCABULARY_SELECTION
            };


        return {
            ...vocabularySelection
        };

    }

}


/* =========================================================
   SAVE PERSISTENT SELECTION
========================================================= */

function saveVocabularySelection(
    selection =
        vocabularySelection
) {

    vocabularySelection =
        normalizeVocabularySelection(
            selection
        );


    vocabularySelection.updatedAt =
        new Date().toISOString();


    try {

        localStorage.setItem(

            VOCABULARY_SELECTION_STORAGE_KEY,

            JSON.stringify(
                vocabularySelection
            )

        );

    } catch (error) {

        console.warn(
            "Could not save vocabulary selection:",
            error
        );

    }


    return {
        ...vocabularySelection
    };

}


/* =========================================================
   GET SELECTION
========================================================= */

function getVocabularySelection() {

    return {
        ...vocabularySelection
    };

}


/* =========================================================
   SET SOURCE
========================================================= */

function setVocabularySelectionSource(
    source,
    options = {}
) {

    const normalizedSource =
        String(
            source || "all"
        )
        .trim()
        .toLowerCase();


    const next = {

        ...vocabularySelection,

        source:
            normalizedSource,

        packId:
            options.packId ??
            (
                normalizedSource === "pack"
                    ? vocabularySelection.packId
                    : null
            ),

        /*
         * Selecting a simple source resets the mutually
         * exclusive source filters.
         */
        newOnly:
            normalizedSource === "new"
                ? true
                : false,

        weakOnly:
            normalizedSource === "weak"
                ? true
                : false,

        dueOnly:
            normalizedSource === "due"
                ? true
                : false

    };


    return saveVocabularySelection(
        next
    );

}


/* =========================================================
   SELECT ALL
========================================================= */

function selectAllVocabulary() {

    return saveVocabularySelection({

        ...DEFAULT_VOCABULARY_SELECTION,

        source:
            "all"

    });

}


/* =========================================================
   SELECT WORD PACK
========================================================= */

function selectVocabularyPack(
    packId
) {

    if (
        !packId
    ) {

        return selectAllVocabulary();

    }


    return saveVocabularySelection({

        ...DEFAULT_VOCABULARY_SELECTION,

        source:
            "pack",

        packId:
            String(
                packId
            ).trim()

    });

}


/* =========================================================
   SELECT NEW
========================================================= */

function selectNewVocabulary() {

    return saveVocabularySelection({

        ...DEFAULT_VOCABULARY_SELECTION,

        source:
            "new",

        newOnly:
            true

    });

}


/* =========================================================
   SELECT WEAK
========================================================= */

function selectWeakVocabulary() {

    return saveVocabularySelection({

        ...DEFAULT_VOCABULARY_SELECTION,

        source:
            "weak",

        weakOnly:
            true

    });

}


/* =========================================================
   SELECT DUE
========================================================= */

function selectDueVocabulary() {

    return saveVocabularySelection({

        ...DEFAULT_VOCABULARY_SELECTION,

        source:
            "due",

        dueOnly:
            true

    });

}


/* =========================================================
   COMBINED SELECTION
========================================================= */

/**
 * Allows a Word Pack and an additional filter.
 *
 * Example:
 *
 * selectPackWithFilter("news-2026", "weak")
 */
function selectPackWithFilter(
    packId,
    filter
) {

    const normalizedFilter =
        String(
            filter || ""
        )
        .trim()
        .toLowerCase();


    return saveVocabularySelection({

        ...DEFAULT_VOCABULARY_SELECTION,

        source:
            "pack",

        packId:
            String(
                packId
            ).trim(),

        newOnly:
            normalizedFilter === "new",

        weakOnly:
            normalizedFilter === "weak",

        dueOnly:
            normalizedFilter === "due"

    });

}


/* =========================================================
   TOGGLE FILTER
========================================================= */

function toggleVocabularyFilter(
    filter
) {

    const normalized =
        String(
            filter || ""
        )
        .trim()
        .toLowerCase();


    if (
        ![
            "new",
            "weak",
            "due"
        ].includes(
            normalized
        )
    ) {

        return getVocabularySelection();

    }


    const key =
        `${normalized}Only`;


    const current =
        Boolean(
            vocabularySelection[key]
        );


    return saveVocabularySelection({

        ...vocabularySelection,

        /*
         * Selecting a filter makes it the active source
         * when no pack is selected.
         */
        source:
            current
                ? "all"
                : (
                    vocabularySelection.source === "pack"
                        ? "pack"
                        : normalized
                ),

        [key]:
            !current,

        /*
         * The three primary filters are mutually exclusive
         * when selected through the simple UI.
         */
        ...(current
            ? {}
            : {

                newOnly:
                    normalized === "new",

                weakOnly:
                    normalized === "weak",

                dueOnly:
                    normalized === "due"

            })

    });

}


/* =========================================================
   CLEAR FILTERS
========================================================= */

function clearVocabularyFilters() {

    return saveVocabularySelection({

        ...vocabularySelection,

        newOnly:
            false,

        weakOnly:
            false,

        dueOnly:
            false

    });

}


/* =========================================================
   GET ALL LOADED VOCABULARY
========================================================= */

async function getAllLoadedVocabulary() {

    if (
        typeof getAllWords ===
        "function"
    ) {

        const words =
            await getAllWords();

        return Array.isArray(words)
            ? words
            : [];

    }


    /*
     * Compatibility with alternate database APIs.
     */
    if (
        typeof getVocabulary ===
        "function"
    ) {

        const words =
            await getVocabulary();

        return Array.isArray(words)
            ? words
            : [];

    }


    return [];

}


/* =========================================================
   WORD PACK FILTER
========================================================= */

function filterVocabularyByPack(
    words,
    packId
) {

    if (
        !packId
    ) {

        return words;

    }


    const id =
        String(
            packId
        ).trim();


    return words.filter(

        word =>

            String(
                word.packId ||
                "default"
            ) === id

    );

}


/* =========================================================
   NEW WORD DETECTION
========================================================= */

function isVocabularyWordNew(
    word
) {

    if (!word) {

        return false;

    }


    /*
     * Explicit V2 flag takes priority.
     */
    if (
        word.isNew !== undefined
    ) {

        return Boolean(
            word.isNew
        );

    }


    /*
     * Support older V1.2 fields.
     */
    if (
        word.new !== undefined
    ) {

        return Boolean(
            word.new
        );

    }


    if (
        word.status &&
        String(
            word.status
        ).toLowerCase() ===
        "new"
    ) {

        return true;

    }


    /*
     * No practice attempts = new.
     */
    const stats =
        word.stats ||
        {};


    const attempts =
        Number(
            stats.attempts ||
            0
        );


    const correct =
        Number(
            stats.correct ||
            0
        );


    const incorrect =
        Number(
            stats.incorrect ||
            0
        );


    return (
        attempts === 0 &&
        correct === 0 &&
        incorrect === 0
    );

}


/* =========================================================
   MASTERY
========================================================= */

function getVocabularyMastery(
    word
) {

    if (!word) {

        return 0;

    }


    return Math.max(

        0,

        Math.min(

            100,

            Number(
                word.mastery ??
                word.masteryScore ??
                word.score ??
                0
            )

        )

    );

}


/* =========================================================
   WEAK WORD DETECTION
========================================================= */

/**
 * The central mastery threshold is intentionally kept here
 * so all selection consumers use the same definition.
 */
const WEAK_MASTERY_THRESHOLD =
    40;


function isVocabularyWordWeak(
    word
) {

    if (!word) {

        return false;

    }


    /*
     * Explicit weak flag is useful for imported/legacy data.
     */
    if (
        word.isWeak !== undefined
    ) {

        return Boolean(
            word.isWeak
        );

    }


    return (
        getVocabularyMastery(
            word
        ) <
        WEAK_MASTERY_THRESHOLD
    );

}


/* =========================================================
   DUE WORD DETECTION
========================================================= */

function getWordDueTimestamp(
    word
) {

    if (!word) {

        return null;

    }


    const candidates = [

        word.dueAt,

        word.nextReview,

        word.nextReviewAt,

        word.dueDate,

        word.reviewAt

    ];


    for (
        const candidate of candidates
    ) {

        if (
            candidate === null ||
            candidate === undefined ||
            candidate === ""
        ) {

            continue;

        }


        const date =
            new Date(
                candidate
            );


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            return date.getTime();

        }

    }


    return null;

}


function isVocabularyWordDue(
    word
) {

    if (!word) {

        return false;

    }


    /*
     * Explicit due flag can be supplied by the mastery engine.
     */
    if (
        word.isDue !== undefined
    ) {

        return Boolean(
            word.isDue
        );

    }


    const dueTimestamp =
        getWordDueTimestamp(
            word
        );


    /*
     * No scheduled review means a word is not due.
     */
    if (
        dueTimestamp === null
    ) {

        return false;

    }


    return (
        dueTimestamp <=
        Date.now()
    );

}


/* =========================================================
   APPLY SELECTION
========================================================= */

function applyVocabularySelection(
    words,
    selection =
        vocabularySelection
) {

    let result =
        Array.isArray(words)
            ? [...words]
            : [];


    const normalized =
        normalizeVocabularySelection(
            selection
        );


    /*
     * -------------------------------------------------------
     * SOURCE
     * -------------------------------------------------------
     */

    if (
        normalized.source === "pack"
    ) {

        result =
            filterVocabularyByPack(

                result,

                normalized.packId

            );

    }


    /*
     * -------------------------------------------------------
     * NEW
     * -------------------------------------------------------
     */

    if (
        normalized.newOnly
    ) {

        result =
            result.filter(
                isVocabularyWordNew
            );

    }


    /*
     * -------------------------------------------------------
     * WEAK
     * -------------------------------------------------------
     */

    if (
        normalized.weakOnly
    ) {

        result =
            result.filter(
                isVocabularyWordWeak
            );

    }


    /*
     * -------------------------------------------------------
     * DUE
     * -------------------------------------------------------
     */

    if (
        normalized.dueOnly
    ) {

        result =
            result.filter(
                isVocabularyWordDue
            );

    }


    return result;

}


/* =========================================================
   GET SELECTED VOCABULARY
========================================================= */

async function getSelectedVocabulary(
    selection =
        vocabularySelection
) {

    const allWords =
        await getAllLoadedVocabulary();


    return applyVocabularySelection(

        allWords,

        selection

    );

}


/* =========================================================
   SELECTED VOCABULARY COUNT
========================================================= */

async function getSelectedVocabularyCount() {

    const selected =
        await getSelectedVocabulary();

    return selected.length;

}


/* =========================================================
   ALL VOCABULARY COUNT
========================================================= */

async function getAllVocabularyCount() {

    const allWords =
        await getAllLoadedVocabulary();

    return allWords.length;

}


/* =========================================================
   SELECTION LABEL
========================================================= */

function getVocabularySelectionLabel(
    selection =
        vocabularySelection
) {

    const normalized =
        normalizeVocabularySelection(
            selection
        );


    /*
     * Base source label.
     */
    let label;


    switch (
        normalized.source
    ) {

        case "pack":

            label =
                "Word Pack";

            break;


        case "new":

            label =
                "New";

            break;


        case "weak":

            label =
                "Weak";

            break;


        case "due":

            label =
                "Due";

            break;


        default:

            label =
                "All Vocabulary";

    }


    /*
     * Pack name is resolved elsewhere when available.
     */
    if (
        normalized.source === "pack" &&
        normalized.packId
    ) {

        label =
            `Word Pack`;

    }


    const filters = [];


    if (
        normalized.newOnly &&
        normalized.source !== "new"
    ) {

        filters.push(
            "New"
        );

    }


    if (
        normalized.weakOnly &&
        normalized.source !== "weak"
    ) {

        filters.push(
            "Weak"
        );

    }


    if (
        normalized.dueOnly &&
        normalized.source !== "due"
    ) {

        filters.push(
            "Due"
        );

    }


    if (
        filters.length
    ) {

        label +=
            ` + ${filters.join(" + ")}`;

    }


    return label;

}


/* =========================================================
   SELECTION DESCRIPTION
========================================================= */

async function getVocabularySelectionDescription() {

    const selection =
        getVocabularySelection();


    const count =
        await getSelectedVocabularyCount();


    const allCount =
        await getAllVocabularyCount();


    return {

        selection,

        label:
            getVocabularySelectionLabel(
                selection
            ),

        selectedCount:
            count,

        totalCount:
            allCount,

        description:
            `${count} of ${allCount} loaded words selected`

    };

}


/* =========================================================
   IS FULL VOCABULARY SELECTED
========================================================= */

function isAllVocabularySelected() {

    const selection =
        getVocabularySelection();


    return (

        selection.source === "all" &&
        !selection.newOnly &&
        !selection.weakOnly &&
        !selection.dueOnly

    );

}


/* =========================================================
   RESET TO ALL
========================================================= */

function resetVocabularySelection() {

    return selectAllVocabulary();

}


/* =========================================================
   MATCH WORD AGAINST SELECTION
========================================================= */

function wordMatchesVocabularySelection(
    word,
    selection =
        vocabularySelection
) {

    return applyVocabularySelection(

        [word],

        selection

    ).length > 0;

}


/* =========================================================
   SELECTION SUMMARY
========================================================= */

async function getVocabularySelectionSummary() {

    const selection =
        getVocabularySelection();


    const selected =
        await getSelectedVocabulary(
            selection
        );


    const all =
        await getAllLoadedVocabulary();


    const newCount =
        selected.filter(
            isVocabularyWordNew
        ).length;


    const weakCount =
        selected.filter(
            isVocabularyWordWeak
        ).length;


    const dueCount =
        selected.filter(
            isVocabularyWordDue
        ).length;


    const averageMastery =
        selected.length
            ? Math.round(

                selected.reduce(

                    (
                        sum,
                        word
                    ) =>
                        sum +
                        getVocabularyMastery(
                            word
                        ),

                    0

                ) /
                selected.length

            )
            : 0;


    return {

        selection,

        label:
            getVocabularySelectionLabel(
                selection
            ),

        selectedCount:
            selected.length,

        allCount:
            all.length,

        newCount,

        weakCount,

        dueCount,

        averageMastery

    };

}


/* =========================================================
   INITIALIZE
========================================================= */

function initializeVocabularySelection() {

    loadVocabularySelection();

    return getVocabularySelection();

}


/* =========================================================
   CHANGE EVENT
========================================================= */

/**
 * A small event system allows Dashboard and Practice to
 * refresh whenever selection changes.
 */
function notifyVocabularySelectionChanged() {

    try {

        window.dispatchEvent(

            new CustomEvent(
                "vocabulary-selection-changed",
                {
                    detail:
                        getVocabularySelection()
                }
            )

        );

    } catch (error) {

        console.warn(
            "Could not dispatch vocabulary selection event:",
            error
        );

    }

}


/* =========================================================
   SAVE + NOTIFY WRAPPER
========================================================= */

function persistVocabularySelection(
    selection
) {

    const result =
        saveVocabularySelection(
            selection
        );


    notifyVocabularySelectionChanged();


    return result;

}


/* =========================================================
   PATCH PUBLIC SELECTION METHODS
========================================================= */

/*
 * The functions below are convenient wrappers for UI code.
 */

function changeVocabularySelection(
    source,
    packId = null
) {

    let result;


    switch (
        String(
            source || ""
        ).toLowerCase()
    ) {

        case "all":

            result =
                selectAllVocabulary();

            break;


        case "pack":

            result =
                selectVocabularyPack(
                    packId
                );

            break;


        case "new":

            result =
                selectNewVocabulary();

            break;


        case "weak":

            result =
                selectWeakVocabulary();

            break;


        case "due":

            result =
                selectDueVocabulary();

            break;


        default:

            result =
                selectAllVocabulary();

    }


    notifyVocabularySelectionChanged();


    return result;

}


/* =========================================================
   INITIAL LOAD
========================================================= */

initializeVocabularySelection();