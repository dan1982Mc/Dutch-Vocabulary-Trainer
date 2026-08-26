/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   app.js

   Main application controller.

   Responsibilities:
   - Bootstrap the application
   - Initialize database/storage
   - Run V1.2 -> V2 migration
   - Initialize packs
   - Initialize vocabulary selection
   - Initialize mastery data
   - Coordinate Dashboard / Practice / Import
   - Handle application navigation
   - Provide shared application state
   - Dispatch global application events

   Expected companion files:

   js/db.js
   js/migration.js
   js/storage.js
   js/filters.js
   js/similarity.js
   js/packs.js
   js/exercises.js
   js/selection.js
   js/mastery.js
   js/dashboard.js
   js/practice.js
   js/scheduler.js
   js/import.js
   js/ui.js
========================================================= */


/* =========================================================
   APPLICATION VERSION
========================================================= */

const APP_VERSION = "2.0.0";

const APP_NAME =
    "Dutch Vocabulary Trainer";


/* =========================================================
   GLOBAL APPLICATION STATE
========================================================= */

const AppState = {

    version:
        APP_VERSION,

    initialized:
        false,

    initializing:
        false,

    currentView:
        "dashboard",

    previousView:
        null,

    /*
     * Current Practice session is owned by practice.js.
     * app.js only keeps a reference so other modules can
     * inspect whether a session is active.
     */
    practiceSession:
        null,

    /*
     * Current persistent vocabulary selection.
     */
    vocabularySelection:
        null,

    /*
     * Application-level statistics cache.
     *
     * These are refreshed after practice/import changes.
     */
    statistics:
        null,

    /*
     * Prevent duplicate initialization.
     */
    initializationPromise:
        null,

    /*
     * Last application error.
     */
    lastError:
        null

};


/* =========================================================
   APPLICATION EVENTS
========================================================= */

const APP_EVENTS = {

    READY:
        "app-ready",

    VIEW_CHANGED:
        "app-view-changed",

    DATA_CHANGED:
        "app-data-changed",

    SELECTION_CHANGED:
        "app-selection-changed",

    PRACTICE_STARTED:
        "app-practice-started",

    PRACTICE_ANSWERED:
        "app-practice-answered",

    PRACTICE_COMPLETED:
        "app-practice-completed",

    IMPORT_COMPLETED:
        "app-import-completed",

    ERROR:
        "app-error"

};


/* =========================================================
   EVENT DISPATCHER
========================================================= */

function dispatchAppEvent(
    eventName,
    detail = {}
) {

    try {

        window.dispatchEvent(

            new CustomEvent(
                eventName,
                {
                    detail: {

                        ...detail,

                        appVersion:
                            APP_VERSION,

                        timestamp:
                            new Date().toISOString()

                    }
                }
            )

        );

    } catch (error) {

        console.warn(
            "Could not dispatch application event:",
            eventName,
            error
        );

    }

}


/* =========================================================
   ERROR HANDLING
========================================================= */

function handleAppError(
    error,
    context = ""
) {

    AppState.lastError =
        error;


    console.error(

        `[${APP_NAME}]`,

        context,

        error

    );


    dispatchAppEvent(

        APP_EVENTS.ERROR,

        {

            error,

            context

        }

    );


    /*
     * Use UI error handling when available.
     */
    if (
        typeof showToast ===
        "function"
    ) {

        showToast(

            context
                ? `${context}: ${error.message || error}`
                : (
                    error.message ||
                    String(error)
                ),

            "error"

        );

    }


    return error;

}


/* =========================================================
   SAFE ASYNC EXECUTION
========================================================= */

async function safelyExecute(
    callback,
    context = ""
) {

    try {

        return await callback();

    } catch (error) {

        handleAppError(
            error,
            context
        );

        throw error;

    }

}


/* =========================================================
   STORAGE INITIALIZATION
========================================================= */

async function initializeStorageLayer() {

    /*
     * storage.js may expose one of several initialization
     * functions depending on the V2 implementation.
     */
    if (
        typeof initializeStorage ===
        "function"
    ) {

        return await initializeStorage();

    }


    if (
        typeof initStorage ===
        "function"
    ) {

        return await initStorage();

    }


    /*
     * localStorage requires no initialization.
     */
    return true;

}


