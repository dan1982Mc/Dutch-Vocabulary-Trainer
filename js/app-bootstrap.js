/* Architecture-A application bootstrap. Replaces the broken legacy app.js entry point. */
(function () {
    "use strict";
    const APP_VERSION = "2.0.0";
    const AppState = { version: APP_VERSION, initialized: false, initializing: false, currentView: "home", previousView: null, practiceSession: null, vocabularySelection: null, statistics: null, lastError: null };

    function dispatch(name, detail = {}) { window.dispatchEvent(new CustomEvent(name, { detail: { ...detail, appVersion: APP_VERSION } })); }
    function fail(error, context) { AppState.lastError = { context, message: error?.message || String(error) }; console.error(`${context}:`, error); dispatch("app-error", { error: AppState.lastError }); throw error; }
    async function initialize() {
        if (AppState.initialized) return AppState;
        if (AppState.initializing) return AppState;
        AppState.initializing = true;
        try {
            if (typeof initDatabase === "function") await initDatabase();
            if (typeof initializeStorage === "function") await initializeStorage();
            if (typeof runMigrations === "function") await runMigrations();
            if (!window.DutchTrainerPacks?.ensureDefaultPack) throw new Error("packs.js did not expose DutchTrainerPacks.ensureDefaultPack().");
            await window.DutchTrainerPacks.ensureDefaultPack();
            if (typeof getVocabularySelection !== "function") throw new Error("selection.js is unavailable.");
            AppState.vocabularySelection = getVocabularySelection();
            if (typeof recalculateAllMasteryStates === "function") await recalculateAllMasteryStates();
            if (typeof initializeScheduler === "function") await initializeScheduler();
            if (typeof initializeImport === "function") await initializeImport();
            if (typeof initializeDashboard === "function") await initializeDashboard();
            if (typeof initializePractice === "function") initializePractice();
            if (typeof initializeUI === "function") initializeUI();
            AppState.initialized = true;
            dispatch("app-ready", { state: AppState });
            return AppState;
        } catch (error) { return fail(error, "Application initialization"); }
        finally { AppState.initializing = false; }
    }
    async function vocabulary() { return getAllWords(); }
    async function selectedVocabulary() { return getSelectedVocabulary(); }
    async function changeSelection(source, packId = null) {
        const actions = { all: selectAllVocabulary, pack: () => selectVocabularyPack(packId), new: selectNewVocabulary, weak: selectWeakVocabulary, due: selectDueVocabulary };
        if (actions[source]) await actions[source]();
        AppState.vocabularySelection = getVocabularySelection();
        dispatch("app-selection-changed", { selection: AppState.vocabularySelection });
        return AppState.vocabularySelection;
    }
    async function startQuickPractice(options = {}) {
        const selected = await selectedVocabulary();
        const pool = selected.length && AppState.vocabularySelection?.source !== "all" ? selected : await vocabulary();
        const count = Math.max(1, Number(options.questionCount || 10));
        const words = typeof selectStartPracticeWords === "function" ? selectStartPracticeWords(pool, count) : pool.slice(0, count);
        const session = await startPracticeSession({ mode: "start", exerciseType: "meaning", questionCount: count, vocabulary: words });
        AppState.practiceSession = session;
        if (session?.success) navigateTo("practice");
        return session;
    }
    async function startConfiguredPractice() {
        const type = document.getElementById("exerciseType")?.value || "meaning";
        const custom = document.getElementById("customQuestionCount")?.value;
        const preset = document.querySelector(".countPreset.active")?.dataset.value;
        const count = Math.max(1, Number(custom || preset || 20));
        const filter = document.getElementById("vocabularyFilter")?.value || "all";
        const packId = document.getElementById("packSelector")?.value || "all";
        await changeSelection(filter, filter === "pack" ? packId : null);
        if (typeof closeModal === "function") closeModal("practiceModal");
        const session = await startPracticeSession({ exerciseType: type, questionCount: count, mode: "full" });
        AppState.practiceSession = session;
        if (session?.success) navigateTo("practice");
        return session;
    }
    async function checkCurrentAnswer() { const input = document.querySelector("#answerArea input, #answerArea textarea, #answerArea select"); return checkPracticeAnswer(input?.value ?? ""); }
    function nextCurrentQuestion() { const result = nextPracticeQuestion(); if (result.completed) navigateTo("complete"); else if (typeof renderPracticeQuestion === "function") renderPracticeQuestion(result.question); return result; }

    window.DutchTrainerApp = { version: APP_VERSION, state: AppState, initialize, init: initialize, startQuickPractice, startConfiguredPractice, checkCurrentAnswer, nextCurrentQuestion, getVocabulary: vocabulary, getSelectedVocabulary: selectedVocabulary, changeSelection };
    window.startQuickPractice = startQuickPractice;
    window.startConfiguredPractice = startConfiguredPractice;
    window.checkCurrentAnswer = checkCurrentAnswer;
    window.goToNextPracticeQuestion = nextCurrentQuestion;
    window.addEventListener("DOMContentLoaded", () => initialize().catch(() => {}));
})();
