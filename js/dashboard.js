/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   dashboard.js - Architecture A

   Global classic-script API. No ES modules.
   Uses db.js + selection.js as the canonical data/selection layer.
========================================================= */

const DASHBOARD_EXERCISE_TYPES = ["meaning", "recall", "fill", "choose", "production"];
const DASHBOARD_EXERCISE_LABELS = {
    meaning: "Meaning",
    recall: "Recall",
    fill: "Fill Sentence",
    choose: "Choose Word",
    production: "Production"
};

function dashboardNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function dashboardMastery(word) {
    return Math.max(0, Math.min(100, dashboardNumber(
        word?.mastery ?? word?.masteryScore ?? word?.score, 0
    )));
}

function dashboardAttempts(word) {
    return dashboardNumber(word?.stats?.attempts, 0);
}

function dashboardCorrect(word) {
    return dashboardNumber(word?.stats?.correct, 0);
}

function dashboardIsNew(word) {
    if (word?.isNew !== undefined) return Boolean(word.isNew);
    return dashboardAttempts(word) === 0;
}

function dashboardIsWeak(word) {
    if (word?.isWeak !== undefined) return Boolean(word.isWeak);
    const mastery = dashboardMastery(word);
    return mastery > 0 && mastery < 40;
}

function dashboardIsDue(word) {
    if (word?.isDue !== undefined) return Boolean(word.isDue);
    const value = word?.nextReview ?? word?.nextReviewAt ?? word?.dueAt ?? word?.dueDate;
    if (value === undefined || value === null || value === "") return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time <= Date.now();
}

function dashboardLevel(word) {
    const mastery = dashboardMastery(word);
    if (mastery >= 90) return "mastered";
    if (mastery >= 70) return "strong";
    if (mastery >= 50) return "familiar";
    if (mastery >= 40) return "developing";
    if (mastery > 0) return "weak";
    return "new";
}

function calculateVocabularyStats(words = []) {
    const list = Array.isArray(words) ? words : [];
    const total = list.length;
    const attempts = list.reduce((s, w) => s + dashboardAttempts(w), 0);
    const correct = list.reduce((s, w) => s + dashboardCorrect(w), 0);
    const attempted = list.filter(w => dashboardAttempts(w) > 0).length;
    const mastered = list.filter(w => dashboardMastery(w) >= 90).length;
    const weak = list.filter(dashboardIsWeak).length;
    const due = list.filter(dashboardIsDue).length;
    const isNew = list.filter(dashboardIsNew).length;
    const accuracy = attempts ? correct / attempts : 0;
    const averageMastery = total ? list.reduce((s, w) => s + dashboardMastery(w), 0) / total : 0;

    return {
        total,
        new: isNew,
        weak,
        due,
        attempted,
        mastered,
        learning: list.filter(w => dashboardLevel(w) === "developing" || dashboardLevel(w) === "weak").length,
        familiar: list.filter(w => dashboardLevel(w) === "familiar").length,
        totalAttempts: attempts,
        totalCorrect: correct,
        totalIncorrect: Math.max(0, attempts - correct),
        accuracy,
        accuracyPercent: Math.round(accuracy * 100),
        averageMastery,
        masteryPercent: Math.round(averageMastery),
        coveragePercent: total ? Math.round((attempted / total) * 100) : 0
    };
}

function calculateSkillStats(words = []) {
    const list = Array.isArray(words) ? words : [];
    const result = {};

    for (const type of DASHBOARD_EXERCISE_TYPES) {
        let attempts = 0;
        let correct = 0;
        let attemptedWords = 0;

        for (const word of list) {
            const stats = word?.stats?.byExerciseType?.[type] || {};
            const a = dashboardNumber(stats.attempts, 0);
            const c = dashboardNumber(stats.correct, 0);
            attempts += a;
            correct += c;
            if (a > 0) attemptedWords++;
        }

        const accuracy = attempts ? correct / attempts : 0;
        const coverage = list.length ? attemptedWords / list.length : 0;
        const score = attempts ? accuracy * 0.75 + coverage * 0.25 : 0;

        result[type] = {
            type,
            label: DASHBOARD_EXERCISE_LABELS[type],
            attempts,
            correct,
            incorrect: Math.max(0, attempts - correct),
            accuracy,
            accuracyPercent: Math.round(accuracy * 100),
            coverage,
            coveragePercent: Math.round(coverage * 100),
            score,
            scorePercent: Math.round(score * 100)
        };
    }

    const values = Object.values(result);
    const overall = values.length ? values.reduce((sum, item) => sum + item.score, 0) / values.length : 0;
    return { byType: result, overall, overallPercent: Math.round(overall * 100) };
}