/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabaseLayer() {

    if (
        typeof initializeDatabase ===
        "function"
    ) {

        return await initializeDatabase();

    }


    if (
        typeof initDatabase ===
        "function"
    ) {

        return await initDatabase();

    }


    if (
        typeof openDatabase ===
        "function"
    ) {

        return await openDatabase();

    }


    /*
     * db.js can alternatively initialize itself when loaded.
     */
    return true;

}


/* =========================================================
   V1.2 -> V2 MIGRATION
========================================================= */

async function initializeMigrationLayer() {

    /*
     * Migration must happen before the application starts
     * using the new packId / statistics structure.
     */
    if (
        typeof runMigration ===
        "function"
    ) {

        return await runMigration();

    }


    if (
        typeof migrateV12ToV2 ===
        "function"
    ) {

        return await migrateV12ToV2();

    }


    if (
        typeof migrateData ===
        "function"
    ) {

        return await migrateData();

    }


    /*
     * No migration function available means migration.js
     * has either already handled initialization or is not
     * required for this stored dataset.
     */
    return {

        migrated:
            false,

        skipped:
            true

    };

}


/* =========================================================
   PACK INITIALIZATION
========================================================= */

async function initializePackLayer() {

    if (
        typeof initializePacks ===
        "function"
    ) {

        return await initializePacks();

    }


    if (
        typeof initPacks ===
        "function"
    ) {

        return await initPacks();

    }


    /*
     * packs.js may lazily create the default pack.
     */
    if (
        typeof ensureDefaultPack ===
        "function"
    ) {

        return await ensureDefaultPack();

    }


    return true;

}


/* =========================================================
   SELECTION INITIALIZATION
========================================================= */

function initializeSelectionLayer() {

    if (
        typeof initializeVocabularySelection ===
        "function"
    ) {

        AppState.vocabularySelection =
            initializeVocabularySelection();

        return AppState.vocabularySelection;

    }


    if (
        typeof loadVocabularySelection ===
        "function"
    ) {

        AppState.vocabularySelection =
            loadVocabularySelection();

        return AppState.vocabularySelection;

    }


    AppState.vocabularySelection =
        null;


    return null;

}


/* =========================================================
   MASTERY INITIALIZATION
========================================================= */

async function initializeMasteryLayer() {

    /*
     * Important:
     *
     * This must NEVER reset existing V1.2 mastery values.
     * The mastery module only fills missing fields and
     * recalculates derived state.
     */
    if (
        typeof initializeMasteryData ===
        "function"
    ) {

        return await initializeMasteryData();

    }


    if (
        typeof recalculateAllMasteryStates ===
        "function"
    ) {

        return await recalculateAllMasteryStates();

    }


    return {

        processed:
            0

    };

}


/* =========================================================
   UI INITIALIZATION
========================================================= */

async function initializeUILayer() {

    if (
        typeof initializeUI ===
        "function"
    ) {

        return await initializeUI();

    }


    if (
        typeof initUI ===
        "function"
    ) {

        return await initUI();

    }


    /*
     * UI can also initialize through DOMContentLoaded.
     */
    return true;

}


/* =========================================================
   DASHBOARD INITIALIZATION
========================================================= */

async function initializeDashboardLayer() {

    if (
        typeof initializeDashboard ===
        "function"
    ) {

        return await initializeDashboard();

    }


    if (
        typeof initDashboard ===
        "function"
    ) {

        return await initDashboard();

    }


    return true;

}


/* =========================================================
   PRACTICE INITIALIZATION
========================================================= */

async function initializePracticeLayer() {

    if (
        typeof initializePractice ===
        "function"
    ) {

        return await initializePractice();

    }


    if (
        typeof initPractice ===
        "function"
    ) {

        return await initPractice();

    }


    return true;

}


/* =========================================================
   SCHEDULER INITIALIZATION
========================================================= */

