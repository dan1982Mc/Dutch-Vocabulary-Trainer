/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Persistent Application Storage

   Responsibilities:
   - Persistent vocabulary selection
   - Persistent pack selection
   - Persistent practice preferences
   - Persistent question count
   - Generic application settings
   - Backward-compatible setting access

   Database storage is handled by db.js.
========================================================= */


/* =========================================================
   STORAGE KEYS
========================================================= */

const STORAGE_KEYS = {

    VOCABULARY_SELECTION:
        "v2.vocabularySelection",

    PRACTICE_SETTINGS:
        "v2.practiceSettings",

    UI_SETTINGS:
        "v2.uiSettings"

};


/* =========================================================
   DEFAULT VOCABULARY SELECTION
========================================================= */

const DEFAULT_VOCABULARY_SELECTION = {

    /*
     * all
     * pack
     * new
     * weak
     * due
     */
    filter: "all",

    /*
     * "all" means no specific pack.
     */
    packId: "all"

};


/* =========================================================
   DEFAULT PRACTICE SETTINGS
========================================================= */

const DEFAULT_PRACTICE_SETTINGS = {

    exerciseType: "meaning",

    questionCount: 20,

    vocabularyFilter: "all",

    packId: "all"

};


/* =========================================================
   DEFAULT UI SETTINGS
========================================================= */

const DEFAULT_UI_SETTINGS = {

    lastScreen: "home",

    theme: "system"

};


/* =========================================================
   SAFE JSON PARSING
========================================================= */

function parseStoredJSON(value, fallback) {

    if (!value) {

        return fallback;

    }

    try {

        const parsed = JSON.parse(value);

        if (
            parsed &&
            typeof parsed === "object"
        ) {

            return parsed;

        }

    } catch (error) {

        console.warn(
            "Could not parse stored setting:",
            error
        );

    }

    return fallback;

}


/* =========================================================
   LOCAL STORAGE HELPERS
========================================================= */

function localStorageGet(key, fallback = null) {

    try {

        const value =
            localStorage.getItem(key);

        return value !== null
            ? value
            : fallback;

    } catch (error) {

        console.warn(
            "localStorage read failed:",
            error
        );

        return fallback;

    }

}


function localStorageSet(key, value) {

    try {

        localStorage.setItem(
            key,
            value
        );

        return true;

    } catch (error) {

        console.warn(
            "localStorage write failed:",
            error
        );

        return false;

    }

}


/* =========================================================
   VOCABULARY SELECTION
========================================================= */

/**
 * Return the current persistent vocabulary selection.
 *
 * Example:
 *
 * {
 *   filter: "weak",
 *   packId: "all"
 * }
 */
function getVocabularySelection() {

    const raw =
        localStorageGet(
            STORAGE_KEYS.VOCABULARY_SELECTION,
            null
        );

    const selection =
        parseStoredJSON(
            raw,
            {
                ...DEFAULT_VOCABULARY_SELECTION
            }
        );

    return normalizeVocabularySelection(
        selection
    );

}


/**
 * Save vocabulary selection.
 */
function saveVocabularySelection(selection) {

    const normalized =
        normalizeVocabularySelection(
            selection
        );

    localStorageSet(

        STORAGE_KEYS.VOCABULARY_SELECTION,

        JSON.stringify(normalized)

    );

    /*
     * Also keep the IndexedDB settings store in sync.
     *
     * This is deliberately fire-and-forget. The localStorage
     * value remains the immediate source for UI startup.
     */
    if (typeof setSetting === "function") {

        setSetting(
            "vocabularySelection",
            normalized
        ).catch(error => {

            console.warn(
                "Could not sync vocabulary selection to IndexedDB:",
                error
            );

        });

    }

    return normalized;

}


/**
 * Change only the vocabulary filter.
 */
function setVocabularyFilter(filter) {

    const current =
        getVocabularySelection();

    current.filter =
        normalizeVocabularyFilter(
            filter
        );

    return saveVocabularySelection(
        current
    );

}


/**
 * Change only the selected pack.
 */
function setSelectedPack(packId) {

    const current =
        getVocabularySelection();

    current.packId =
        packId || "all";

    return saveVocabularySelection(
        current
    );

}


/**
 * Reset vocabulary selection.
 */
function resetVocabularySelection() {

    return saveVocabularySelection({

        ...DEFAULT_VOCABULARY_SELECTION

    });

}


/* =========================================================
   VOCABULARY FILTER NORMALIZATION
========================================================= */

