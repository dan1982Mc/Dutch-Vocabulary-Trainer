/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   Persistent Application Storage

   Architecture A:
   - storage.js owns practice/UI persistence only
   - selection.js owns vocabulary selection persistence
   - db.js owns IndexedDB
========================================================= */

const STORAGE_KEYS = {
    PRACTICE_SETTINGS: "v2.practiceSettings",
    UI_SETTINGS: "v2.uiSettings"
};

const DEFAULT_PRACTICE_SETTINGS = {
    exerciseType: "meaning",
    questionCount: 20,
    vocabularyFilter: "all",
    packId: "all"
};

const DEFAULT_UI_SETTINGS = {
    lastScreen: "home",
    theme: "system"
};

function parseStoredJSON(value, fallback) {
    if (!value) return fallback;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (error) {
        console.warn("Could not parse stored setting:", error);
        return fallback;
    }
}

function localStorageGet(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : fallback;
    } catch (error) {
        console.warn("localStorage read failed:", error);
        return fallback;
    }
}

function localStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        console.warn("localStorage write failed:", error);
        return false;
    }
}

/* =========================================================
   PRACTICE SETTINGS
========================================================= */

function normalizePracticeSettings(settings) {
    const source = settings && typeof settings === "object"
        ? settings
        : DEFAULT_PRACTICE_SETTINGS;

    const allowedExerciseTypes = [
        "meaning", "recall", "fill", "choose", "production", "mixed"
    ];

    let exerciseType = String(source.exerciseType || "meaning")
        .trim().toLowerCase();

    if (!allowedExerciseTypes.includes(exerciseType)) {
        exerciseType = "meaning";
    }

    let questionCount = Number(source.questionCount);
    if (!Number.isFinite(questionCount) || questionCount < 1) {
        questionCount = 20;
    }
    questionCount = Math.min(500, Math.round(questionCount));

    const allowedFilters = ["all", "pack", "new", "weak", "due"];
    let vocabularyFilter = String(
        source.vocabularyFilter || source.filter || "all"
    ).trim().toLowerCase();

    if (!allowedFilters.includes(vocabularyFilter)) {
        vocabularyFilter = "all";
    }

    const packId = source.packId ? String(source.packId) : "all";

    return {
        exerciseType,
        questionCount,
        vocabularyFilter,
        packId
    };
}

function getPracticeSettings() {
    const raw = localStorageGet(STORAGE_KEYS.PRACTICE_SETTINGS, null);
    return normalizePracticeSettings(
        parseStoredJSON(raw, { ...DEFAULT_PRACTICE_SETTINGS })
    );
}

function savePracticeSettings(settings) {
    const normalized = normalizePracticeSettings(settings);
    localStorageSet(
        STORAGE_KEYS.PRACTICE_SETTINGS,
        JSON.stringify(normalized)
    );

    if (typeof setSetting === "function") {
        setSetting("practiceSettings", normalized).catch(error => {
            console.warn("Could not sync practice settings to IndexedDB:", error);
        });
    }

    return normalized;
}

/* =========================================================
   UI SETTINGS
========================================================= */

function getUISettings() {
    const raw = localStorageGet(STORAGE_KEYS.UI_SETTINGS, null);
    const stored = parseStoredJSON(raw, { ...DEFAULT_UI_SETTINGS });
    return {
        ...DEFAULT_UI_SETTINGS,
        ...stored
    };
}

function saveUISettings(settings) {
    const merged = {
        ...getUISettings(),
        ...(settings || {})
    };

    localStorageSet(
        STORAGE_KEYS.UI_SETTINGS,
        JSON.stringify(merged)
    );

    return merged;
}

function getLastScreen() {
    return getUISettings().lastScreen || "home";
}

function setLastScreen(screen) {
    return saveUISettings({
        lastScreen: String(screen || "home")
    });
}

/* =========================================================
   GENERIC PERSISTENT SETTING API
========================================================= */

async function savePersistentSetting(key, value) {
    if (typeof setSetting !== "function") {
        throw new Error("Database layer is not initialized.");
    }

    await setSetting(key, value);
    return value;
}

async function loadPersistentSetting(key, fallback = null) {
    if (typeof getSetting !== "function") return fallback;
    return getSetting(key, fallback);
}

/* =========================================================
   INDEXEDDB SYNC
========================================================= */

async function syncPersistentSettings() {
    await savePersistentSetting("practiceSettings", getPracticeSettings());
    await savePersistentSetting("uiSettings", getUISettings());
}

async function restorePersistentSettings() {
    if (typeof getSetting !== "function") return;

    const storedPractice = await getSetting("practiceSettings", null);
    if (storedPractice && typeof storedPractice === "object") {
        savePracticeSettings(storedPractice);
    }

    const storedUI = await getSetting("uiSettings", null);
    if (storedUI && typeof storedUI === "object") {
        saveUISettings(storedUI);
    }
}

/* =========================================================
   INITIALIZE STORAGE
========================================================= */

async function initializeStorage() {
    const localPractice = localStorageGet(
        STORAGE_KEYS.PRACTICE_SETTINGS,
        null
    );

    const localUI = localStorageGet(
        STORAGE_KEYS.UI_SETTINGS,
        null
    );

    if (localPractice !== null) {
        savePracticeSettings(
            parseStoredJSON(localPractice, DEFAULT_PRACTICE_SETTINGS)
        );
    }

    if (localUI !== null) {
        saveUISettings(
            parseStoredJSON(localUI, DEFAULT_UI_SETTINGS)
        );
    }

    if (localPractice === null && localUI === null) {
        await restorePersistentSettings();
    }

    savePracticeSettings(getPracticeSettings());
    saveUISettings(getUISettings());

    await syncPersistentSettings();

    console.log("Persistent storage initialized.");
}

function getStorageSnapshot() {
    return {
        practiceSettings: getPracticeSettings(),
        uiSettings: getUISettings(),
        vocabularySelection: typeof getVocabularySelection === "function"
            ? getVocabularySelection()
            : null
    };
}