async function initializeSchedulerLayer() {

    if (
        typeof initializeScheduler ===
        "function"
    ) {

        return await initializeScheduler();

    }


    if (
        typeof initScheduler ===
        "function"
    ) {

        return await initScheduler();

    }


    return true;

}


/* =========================================================
   IMPORT INITIALIZATION
========================================================= */

async function initializeImportLayer() {

    if (
        typeof initializeImport ===
        "function"
    ) {

        return await initializeImport();

    }


    if (
        typeof initImport ===
        "function"
    ) {

        return await initImport();

    }


    return true;

}


/* =========================================================
   REFRESH SELECTION STATE
========================================================= */

function refreshApplicationSelectionState() {

    if (
        typeof getVocabularySelection ===
        "function"
    ) {

        AppState.vocabularySelection =
            getVocabularySelection();

    }


    dispatchAppEvent(

        APP_EVENTS.SELECTION_CHANGED,

        {

            selection:
                AppState.vocabularySelection

        }

    );


    return AppState.vocabularySelection;

}


/* =========================================================
   REFRESH GLOBAL STATISTICS
========================================================= */

async function refreshApplicationStatistics() {

    try {

        const allWords =
            await getApplicationVocabulary();


        const selectedWords =
            await getApplicationSelectedVocabulary();


        let allStats =
            null;

        let selectedStats =
            null;

        let skills =
            null;

        let packStats =
            null;


        if (
            typeof calculateVocabularyStats ===
            "function"
        ) {

            allStats =
                calculateVocabularyStats(
                    allWords
                );


            selectedStats =
                calculateVocabularyStats(
                    selectedWords
                );

        }


        if (
            typeof calculateSkillStats ===
            "function"
        ) {

            skills =
                calculateSkillStats(
                    selectedWords
                );

        }


        if (
            typeof calculatePackStatistics ===
            "function"
        ) {

            packStats =
                calculatePackStatistics(
                    allWords
                );

        }


        AppState.statistics = {

            selected:

                selectedStats,

            all:

                allStats,

            skills,

            packs:

                packStats,

            updatedAt:
                new Date().toISOString()

        };


        return AppState.statistics;

    } catch (error) {

        handleAppError(

            error,

            "Refreshing application statistics"

        );


        return AppState.statistics;

    }

}


/* =========================================================
   GET ALL VOCABULARY
========================================================= */