function normalizeVocabularyFilter(filter) {

    const allowed = [

        "all",
        "pack",
        "new",
        "weak",
        "due"

    ];

    const normalized =
        String(filter || "all")
            .trim()
            .toLowerCase();

    return allowed.includes(normalized)
        ? normalized
        : "all";

}


/* =========================================================
   VOCABULARY SELECTION NORMALIZATION
========================================================= */

function normalizeVocabularySelection(selection) {

    const source =
        selection &&
        typeof selection === "object"
            ? selection
            : DEFAULT_VOCABULARY_SELECTION;

    const filter =
        normalizeVocabularyFilter(
            source.filter
        );

    let packId =
        source.packId;

    if (
        packId === undefined ||
        packId === null ||
        packId === ""
    ) {

        packId = "all";

    }

    return {

        filter,

        packId: String(packId)

    };

}


/* =========================================================
   PRACTICE SETTINGS
========================================================= */

function getPracticeSettings() {

    const raw =
        localStorageGet(
            STORAGE_KEYS.PRACTICE_SETTINGS,
            null
        );

    const stored =
        parseStoredJSON(
            raw,
            {
                ...DEFAULT_PRACTICE_SETTINGS
            }
        );

    return normalizePracticeSettings(
        stored
    );

}


function savePracticeSettings(settings) {

    const normalized =
        normalizePracticeSettings(
            settings
        );

    localStorageSet(

        STORAGE_KEYS.PRACTICE_SETTINGS,

        JSON.stringify(normalized)

    );

    if (typeof setSetting === "function") {

        setSetting(
            "practiceSettings",
            normalized
        ).catch(error => {

            console.warn(
                "Could not sync practice settings:",
                error
            );

        });

    }

    return normalized;

}


/* =========================================================
   PRACTICE SETTINGS NORMALIZATION
========================================================= */

function normalizePracticeSettings(settings) {

    const source =
        settings &&
        typeof settings === "object"
            ? settings
            : DEFAULT_PRACTICE_SETTINGS;


    const allowedExerciseTypes = [

        "meaning",
        "recall",
        "fill",
        "choose",
        "production",
        "mixed"

    ];

    let exerciseType =
        String(
            source.exerciseType ||
            "meaning"
        )
        .trim()
        .toLowerCase();

    if (
        !allowedExerciseTypes.includes(
            exerciseType
        )
    ) {

        exerciseType = "meaning";

    }


    let questionCount =
        Number(
            source.questionCount
        );

    if (
        !Number.isFinite(questionCount) ||
        questionCount < 1
    ) {

        questionCount = 20;

    }

    questionCount =
        Math.round(
            questionCount
        );

    /*
     * Keep a sensible upper limit so accidental input such as
     * 999999999 does not create an enormous session.
     */
    questionCount =
        Math.min(
            500,
            questionCount
        );


    const vocabularyFilter =
        normalizeVocabularyFilter(
            source.vocabularyFilter ||
            source.filter ||
            "all"
        );


    const packId =
        source.packId
            ? String(source.packId)
            : "all";


    return {

        exerciseType,

        questionCount,

        vocabularyFilter,

        packId

    };

}


/* =========================================================
   UI SETTINGS
========================================================= */

function getUISettings() {

    const raw =
        localStorageGet(
            STORAGE_KEYS.UI_SETTINGS,
            null
        );

    const stored =
        parseStoredJSON(
            raw,
            {
                ...DEFAULT_UI_SETTINGS
            }
        );

    return {

        ...DEFAULT_UI_SETTINGS,

        ...stored

    };

}


function saveUISettings(settings) {

    const current =
        getUISettings();

    const merged = {

        ...current,

        ...(settings || {})

    };

    localStorageSet(

        STORAGE_KEYS.UI_SETTINGS,

        JSON.stringify(merged)

    );

    return merged;

}


/* =========================================================
   LAST SCREEN
========================================================= */

function getLastScreen() {

    const settings =
        getUISettings();

    return settings.lastScreen ||
        "home";

}


function setLastScreen(screen) {

    return saveUISettings({

        lastScreen:
            String(screen || "home")

    });

}


/* =========================================================
   GENERIC PERSISTENT SETTING API
========================================================= */

/**
 * Primary setting API used by application modules.
 *
 * Values are stored in IndexedDB through db.js.
 */
async function savePersistentSetting(
    key,
    value
) {

    if (
        typeof setSetting !== "function"
    ) {

        throw new Error(
            "Database layer is not initialized."
        );

    }

    await setSetting(
        key,
        value
    );

    return value;

}


