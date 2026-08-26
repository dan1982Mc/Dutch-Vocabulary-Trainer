/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   app.js

   Main application controller.
   Architecture A: canonical module APIs only.
========================================================= */

const APP_VERSION = "2.0.0";
const APP_NAME = "Dutch Vocabulary Trainer";

const AppState = {
    version: APP_VERSION,
    initialized: false,
    initializing: false,
    currentView: "dashboard",
    previousView: null,
    practiceSession: null,
    vocabularySelection: null,
    statistics: null,
    initializationPromise: null,
    lastError: null
};

const APP_EVENTS = {
    READY: "app-ready",
    VIEW_CHANGED: "app-view-changed",
    DATA_CHANGED: "app-data-changed",
    SELECTION_CHANGED: "app-selection-changed",
    PRACTICE_STARTED: "app-practice-started",
    PRACTICE_ANSWERED: "app-practice-answered",
    PRACTICE_COMPLETED: "app-practice-completed",
    IMPORT_COMPLETED: "app-import-completed",
    ERROR: "app-error"
};

function dispatchAppEvent(eventName, detail = {}) {
    try {
        window.dispatchEvent(new CustomEvent(eventName, {
            detail: { ...detail, appVersion: APP_VERSION, timestamp: new Date().toISOString() }
        }));
    } catch (error) {
        console.warn("Could not dispatch application event:", eventName, error);
    }
}

function handleAppError(error, context = "") {
    AppState.lastError = error;
    console.error(`[${APP_NAME}]`, context, error);
    dispatchAppEvent(APP_EVENTS.ERROR, { error, context });
    if (typeof showToast === "function") {
        showToast(context ? `${context}: ${error.message || error}` : (error.message || String(error)), "error");
    }
    return error;
}

async function safelyExecute(callback, context = "") {
    try { return await callback(); }
    catch (error) { handleAppError(error, context); throw error; }
}

/* =========================================================
   CANONICAL MODULE INITIALIZATION
========================================================= */

async function initializeStorageLayer() {
    if (typeof initializeStorage !== "function") throw new Error("storage.js: initializeStorage() is unavailable.");
    return await initializeStorage();
}

async function initializeDatabaseLayer() {
    if (typeof initializeDatabase !== "function") throw new Error("db.js: initializeDatabase() is unavailable.");
    return await initializeDatabase();
}

async function initializeMigrationLayer() {
    if (typeof runMigrations !== "function") throw new Error("migration.js: runMigrations() is unavailable.");
    return await runMigrations();
}

async function initializePackLayer() {
    if (typeof initializePacks === "function") return await initializePacks();
    if (typeof ensureDefaultPack === "function") return await ensureDefaultPack();
    throw new Error("packs.js: no canonical pack initialization function is available.");
}

function initializeSelectionLayer() {
    if (typeof getVocabularySelection !== "function") throw new Error("selection.js: getVocabularySelection() is unavailable.");
    AppState.vocabularySelection = getVocabularySelection();
    return AppState.vocabularySelection;
}

async function initializeMasteryLayer() {
    if (typeof recalculateAllMasteryStates === "function") return await recalculateAllMasteryStates();
    return { processed: 0 };
}

async function initializeUILayer() {
    if (typeof initializeUI !== "function") throw new Error("ui.js: initializeUI() is unavailable.");
    return await initializeUI();
}

async function initializeDashboardLayer() {
    if (typeof initializeDashboard !== "function") throw new Error("dashboard.js: initializeDashboard() is unavailable.");
    return await initializeDashboard();
}

async function initializePracticeLayer() {
    if (typeof initializePractice !== "function") throw new Error("practice.js: initializePractice() is unavailable.");
    return await initializePractice();
}

async function initializeSchedulerLayer() {
    if (typeof initializeScheduler === "function") return await initializeScheduler();
    return true;
}

async function initializeImportLayer() {
    if (typeof initializeImport === "function") return await initializeImport();
    return true;
}