async function getApplicationVocabulary() {

    if (
        typeof getAllLoadedVocabulary ===
        "function"
    ) {

        return await getAllLoadedVocabulary();

    }


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
   GET SELECTED VOCABULARY
========================================================= */

async function getApplicationSelectedVocabulary() {

    if (
        typeof getSelectedVocabulary ===
        "function"
    ) {

        const words =
            await getSelectedVocabulary();


        return Array.isArray(words)
            ? words
            : [];

    }


    const allWords =
        await getApplicationVocabulary();


    if (
        typeof applyVocabularySelection ===
        "function"
    ) {

        return applyVocabularySelection(

            allWords,

            AppState.vocabularySelection

        );

    }


    return allWords;

}


/* =========================================================
   GET CURRENT SELECTION
========================================================= */

function getApplicationSelection() {

    if (
        typeof getVocabularySelection ===
        "function"
    ) {

        AppState.vocabularySelection =
            getVocabularySelection();

    }


    return AppState.vocabularySelection;

}


/* =========================================================
   CHANGE VOCABULARY SELECTION
========================================================= */

function changeApplicationSelection(
    source,
    packId = null
) {

    let selection;


    if (
        typeof changeVocabularySelection ===
        "function"
    ) {

        selection =
            changeVocabularySelection(

                source,

                packId

            );

    } else {

        selection =
            AppState.vocabularySelection;

    }


    AppState.vocabularySelection =
        selection;


    dispatchAppEvent(

        APP_EVENTS.SELECTION_CHANGED,

        {

            selection

        }

    );


    /*
     * Dashboard statistics depend on the selection, so
     * refresh them immediately.
     */
    refreshApplicationStatistics();


    return selection;

}


/* =========================================================
   NAVIGATION
========================================================= */

/**
 * V2.0 has separate Dashboard, Start Practice and full
 * Practice setup.
 *
 * app.js handles navigation but does not own the UI markup.
 */
async function navigateTo(
    view,
    options = {}
) {

    const normalizedView =
        String(
            view || ""
        )
        .trim()
        .toLowerCase();


    const validViews = [

        "dashboard",

        "home",

        "practice",

        "start-practice",

        "startpractice",

        "import",

        "settings"

    ];


    if (
        !validViews.includes(
            normalizedView
        )
    ) {

        console.warn(
            "Unknown application view:",
            view
        );

        return false;

    }


    let targetView =
        normalizedView;


    if (
        targetView === "home"
    ) {

        targetView =
            "dashboard";

    }


    if (
        targetView === "startpractice"
    ) {

        targetView =
            "start-practice";

    }


    /*
     * Give the current view an opportunity to clean up.
     */
    if (
        AppState.currentView !==
        targetView
    ) {

        await runViewExitHook(

            AppState.currentView

        );

    }


    AppState.previousView =
        AppState.currentView;


    AppState.currentView =
        targetView;


    /*
     * Let ui.js handle actual screen rendering.
     */
    if (
        typeof renderView ===
        "function"
    ) {

        await renderView(

            targetView,

            options

        );

    } else if (
        typeof showView ===
        "function"
    ) {

        await showView(

            targetView,

            options

        );

    } else {

        showViewFallback(
            targetView
        );

    }


    await runViewEnterHook(

        targetView,

        options

    );


    dispatchAppEvent(

        APP_EVENTS.VIEW_CHANGED,

        {

            view:
                targetView,

            previousView:
                AppState.previousView,

            options

        }

    );


    return true;

}


/* =========================================================
   VIEW EXIT HOOKS
========================================================= */

async function runViewExitHook(
    view
) {

    try {

        switch (
            view
        ) {

            case "practice":

                if (
                    typeof onPracticeViewExit ===
                    "function"
                ) {

                    await onPracticeViewExit();

                }

                break;


            case "dashboard":

                if (
                    typeof onDashboardViewExit ===
                    "function"
                ) {

                    await onDashboardViewExit();

                }

                break;


            case "import":

                if (
                    typeof onImportViewExit ===
                    "function"
                ) {

                    await onImportViewExit();

                }

                break;

        }

    } catch (error) {

        handleAppError(

            error,

            `Leaving ${view}`

        );

    }

}


/* =========================================================
   VIEW ENTER HOOKS
========================================================= */

async function runViewEnterHook(
    view,
    options
) {

    switch (
        view
    ) {

        case "dashboard":

            if (
                typeof refreshDashboard ===
                "function"
            ) {

                await refreshDashboard();

            }

            break;


        case "practice":

            if (
                typeof showPracticeSetup ===
                "function"
            ) {

                await showPracticeSetup(
                    options
                );

            }

            break;


        case "start-practice":

            /*
             * Start Practice is intentionally NOT the full
             * setup screen.
             *
             * It should immediately prepare a quick Meaning
             * session using new/due/weak words.
             */
            if (
                typeof startQuickPractice ===
                "function"
            ) {

                await startQuickPractice(
                    options
                );

            } else if (
                typeof showQuickPractice ===
                "function"
            ) {

                await showQuickPractice(
                    options
                );

            }

            break;


        case "import":

            if (
                typeof showImportView ===
                "function"
            ) {

                await showImportView();

            }

            break;


        case "settings":

            if (
                typeof showSettingsView ===
                "function"
            ) {

                await showSettingsView();

            }

            break;

    }

}


/* =========================================================
   FALLBACK VIEW RENDERER
========================================================= */

function showViewFallback(
    view
) {

    const views = {

        dashboard: [
            "#dashboardView",
            "#dashboard",
            "[data-view='dashboard']"
        ],

        practice: [
            "#practiceView",
            "#practice",
            "[data-view='practice']"
        ],

        "start-practice": [
            "#startPracticeView",
            "#start-practice",
            "[data-view='start-practice']"
        ],

        import: [
            "#importView",
            "#import",
            "[data-view='import']"
        ],

        settings: [
            "#settingsView",
            "#settings",
            "[data-view='settings']"
        ]

    };


    const targetSelectors =
        views[view] ||
        [];


    let target =
        null;


    for (
        const selector
        of targetSelectors
    ) {

        target =
            document.querySelector(
                selector
            );


        if (
            target
        ) {

            break;

        }

    }


    if (
        !target
    ) {

        return;

    }


    document
        .querySelectorAll(
            "[data-view]"
        )
        .forEach(

            element => {

                element.hidden =
                    true;

                element
                    .classList
                    .remove(
                        "active"
                    );

            }

        );


    target.hidden =
        false;


    target
        .classList
        .add(
            "active"
        );

}


/* =========================================================
   START QUICK PRACTICE
========================================================= */

/**
 * Start Practice:
 *
 * - Meaning only
 * - New / Due / Weak vocabulary
 * - No full setup
 */
async function startQuickPractice(
    options = {}
) {

    const selected =
        await getApplicationSelectedVocabulary();


    /*
     * If the user's persistent selection is already a
     * specific vocabulary set, Practice can use it.
     *
     * Start Practice itself is designed around new/due/weak
     * words, so when the current selection is "all", build
     * the quick pool from those categories.
     */
    let quickWords;


    if (
        selected.length > 0 &&
        !isApplicationSelectionAll()
    ) {

        quickWords =
            selected.filter(

                word =>

                    isApplicationQuickPracticeWord(
                        word
                    )

            );

    } else {

        const allWords =
            await getApplicationVocabulary();


        quickWords =
            allWords.filter(

                word =>

                    isApplicationQuickPracticeWord(
                        word
                    )

            );

    }


    /*
     * Fallback:
     *
     * If there are no new/due/weak words, use the selected
     * vocabulary rather than showing an empty practice screen.
     */
    if (
        quickWords.length === 0
    ) {

        quickWords =
            selected;

    }


    const questionCount =
        normalizeQuestionCount(

            options.questionCount ??
            10

        );


    const practiceOptions = {

        ...options,

        mode:
            "quick",

        exerciseType:
            "meaning",

        mixed:
            false,

        questionCount,

        words:
            quickWords

    };


    dispatchAppEvent(

        APP_EVENTS.PRACTICE_STARTED,

        {

            mode:
                "quick",

            exerciseType:
                "meaning",

            questionCount,

            vocabularyCount:
                quickWords.length

        }

    );


    /*
     * practice.js owns the actual session.
     */
    if (
        typeof startPracticeSession ===
        "function"
    ) {

        return await startPracticeSession(
            practiceOptions
        );

    }


    if (
        typeof beginPractice ===
        "function"
    ) {

        return await beginPractice(
            practiceOptions
        );

    }


    return null;

}


/* =========================================================
   QUICK PRACTICE WORD TEST
========================================================= */

function isApplicationQuickPracticeWord(
    word
) {

    if (!word) {

        return false;

    }


    const isNew =
        typeof isVocabularyWordNew ===
        "function"
            ? isVocabularyWordNew(
                word
            )
            : Boolean(
                word.isNew
            );


    const isWeak =
        typeof isVocabularyWordWeak ===
        "function"
            ? isVocabularyWordWeak(
                word
            )
            : Boolean(
                word.isWeak
            );


    const isDue =
        typeof isVocabularyWordDue ===
        "function"
            ? isVocabularyWordDue(
                word
            )
            : Boolean(
                word.isDue
            );


    return (
        isNew ||
        isWeak ||
        isDue
    );

}


/* =========================================================
   IS ALL SELECTION
========================================================= */

function isApplicationSelectionAll() {

    if (
        typeof isAllVocabularySelected ===
        "function"
    ) {

        return isAllVocabularySelected();

    }


    const selection =
        getApplicationSelection();


    return (

        !selection ||
        (
            selection.source ===
            "all" &&
            !selection.newOnly &&
            !selection.weakOnly &&
            !selection.dueOnly
        )

    );

}


/* =========================================================
   QUESTION COUNT
========================================================= */

function normalizeQuestionCount(
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

        return 10;

    }


    /*
     * Keep the session within sensible limits.
     *
     * The user can explicitly enter the number of questions.
     */
    return Math.max(

        1,

        Math.min(

            500,

            Math.floor(
                number
            )

        )

    );

}