async function loadPersistentSetting(
    key,
    fallback = null
) {

    if (
        typeof getSetting !== "function"
    ) {

        return fallback;

    }

    return getSetting(
        key,
        fallback
    );

}


/* =========================================================
   SYNC LEGACY / LOCAL SETTINGS
========================================================= */

/**
 * Synchronize localStorage settings with IndexedDB.
 *
 * This helps retain selections from early V1/V2 builds.
 */
async function syncPersistentSettings() {

    /*
     * Vocabulary selection
     */
    const vocabularySelection =
        getVocabularySelection();

    await savePersistentSetting(

        "vocabularySelection",

        vocabularySelection

    );


    /*
     * Practice settings
     */
    const practiceSettings =
        getPracticeSettings();

    await savePersistentSetting(

        "practiceSettings",

        practiceSettings

    );


    /*
     * UI settings
     */
    const uiSettings =
        getUISettings();

    await savePersistentSetting(

        "uiSettings",

        uiSettings

    );

}


/* =========================================================
   RESTORE FROM INDEXEDDB
========================================================= */

/**
 * If IndexedDB already contains persistent settings, restore
 * them into localStorage.
 *
 * This is useful when a user clears site storage selectively
 * or when upgrading from a previous V2 build.
 */
async function restorePersistentSettings() {

    if (
        typeof getSetting !== "function"
    ) {

        return;

    }


    /* -----------------------------------------------------
       Vocabulary selection
    ----------------------------------------------------- */

    const storedVocabulary =
        await getSetting(
            "vocabularySelection",
            null
        );

    if (
        storedVocabulary &&
        typeof storedVocabulary === "object"
    ) {

        saveVocabularySelection(
            storedVocabulary
        );

    }


    /* -----------------------------------------------------
       Practice settings
    ----------------------------------------------------- */

    const storedPractice =
        await getSetting(
            "practiceSettings",
            null
        );

    if (
        storedPractice &&
        typeof storedPractice === "object"
    ) {

        savePracticeSettings(
            storedPractice
        );

    }


    /* -----------------------------------------------------
       UI settings
    ----------------------------------------------------- */

    const storedUI =
        await getSetting(
            "uiSettings",
            null
        );

    if (
        storedUI &&
        typeof storedUI === "object"
    ) {

        saveUISettings(
            storedUI
        );

    }

}


/* =========================================================
   INITIALIZE STORAGE
========================================================= */

/**
 * Initialize persistent application state.
 *
 * Startup sequence later becomes:
 *
 * initializeDB()
 * runMigrations()
 * initializeStorage()
 */
async function initializeStorage() {

    /*
     * Existing localStorage is intentionally preferred if it
     * exists, because it represents the user's current UI
     * selection from the previous application session.
     */

    const localVocabulary =
        localStorageGet(
            STORAGE_KEYS.VOCABULARY_SELECTION,
            null
        );

    const localPractice =
        localStorageGet(
            STORAGE_KEYS.PRACTICE_SETTINGS,
            null
        );

    const localUI =
        localStorageGet(
            STORAGE_KEYS.UI_SETTINGS,
            null
        );


    /*
     * If local settings exist, normalize and sync them.
     */
    if (localVocabulary !== null) {

        saveVocabularySelection(
            parseStoredJSON(
                localVocabulary,
                DEFAULT_VOCABULARY_SELECTION
            )
        );

    }


    if (localPractice !== null) {

        savePracticeSettings(
            parseStoredJSON(
                localPractice,
                DEFAULT_PRACTICE_SETTINGS
            )
        );

    }


    if (localUI !== null) {

        saveUISettings(
            parseStoredJSON(
                localUI,
                DEFAULT_UI_SETTINGS
            )
        );

    }


    /*
     * If this is a fresh installation, retrieve settings from
     * IndexedDB if they already exist.
     */
    if (
        localVocabulary === null &&
        localPractice === null &&
        localUI === null
    ) {

        await restorePersistentSettings();

    }


    /*
     * Ensure all three settings have valid defaults.
     */
    saveVocabularySelection(
        getVocabularySelection()
    );

    savePracticeSettings(
        getPracticeSettings()
    );

    saveUISettings(
        getUISettings()
    );


    /*
     * Keep IndexedDB synchronized.
     */
    await syncPersistentSettings();


    console.log(
        "Persistent storage initialized."
    );

}


/* =========================================================
   DEBUG / DIAGNOSTICS
========================================================= */

function getStorageSnapshot() {

    return {

        vocabularySelection:
            getVocabularySelection(),

        practiceSettings:
            getPracticeSettings(),

        uiSettings:
            getUISettings()

    };

}