/* =========================================================
   VOCABULARY / STATISTICS
========================================================= */

function refreshApplicationSelectionState() {
    if (typeof getVocabularySelection === "function") AppState.vocabularySelection = getVocabularySelection();
    dispatchAppEvent(APP_EVENTS.SELECTION_CHANGED, { selection: AppState.vocabularySelection });
    return AppState.vocabularySelection;
}

async function getApplicationVocabulary() {
    if (typeof getAllWords !== "function") throw new Error("db.js: getAllWords() is unavailable.");
    const words = await getAllWords();
    return Array.isArray(words) ? words : [];
}

async function getApplicationSelectedVocabulary() {
    if (typeof getSelectedVocabulary !== "function") throw new Error("selection.js: getSelectedVocabulary() is unavailable.");
    const words = await getSelectedVocabulary();
    return Array.isArray(words) ? words : [];
}

function getApplicationSelection() {
    return refreshApplicationSelectionState();
}

function changeApplicationSelection(source, packId = null) {
    if (typeof changeVocabularySelection !== "function") throw new Error("selection.js: changeVocabularySelection() is unavailable.");
    AppState.vocabularySelection = changeVocabularySelection(source, packId);
    dispatchAppEvent(APP_EVENTS.SELECTION_CHANGED, { selection: AppState.vocabularySelection });
    refreshApplicationStatistics();
    return AppState.vocabularySelection;
}

async function refreshApplicationStatistics() {
    try {
        const allWords = await getApplicationVocabulary();
        const selectedWords = await getApplicationSelectedVocabulary();
        const allStats = typeof calculateVocabularyStats === "function" ? calculateVocabularyStats(allWords) : null;
        const selectedStats = typeof calculateVocabularyStats === "function" ? calculateVocabularyStats(selectedWords) : null;
        const skills = typeof calculateSkillStats === "function" ? calculateSkillStats(selectedWords) : null;
        const packStats = typeof calculatePackStatistics === "function" ? await calculatePackStatistics(allWords) : null;
        AppState.statistics = { selected: selectedStats, all: allStats, skills, packs: packStats, updatedAt: new Date().toISOString() };
        return AppState.statistics;
    } catch (error) {
        handleAppError(error, "Refreshing application statistics");
        return AppState.statistics;
    }
}

/* =========================================================
   NAVIGATION
========================================================= */

async function navigateTo(view, options = {}) {
    const normalizedView = String(view || "").trim().toLowerCase();
    const aliases = { home: "home", dashboard: "dashboard", practice: "practice", "start-practice": "start-practice", startpractice: "start-practice", import: "import", settings: "settings" };
    const targetView = aliases[normalizedView];
    if (!targetView) { console.warn("Unknown application view:", view); return false; }

    if (AppState.currentView !== targetView) await runViewExitHook(AppState.currentView);
    AppState.previousView = AppState.currentView;
    AppState.currentView = targetView;

    if (typeof renderView === "function") await renderView(targetView, options);
    else if (typeof showView === "function") await showView(targetView, options);
    else showViewFallback(targetView);

    await runViewEnterHook(targetView, options);
    dispatchAppEvent(APP_EVENTS.VIEW_CHANGED, { view: targetView, previousView: AppState.previousView, options });
    return true;
}

async function runViewExitHook(view) {
    try {
        if (view === "practice" && typeof onPracticeViewExit === "function") await onPracticeViewExit();
        if (view === "dashboard" && typeof onDashboardViewExit === "function") await onDashboardViewExit();
        if (view === "import" && typeof onImportViewExit === "function") await onImportViewExit();
    } catch (error) { handleAppError(error, `Leaving ${view}`); }
}

async function runViewEnterHook(view, options = {}) {
    switch (view) {
        case "dashboard":
            if (typeof refreshDashboard === "function") await refreshDashboard();
            break;
        case "practice":
            if (typeof showPracticeSetup === "function") await showPracticeSetup(options);
            break;
        case "start-practice":
            await startQuickPractice(options);
            break;
        case "import":
            if (typeof showImportView === "function") await showImportView();
            break;
        case "settings":
            if (typeof showSettingsView === "function") await showSettingsView();
            break;
    }
}