/* =========================================================
   START FULL PRACTICE
========================================================= */

/**
 * Full Practice setup.
 *
 * The setup UI decides:
 * - exercise type
 * - question count
 * - vocabulary selection
 * - Mixed Practice
 */
async function startFullPractice(
    options = {}
) {

    const selectedWords =
        await getApplicationSelectedVocabulary();


    if (
        selectedWords.length === 0
    ) {

        if (
            typeof showToast ===
            "function"
        ) {

            showToast(

                "No vocabulary is selected for practice.",

                "warning"

            );

        }


        return null;

    }


    const practiceOptions = {

        ...options,

        mode:
            "full",

        questionCount:
            normalizeQuestionCount(

                options.questionCount ??
                10

            ),

        words:
            selectedWords

    };


    dispatchAppEvent(

        APP_EVENTS.PRACTICE_STARTED,

        {

            mode:
                "full",

            exerciseType:
                options.exerciseType ??
                null,

            mixed:
                Boolean(
                    options.mixed
                ),

            questionCount:
                practiceOptions.questionCount,

            vocabularyCount:
                selectedWords.length

        }

    );


    if (
        typeof startPracticeSession ===
        "function"
    ) {

        const session =
            await startPracticeSession(
                practiceOptions
            );


        AppState.practiceSession =
            session;


        return session;

    }


    if (
        typeof beginPractice ===
        "function"
    ) {

        const session =
            await beginPractice(
                practiceOptions
            );


        AppState.practiceSession =
            session;


        return session;

    }


    return null;

}