function calculateMasteryDistribution(words = []) {
    const distribution = { new: 0, learning: 0, familiar: 0, mastered: 0 };
    for (const word of words) {
        const level = dashboardLevel(word);
        if (level === "new") distribution.new++;
        else if (level === "familiar") distribution.familiar++;
        else if (level === "mastered" || level === "strong") distribution.mastered++;
        else distribution.learning++;
    }
    return distribution;
}

async function calculatePackStatistics(words = []) {
    const groups = {};
    let packs = [];
    try {
        packs = typeof getAllPacks === "function" ? await getAllPacks() : [];
    } catch (_) {}

    const packNames = {};
    for (const pack of Array.isArray(packs) ? packs : []) {
        const id = String(pack.packId ?? pack.id ?? "");
        if (id) packNames[id] = pack.name ?? pack.title ?? id;
    }

    for (const word of words) {
        const rawId = word?.packId ?? null;
        const id = rawId === null ? "unassigned" : String(rawId);
        if (!groups[id]) {
            groups[id] = {
                packId: rawId === null ? null : id,
                name: rawId === null ? "Unassigned" : (packNames[id] || `Pack ${id}`),
                total: 0, new: 0, weak: 0, due: 0, mastered: 0,
                attempts: 0, correct: 0, accuracyPercent: 0, masteryPercent: 0
            };
        }
        const group = groups[id];
        group.total++;
        if (dashboardIsNew(word)) group.new++;
        if (dashboardIsWeak(word)) group.weak++;
        if (dashboardIsDue(word)) group.due++;
        if (dashboardMastery(word) >= 90) group.mastered++;
        group.attempts += dashboardAttempts(word);
        group.correct += dashboardCorrect(word);
    }

    for (const group of Object.values(groups)) {
        group.accuracyPercent = group.attempts ? Math.round(group.correct / group.attempts * 100) : 0;
        group.masteryPercent = group.total ? Math.round(group.mastered / group.total * 100) : 0;
    }
    return Object.values(groups);
}

async function getDashboardData() {
    const allWords = typeof getAllWords === "function" ? await getAllWords() : [];
    const selectedWords = typeof getSelectedVocabulary === "function"
        ? await getSelectedVocabulary()
        : allWords;

    return {
        generatedAt: new Date().toISOString(),
        selectedVocabulary: {
            words: selectedWords,
            stats: calculateVocabularyStats(selectedWords),
            skills: calculateSkillStats(selectedWords),
            mastery: calculateMasteryDistribution(selectedWords),
            packs: await calculatePackStatistics(selectedWords)
        },
        allLoadedVocabulary: {
            words: allWords,
            stats: calculateVocabularyStats(allWords),
            skills: calculateSkillStats(allWords),
            mastery: calculateMasteryDistribution(allWords),
            packs: await calculatePackStatistics(allWords)
        }
    };
}

function setDashboardValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "0";
}

function setDashboardProgress(id, percent) {
    const element = document.getElementById(id);
    if (element) element.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
}

async function renderDashboard() {
    const data = await getDashboardData();
    const selected = data.selectedVocabulary.stats;
    const all = data.allLoadedVocabulary.stats;
    const skills = data.selectedVocabulary.skills.byType;

    let label = "All Vocabulary";
    if (typeof getVocabularySelectionLabel === "function" && typeof getVocabularySelection === "function") {
        label = getVocabularySelectionLabel(getVocabularySelection());
    }
    setDashboardValue("selectedFilterLabel", label);
    setDashboardValue("selectedLearned", selected.mastered);
    setDashboardValue("selectedDue", selected.due);
    setDashboardValue("selectedWeak", selected.weak);
    setDashboardValue("selectedNew", selected.new);
    setDashboardValue("selectedProgressText", `${selected.masteryPercent}%`);
    setDashboardProgress("selectedProgressFill", selected.masteryPercent);

    setDashboardValue("allWords", all.total);
    setDashboardValue("allLearned", all.mastered);
    setDashboardValue("allDue", all.due);
    setDashboardValue("allWeak", all.weak);
    setDashboardValue("allProgressText", `${all.masteryPercent}%`);
    setDashboardProgress("allProgressFill", all.masteryPercent);

    const container = document.getElementById("skillsContainer");
    if (container) {
        container.innerHTML = Object.values(skills).map(skill => `
            <div class="skill-row">
                <div class="skill-header"><span>${escapeHtml(skill.label)}</span><strong>${skill.scorePercent}%</strong></div>
                <div class="progress-bar"><div class="progress-fill" style="width:${skill.scorePercent}%"></div></div>
            </div>
        `).join("");
    }
    return data;
}

async function initializeDashboard() {
    if (!document.getElementById("dashboardScreen")) return true;
    try { await renderDashboard(); }
    catch (error) { console.error("Dashboard initialization failed", error); }
    return true;
}

const initDashboard = initializeDashboard;