function showViewFallback(view) {
    const screenId = view === "start-practice" ? "practiceScreen" : `${view}Screen`;
    document.querySelectorAll(".screen").forEach(element => element.classList.remove("active"));
    const target = document.getElementById(screenId);
    if (target) target.classList.add("active");
}

/* =========================================================
   QUICK PRACTICE
========================================================= */

function isApplicationSelectionAll() {
    const selection = getApplicationSelection();
    return !selection || String(selection.source || "all").toLowerCase() === "all";
}

function isApplicationQuickPracticeWord(word) {
    if (!word) return false;
    if (word.isNew === true || word.isDue === true) return true;
    const mastery = Number(word.mastery ?? word.masteryScore ?? 0);
    if (mastery < 40) return true;
    const due = new Date(word.nextReview ?? word.nextReviewAt ?? word.dueAt ?? "").getTime();
    return Number.isFinite(due) && due <= Date.now();
}

async function startQuickPractice(options = {}) {
    const selected = await getApplicationSelectedVocabulary();
    const allWords = selected.length && !isApplicationSelectionAll() ? selected : await getApplicationVocabulary();
    const quickWords = allWords.filter(isApplicationQuickPracticeWord);
    const questionCount = normalizeQuestionCount(options.questionCount ?? 10);

    const practiceOptions = {
        ...options,
        mode: "start",
        exerciseType: "meaning",
        questionCount,
        source: options.source
    };

    dispatchAppEvent(APP_EVENTS.PRACTICE_STARTED, {
        mode: "start",
        exerciseType: "meaning",
        questionCount,
        vocabularyCount: quickWords.length
    });

    if (typeof startPracticeSession !== "function") throw new Error("practice.js: startPracticeSession() is unavailable.");
    const session = await startPracticeSession(practiceOptions);
    AppState.practiceSession = session;
    return session;
}

function normalizeQuestionCount(value) {
    const count = Number(value);
    if (!Number.isFinite(count)) return 10;
    return Math.max(1, Math.min(500, Math.floor(count)));
}

/* =========================================================
   BOOTSTRAP
========================================================= */

async function initializeApplication() {
    if (AppState.initialized) return AppState;
    if (AppState.initializationPromise) return AppState.initializationPromise;

    AppState.initializationPromise = (async () => {
        AppState.initializing = true;
        try {
            await initializeDatabaseLayer();
            await initializeStorageLayer();
            await initializeMigrationLayer();
            await initializePackLayer();
            initializeSelectionLayer();
            await initializeMasteryLayer();
            await initializeSchedulerLayer();
            await initializeImportLayer();
            await initializeUILayer();
            await initializeDashboardLayer();
            await initializePracticeLayer();
            await refreshApplicationStatistics();
            AppState.initialized = true;
            dispatchAppEvent(APP_EVENTS.READY, { state: AppState });
            return AppState;
        } catch (error) {
            handleAppError(error, "Application initialization");
            throw error;
        } finally {
            AppState.initializing = false;
        }
    })();

    try { return await AppState.initializationPromise; }
    finally { AppState.initializationPromise = null; }
}

const initApp = initializeApplication;

/* =========================================================
   GLOBAL API
========================================================= */

window.DutchTrainerApp = {
    version: APP_VERSION,
    state: AppState,
    events: APP_EVENTS,
    initialize: initializeApplication,
    init: initializeApplication,
    navigateTo,
    startQuickPractice,
    getVocabulary: getApplicationVocabulary,
    getSelectedVocabulary: getApplicationSelectedVocabulary,
    getSelection: getApplicationSelection,
    changeSelection: changeApplicationSelection,
    refreshStatistics: refreshApplicationStatistics
};

window.addEventListener("DOMContentLoaded", () => {
    initializeApplication().catch(() => {});
});