/* =========================================================
   PRACTICE ANSWER EVENT
========================================================= */

function notifyPracticeAnswer(
    result
) {

    dispatchAppEvent(

        APP_EVENTS.PRACTICE_ANSWERED,

        {

            result

        }

    );


    /*
     * Mastery is expected to have already been persisted by
     * mastery.js before this event is emitted.
     *
     * Refresh dashboard data after the answer.
     */
    refreshApplicationStatistics();


    return result;

}


/* =========================================================
   PRACTICE COMPLETION EVENT
========================================================= */

async function notifyPracticeCompleted(
    session
) {

    AppState.practiceSession =
        null;


    await refreshApplicationStatistics();


    dispatchAppEvent(

        APP_EVENTS.PRACTICE_COMPLETED,

        {

            session

        }

    );


    /*
     * Dashboard should show the updated selected vocabulary
     * statistics immediately after returning.
     */
    if (
        typeof refreshDashboard ===
        "function"
    ) {

        await refreshDashboard();

    }


    return true;

}


/* =========================================================
   IMPORT COMPLETION EVENT
========================================================= */

async function notifyImportCompleted(
    result
) {

    /*
     * Re-run derived-state initialization because imported
     * vocabulary may include existing mastery information.
     */
    if (
        typeof initializeMasteryData ===
        "function"
    ) {

        await initializeMasteryData();

    }


    refreshApplicationSelectionState();


    await refreshApplicationStatistics();


    dispatchAppEvent(

        APP_EVENTS.IMPORT_COMPLETED,

        {

            result

        }

    );


    dispatchAppEvent(

        APP_EVENTS.DATA_CHANGED,

        {

            reason:
                "import"

        }

    );


    if (
        typeof refreshDashboard ===
        "function"
    ) {

        await refreshDashboard();

    }


    return result;

}


/* =========================================================
   GLOBAL DATA CHANGE
========================================================= */

async function notifyApplicationDataChanged(
    reason = "unknown",
    detail = {}
) {

    refreshApplicationSelectionState();


    await refreshApplicationStatistics();


    dispatchAppEvent(

        APP_EVENTS.DATA_CHANGED,

        {

            reason,

            ...detail

        }

    );


    return AppState.statistics;

}


/* =========================================================
   SET PRACTICE SESSION
========================================================= */

function setPracticeSession(
    session
) {

    AppState.practiceSession =
        session;


    return AppState.practiceSession;

}


/* =========================================================
   GET PRACTICE SESSION
========================================================= */

function getPracticeSession() {

    return AppState.practiceSession;

}


/* =========================================================
   IS PRACTICE ACTIVE
========================================================= */

function isPracticeActive() {

    return Boolean(
        AppState.practiceSession
    );

}


/* =========================================================
   APPLICATION READY
========================================================= */

function isApplicationReady() {

    return Boolean(
        AppState.initialized
    );

}


/* =========================================================
   BOOTSTRAP
========================================================= */

async function initializeApplication() {

    /*
     * Prevent multiple simultaneous initializations.
     */
    if (
        AppState.initialized
    ) {

        return AppState;

    }


    if (
        AppState.initializing &&
        AppState.initializationPromise
    ) {

        return await
            AppState.initializationPromise;

    }


    AppState.initializing =
        true;


    AppState.initializationPromise =

        (async () => {

            try {

                /*
                 * -------------------------------------------------
                 * 1. Storage
                 * -------------------------------------------------
                 */

                await safelyExecute(

                    initializeStorageLayer,

                    "Initializing storage"

                );


                /*
                 * -------------------------------------------------
                 * 2. Database
                 * -------------------------------------------------
                 */

                await safelyExecute(

                    initializeDatabaseLayer,

                    "Initializing database"

                );


                /*
                 * -------------------------------------------------
                 * 3. Migration
                 * -------------------------------------------------
                 *
                 * MUST happen before packs/mastery/dashboard.
                 */

                const migrationResult =
                    await safelyExecute(

                        initializeMigrationLayer,

                        "Migrating V1.2 data"

                    );


                /*
                 * -------------------------------------------------
                 * 4. Packs
                 * -------------------------------------------------
                 */

                await safelyExecute(

                    initializePackLayer,

                    "Initializing Word Packs"

                );


                /*
                 * -------------------------------------------------
                 * 5. Persistent selection
                 * -------------------------------------------------
                 */

                initializeSelectionLayer();


                /*
                 * -------------------------------------------------
                 * 6. Mastery
                 * -------------------------------------------------
                 */

                await safelyExecute(

                    initializeMasteryLayer,

                    "Initializing mastery"

                );


                /*
                 * -------------------------------------------------
                 * 7. UI
                 * -------------------------------------------------
                 */

                await safelyExecute(

                    initializeUILayer,

                    "Initializing UI"

                );


                /*
                 * -------------------------------------------------
                 * 8. Scheduler
                 * -------------------------------------------------
                 */

                await safelyExecute(

                    initializeSchedulerLayer,

                    "Initializing scheduler"

                );


                /*
                 * -------------------------------------------------
                 * 9. Practice
                 * -------------------------------------------------
                 */

                await safelyExecute(

                    initializePracticeLayer,

                    "Initializing Practice"

                );


                /*
                 * -------------------------------------------------
                 * 10. Import
                 * -------------------------------------------------
                 */

                await safelyExecute(

                    initializeImportLayer,

                    "Initializing Import"

                );


                /*
                 * -------------------------------------------------
                 * 11. Dashboard
                 * -------------------------------------------------
                 */

                await safelyExecute(

                    initializeDashboardLayer,

                    "Initializing Dashboard"

                );


                /*
                 * -------------------------------------------------
                 * 12. Refresh shared state
                 * -------------------------------------------------
                 */

                refreshApplicationSelectionState();


                await refreshApplicationStatistics();


                /*
                 * -------------------------------------------------
                 * READY
                 * -------------------------------------------------
                 */

                AppState.initialized =
                    true;

                AppState.initializing =
                    false;


                dispatchAppEvent(

                    APP_EVENTS.READY,

                    {

                        migration:
                            migrationResult,

                        selection:
                            AppState.vocabularySelection,

                        statistics:
                            AppState.statistics

                    }

                );


                /*
                 * Initial screen.
                 */
                await navigateTo(
                    "dashboard"
                );


                return AppState;

            } catch (error) {

                AppState.initializing =
                    false;


                handleAppError(

                    error,

                    "Application initialization"

                );


                throw error;

            }

        })();


    return await
        AppState.initializationPromise;

}


/* =========================================================
   APPLICATION SHUTDOWN
========================================================= */

async function shutdownApplication() {

    try {

        /*
         * Stop active scheduler.
         */
        if (
            typeof stopScheduler ===
            "function"
        ) {

            await stopScheduler();

        }


        /*
         * Allow Practice to clean up.
         */
        if (
            typeof cleanupPractice ===
            "function"
        ) {

            await cleanupPractice();

        }


        /*
         * Close database if supported.
         */
        if (
            typeof closeDatabase ===
            "function"
        ) {

            await closeDatabase();

        }


        AppState.initialized =
            false;

        AppState.initializing =
            false;

        AppState.practiceSession =
            null;


        return true;

    } catch (error) {

        handleAppError(

            error,

            "Shutting down application"

        );


        return false;

    }

}


/* =========================================================
   BROWSER LIFECYCLE
========================================================= */

function registerApplicationLifecycle() {

    /*
     * DOMContentLoaded is the normal entry point.
     */
    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(

            "DOMContentLoaded",

            () => {

                initializeApplication()
                    .catch(
                        () => {}
                    );

            },

            {
                once:
                    true
            }

        );

    } else {

        /*
         * Script may have been loaded after DOMContentLoaded.
         */
        initializeApplication()
            .catch(
                () => {}
            );

    }


    /*
     * Persist selection whenever the dedicated selection
     * manager announces a change.
     */
    window.addEventListener(

        "vocabulary-selection-changed",

        event => {

            AppState.vocabularySelection =
                event.detail ||
                getApplicationSelection();


            dispatchAppEvent(

                APP_EVENTS.SELECTION_CHANGED,

                {

                    selection:
                        AppState.vocabularySelection

                }

            );


            refreshApplicationStatistics();

        }

    );


    /*
     * Keep dashboard statistics current after a practice
     * answer.
     */
    window.addEventListener(

        APP_EVENTS.PRACTICE_ANSWERED,

        () => {

            refreshApplicationStatistics();

        }

    );


    /*
     * Keyboard navigation should not accidentally start a
     * second session while one is active.
     */
    window.addEventListener(

        "beforeunload",

        () => {

            /*
             * No asynchronous work is attempted here.
             *
             * Browser storage/database persistence should
             * already happen after every answer.
             */

        }

    );

}


/* =========================================================
   PUBLIC APPLICATION API
========================================================= */

window.DutchTrainerApp = {

    version:
        APP_VERSION,

    state:
        AppState,

    events:
        APP_EVENTS,

    initialize:
        initializeApplication,

    shutdown:
        shutdownApplication,

    navigate:
        navigateTo,

    getVocabulary:
        getApplicationVocabulary,

    getSelectedVocabulary:
        getApplicationSelectedVocabulary,

    getSelection:
        getApplicationSelection,

    setSelection:
        changeApplicationSelection,

    getStatistics:
        () =>
            AppState.statistics,

    refreshStatistics:
        refreshApplicationStatistics,

    startQuickPractice,

    startFullPractice,

    setPracticeSession,

    getPracticeSession,

    isPracticeActive,

    notifyPracticeAnswer,

    notifyPracticeCompleted,

    notifyImportCompleted,

    notifyDataChanged:
        notifyApplicationDataChanged,

    isReady:
        isApplicationReady

};


/* =========================================================
   GLOBAL COMPATIBILITY HELPERS
========================================================= */

/*
 * These aliases make it easier for existing HTML onclick
 * handlers and V1.2 code to continue working during the V2
 * transition.
 */

window.startQuickPractice =
    startQuickPractice;


window.startFullPractice =
    startFullPractice;


window.navigateTo =
    navigateTo;


window.getSelectedVocabulary =
    getApplicationSelectedVocabulary;


/* =========================================================
   START APPLICATION
========================================================= */

registerApplicationLifecycle();