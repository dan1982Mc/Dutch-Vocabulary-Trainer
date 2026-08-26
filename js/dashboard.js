/* ============================================================
   Dutch Trainer v2.0
   js/dashboard.js

   Dashboard responsibilities:
   - Selected Vocabulary statistics
   - All Loaded Vocabulary statistics
   - Skill calculations
   - Exercise-type performance
   - Mastery distribution
   - Due / weak / new counts
   - Per-pack statistics
   - Selected vocabulary progress first
   ============================================================ */

import {
    getAllWords,
    getWord
} from "./db.js";

import {
    getSelection,
    getSelectedWordIds,
    getSelectionSummary
} from "./selection.js";

import {
    getMastery,
    getMasteryStats
} from "./mastery.js";

import {
    getAllPacks,
    getPack
} from "./packs.js";


/* ============================================================
   CONSTANTS
   ============================================================ */

const EXERCISE_TYPES = [
    "meaning",
    "recall",
    "fillSentence",
    "chooseWord",
    "production"
];

const EXERCISE_LABELS = {
    meaning: "Meaning",
    recall: "Recall",
    fillSentence: "Fill Sentence",
    chooseWord: "Choose Word",
    production: "Production"
};

const MASTERY_LEVELS = {
    NEW: 0,
    LEARNING: 1,
    FAMILIAR: 2,
    MASTERED: 3
};


/* ============================================================
   INTERNAL HELPERS
   ============================================================ */

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}

function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
}

function percentage(value, total) {
    if (!total) {
        return 0;
    }

    return Math.round((value / total) * 100);
}

function normalizeWordId(word) {
    if (word === null || word === undefined) {
        return null;
    }

    if (typeof word !== "object") {
        return String(word);
    }

    return String(
        word.id ??
        word.wordId ??
        word.vocabId ??
        word.key ??
        ""
    );
}

function normalizeMasteryRecord(record) {
    if (!record) {
        return {
            level: 0,
            correct: 0,
            incorrect: 0,
            attempts: 0,
            streak: 0,
            lastSeen: null,
            due: false
        };
    }

    return {
        level: safeNumber(
            record.level ??
            record.mastery ??
            record.masteryLevel,
            0
        ),

        correct: safeNumber(
            record.correct ??
            record.correctAnswers,
            0
        ),

        incorrect: safeNumber(
            record.incorrect ??
            record.incorrectAnswers,
            0
        ),

        attempts: safeNumber(
            record.attempts ??
            record.totalAttempts,
            0
        ),

        streak: safeNumber(
            record.streak ??
            record.currentStreak,
            0
        ),

        lastSeen:
            record.lastSeen ??
            record.lastReviewed ??
            record.updatedAt ??
            null,

        due:
            Boolean(
                record.due ??
                record.isDue
            )
    };
}


/* ============================================================
   DATE HELPERS
   ============================================================ */

function startOfToday() {
    const date = new Date();

    date.setHours(0, 0, 0, 0);

    return date;
}

function isDue(record) {
    if (!record) {
        return false;
    }

    if (record.due === true) {
        return true;
    }

    const dueDate =
        record.dueDate ??
        record.nextReview ??
        record.nextReviewAt;

    if (!dueDate) {
        return false;
    }

    const date = new Date(dueDate);

    if (Number.isNaN(date.getTime())) {
        return false;
    }

    return date <= new Date();
}

function isNewWord(word, mastery) {
    if (!mastery) {
        return true;
    }

    const record = normalizeMasteryRecord(mastery);

    return (
        record.attempts === 0 &&
        record.level === MASTERY_LEVELS.NEW
    );
}

function isWeakWord(word, mastery) {
    const record = normalizeMasteryRecord(mastery);

    if (record.attempts === 0) {
        return false;
    }

    return (
        record.level <= MASTERY_LEVELS.LEARNING ||
        record.incorrect > record.correct ||
        (
            record.attempts >= 2 &&
            record.correct / record.attempts < 0.65
        )
    );
}


/* ============================================================
   WORD / MASTERY ACCESS
   ============================================================ */

async function loadWords() {
    const result = await getAllWords();

    return safeArray(result);
}

async function loadMasteryForWord(wordId) {
    try {
        return await getMastery(wordId);
    } catch {
        return null;
    }
}

async function buildWordStats(words) {
    const stats = [];

    for (const word of words) {
        const id = normalizeWordId(word);

        if (!id) {
            continue;
        }

        const mastery = normalizeMasteryRecord(
            await loadMasteryForWord(id)
        );

        stats.push({
            word,
            wordId: id,
            mastery,

            new: isNewWord(word, mastery),
            weak: isWeakWord(word, mastery),
            due: isDue(mastery)
        });
    }

    return stats;
}


/* ============================================================
   BASIC VOCABULARY STATISTICS
   ============================================================ */

function calculateVocabularyStats(wordStats) {
    const total = wordStats.length;

    const newCount = wordStats.filter(
        item => item.new
    ).length;

    const weakCount = wordStats.filter(
        item => item.weak
    ).length;

    const dueCount = wordStats.filter(
        item => item.due
    ).length;

    const masteredCount = wordStats.filter(
        item =>
            item.mastery.level >= MASTERY_LEVELS.MASTERED
    ).length;

    const familiarCount = wordStats.filter(
        item =>
            item.mastery.level === MASTERY_LEVELS.FAMILIAR
    ).length;

    const learningCount = wordStats.filter(
        item =>
            item.mastery.level === MASTERY_LEVELS.LEARNING
    ).length;

    const attempted = wordStats.filter(
        item =>
            item.mastery.attempts > 0
    ).length;

    const totalAttempts = wordStats.reduce(
        (sum, item) =>
            sum + item.mastery.attempts,
        0
    );

    const totalCorrect = wordStats.reduce(
        (sum, item) =>
            sum + item.mastery.correct,
        0
    );

    const accuracy = totalAttempts
        ? totalCorrect / totalAttempts
        : 0;

    const masteryScore = total
        ? wordStats.reduce(
            (sum, item) =>
                sum + clamp(
                    item.mastery.level / MASTERY_LEVELS.MASTERED
                ),
            0
        ) / total
        : 0;

    return {
        total,

        new: newCount,
        weak: weakCount,
        due: dueCount,

        attempted,

        mastered: masteredCount,
        familiar: familiarCount,
        learning: learningCount,

        totalAttempts,
        totalCorrect,

        accuracy,
        accuracyPercent: Math.round(accuracy * 100),

        masteryScore,
        masteryPercent: Math.round(masteryScore * 100),

        coveragePercent: percentage(
            attempted,
            total
        )
    };
}


/* ============================================================
   EXERCISE TYPE STATISTICS
   ============================================================ */

function extractExerciseStatsFromMastery(record) {
    const source =
        record?.exerciseStats ??
        record?.exercises ??
        record?.exerciseTypes ??
        {};

    const result = {};

    for (const type of EXERCISE_TYPES) {
        const item =
            source[type] ??
            source[EXERCISE_LABELS[type]] ??
            {};

        const attempts = safeNumber(
            item.attempts ??
            item.total ??
            item.count,
            0
        );

        const correct = safeNumber(
            item.correct,
            0
        );

        result[type] = {
            attempts,
            correct,
            incorrect: Math.max(
                0,
                attempts - correct
            ),
            accuracy: attempts
                ? correct / attempts
                : 0
        };
    }

    return result;
}

function calculateExerciseStats(wordStats) {
    const stats = {};

    for (const type of EXERCISE_TYPES) {
        stats[type] = {
            type,
            label: EXERCISE_LABELS[type],
            attempts: 0,
            correct: 0,
            incorrect: 0,
            accuracy: 0,
            accuracyPercent: 0
        };
    }

    for (const item of wordStats) {
        const exerciseStats =
            extractExerciseStatsFromMastery(
                item.mastery
            );

        for (const type of EXERCISE_TYPES) {
            const source = exerciseStats[type];

            stats[type].attempts += source.attempts;
            stats[type].correct += source.correct;
            stats[type].incorrect += source.incorrect;
        }
    }

    for (const type of EXERCISE_TYPES) {
        const item = stats[type];

        item.accuracy = item.attempts
            ? item.correct / item.attempts
            : 0;

        item.accuracyPercent = Math.round(
            item.accuracy * 100
        );
    }

    return stats;
}


/* ============================================================
   SKILL CALCULATION
   ============================================================

   Skills are deliberately calculated from the selected
   vocabulary only.

   Each exercise type receives:
   - accuracy
   - coverage
   - combined skill score

   This prevents a large imported vocabulary from affecting
   the user's skill score when only a small pack is selected.
   ============================================================ */

function calculateSkills(wordStats) {
    const exerciseStats =
        calculateExerciseStats(wordStats);

    const totalWords = wordStats.length;

    const skills = {};

    for (const type of EXERCISE_TYPES) {
        const item = exerciseStats[type];

        const attemptedWords = wordStats.filter(
            word => {
                const stats =
                    extractExerciseStatsFromMastery(
                        word.mastery
                    );

                return stats[type].attempts > 0;
            }
        ).length;

        const coverage = totalWords
            ? attemptedWords / totalWords
            : 0;

        /*
         * Accuracy is weighted slightly more heavily than
         * coverage. A user who has practiced a small number
         * of words should not immediately receive a high skill
         * score simply because those few words were correct.
         */
        const score =
            item.attempts === 0
                ? 0
                : (
                    item.accuracy * 0.75 +
                    coverage * 0.25
                );

        skills[type] = {
            type,
            label: EXERCISE_LABELS[type],

            score: clamp(score),
            scorePercent: Math.round(
                clamp(score) * 100
            ),

            accuracy: item.accuracy,
            accuracyPercent: item.accuracyPercent,

            coverage,
            coveragePercent: Math.round(
                coverage * 100
            ),

            attempts: item.attempts
        };
    }

    const values = Object.values(skills);

    const overall =
        values.length
            ? values.reduce(
                (sum, skill) =>
                    sum + skill.score,
                0
            ) / values.length
            : 0;

    return {
        byType: skills,

        overall,
        overallPercent: Math.round(
            overall * 100
        )
    };
}


/* ============================================================
   MASTERY DISTRIBUTION
   ============================================================ */

function calculateMasteryDistribution(wordStats) {
    const distribution = {
        new: 0,
        learning: 0,
        familiar: 0,
        mastered: 0
    };

    for (const item of wordStats) {
        const level =
            safeNumber(
                item.mastery.level,
                0
            );

        if (level <= MASTERY_LEVELS.NEW) {
            distribution.new++;
        } else if (
            level === MASTERY_LEVELS.LEARNING
        ) {
            distribution.learning++;
        } else if (
            level === MASTERY_LEVELS.FAMILIAR
        ) {
            distribution.familiar++;
        } else {
            distribution.mastered++;
        }
    }

    return distribution;
}


/* ============================================================
   PACK STATISTICS
   ============================================================ */

async function calculatePackStats(wordStats) {
    const packs = {};

    for (const item of wordStats) {
        const word = item.word;

        const packId =
            word.packId ??
            word.packID ??
            word.sourcePackId ??
            null;

        const key =
            packId === null
                ? "unassigned"
                : String(packId);

        if (!packs[key]) {
            packs[key] = {
                packId:
                    packId === null
                        ? null
                        : String(packId),

                name:
                    packId === null
                        ? "Unassigned"
                        : `Pack ${packId}`,

                total: 0,
                attempted: 0,
                mastered: 0,
                learning: 0,
                familiar: 0,
                new: 0,
                weak: 0,
                due: 0,

                attempts: 0,
                correct: 0,
                accuracy: 0,
                masteryPercent: 0
            };
        }

        const pack = packs[key];

        pack.total++;

        if (item.new) {
            pack.new++;
        }

        if (item.weak) {
            pack.weak++;
        }

        if (item.due) {
            pack.due++;
        }

        if (item.mastery.attempts > 0) {
            pack.attempted++;
        }

        if (
            item.mastery.level >=
            MASTERY_LEVELS.MASTERED
        ) {
            pack.mastered++;
        } else if (
            item.mastery.level ===
            MASTERY_LEVELS.FAMILIAR
        ) {
            pack.familiar++;
        } else if (
            item.mastery.level ===
            MASTERY_LEVELS.LEARNING
        ) {
            pack.learning++;
        }

        pack.attempts +=
            item.mastery.attempts;

        pack.correct +=
            item.mastery.correct;
    }

    /*
     * Resolve pack names through the explicit pack database.
     */
    try {
        const allPacks = safeArray(
            await getAllPacks()
        );

        for (const pack of allPacks) {
            const id = String(
                pack.id ??
                pack.packId ??
                ""
            );

            if (packs[id]) {
                packs[id].name =
                    pack.name ??
                    pack.title ??
                    packs[id].name;
            }
        }
    } catch {
        // Pack names are optional for dashboard rendering.
    }

    for (const pack of Object.values(packs)) {
        pack.accuracy =
            pack.attempts
                ? pack.correct / pack.attempts
                : 0;

        pack.masteryPercent =
            pack.total
                ? Math.round(
                    (
                        pack.mastered /
                        pack.total
                    ) * 100
                )
                : 0;

        pack.accuracyPercent =
            Math.round(
                pack.accuracy * 100
            );
    }

    return Object.values(packs);
}


/* ============================================================
   SELECTED VOCABULARY
   ============================================================ */

async function resolveSelectedWords(allWords) {
    let selectedIds = [];

    try {
        selectedIds = safeArray(
            await getSelectedWordIds()
        );
    } catch {
        selectedIds = [];
    }

    /*
     * If the selection system returns no explicit selection,
     * fall back to its summary if available.
     */
    if (!selectedIds.length) {
        try {
            const summary =
                await getSelectionSummary();

            selectedIds = safeArray(
                summary?.wordIds ??
                summary?.selectedWordIds
            );
        } catch {
            // Continue with empty selection.
        }
    }

    const selectedSet = new Set(
        selectedIds.map(
            id => String(
                normalizeWordId(id)
            )
        )
    );

    return allWords.filter(
        word =>
            selectedSet.has(
                normalizeWordId(word)
            )
    );
}


/* ============================================================
   DASHBOARD DATA
   ============================================================ */

export async function getDashboardData() {
    const allWords = await loadWords();

    const selectedWords =
        await resolveSelectedWords(
            allWords
        );

    const allWordStats =
        await buildWordStats(
            allWords
        );

    const selectedWordStats =
        await buildWordStats(
            selectedWords
        );

    const selectedStats =
        calculateVocabularyStats(
            selectedWordStats
        );

    const allStats =
        calculateVocabularyStats(
            allWordStats
        );

    const selectedSkills =
        calculateSkills(
            selectedWordStats
        );

    const selectedExerciseStats =
        calculateExerciseStats(
            selectedWordStats
        );

    const allExerciseStats =
        calculateExerciseStats(
            allWordStats
        );

    const selectedMastery =
        calculateMasteryDistribution(
            selectedWordStats
        );

    const allMastery =
        calculateMasteryDistribution(
            allWordStats
        );

    const selectedPacks =
        await calculatePackStats(
            selectedWordStats
        );

    const allPacks =
        await calculatePackStats(
            allWordStats
        );

    return {
        generatedAt:
            new Date().toISOString(),

        selectedVocabulary: {
            words: selectedWords,
            wordStats: selectedWordStats,

            stats: selectedStats,

            skills: selectedSkills,

            exerciseStats:
                selectedExerciseStats,

            mastery:
                selectedMastery,

            packs:
                selectedPacks
        },

        allLoadedVocabulary: {
            words: allWords,
            wordStats: allWordStats,

            stats: allStats,

            exerciseStats:
                allExerciseStats,

            mastery:
                allMastery,

            packs:
                allPacks
        }
    };
}


/* ============================================================
   HTML HELPERS
   ============================================================ */

function escapeHtml(value) {
    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function statCard(
    label,
    value,
    detail = ""
) {
    return `
        <div class="dashboard-stat-card">
            <div class="dashboard-stat-label">
                ${escapeHtml(label)}
            </div>

            <div class="dashboard-stat-value">
                ${escapeHtml(value)}
            </div>

            ${
                detail
                    ? `
                        <div class="dashboard-stat-detail">
                            ${escapeHtml(detail)}
                        </div>
                    `
                    : ""
            }
        </div>
    `;
}

function progressBar(
    value,
    label = ""
) {
    const percent = Math.round(
        clamp(
            safeNumber(value, 0)
        ) * 100
    );

    return `
        <div class="dashboard-progress">
            <div class="dashboard-progress-header">
                <span>
                    ${escapeHtml(label)}
                </span>

                <strong>
                    ${percent}%
                </strong>
            </div>

            <div class="dashboard-progress-track">
                <div
                    class="dashboard-progress-fill"
                    style="width:${percent}%"
                ></div>
            </div>
        </div>
    `;
}


/* ============================================================
   SELECTED VOCABULARY SECTION
   ============================================================ */

function renderSelectedVocabularySection(
    data
) {
    const stats =
        data.selectedVocabulary.stats;

    const skills =
        data.selectedVocabulary.skills;

    const mastery =
        data.selectedVocabulary.mastery;

    return `
        <section
            class="dashboard-section dashboard-selected-section"
            data-dashboard-section="selected"
        >
            <div class="dashboard-section-heading">
                <div>
                    <h2>Selected Vocabulary</h2>

                    <p>
                        Statistics and skills based only on
                        the vocabulary currently selected for practice.
                    </p>
                </div>
            </div>

            <div class="dashboard-stat-grid">

                ${statCard(
                    "Words",
                    stats.total
                )}

                ${statCard(
                    "Mastered",
                    stats.mastered,
                    `${stats.masteryPercent}% mastery`
                )}

                ${statCard(
                    "Due",
                    stats.due
                )}

                ${statCard(
                    "Weak",
                    stats.weak
                )}

                ${statCard(
                    "New",
                    stats.new
                )}

                ${statCard(
                    "Accuracy",
                    `${stats.accuracyPercent}%`,
                    `${stats.totalAttempts} answers`
                )}

            </div>

            <div class="dashboard-grid-two">

                <div class="dashboard-panel">
                    <h3>Progress</h3>

                    ${progressBar(
                        stats.masteryScore,
                        "Mastery"
                    )}

                    ${progressBar(
                        stats.coveragePercent / 100,
                        "Practice coverage"
                    )}

                    <div class="dashboard-mastery-list">

                        <div>
                            <span>New</span>
                            <strong>${mastery.new}</strong>
                        </div>

                        <div>
                            <span>Learning</span>
                            <strong>${mastery.learning}</strong>
                        </div>

                        <div>
                            <span>Familiar</span>
                            <strong>${mastery.familiar}</strong>
                        </div>

                        <div>
                            <span>Mastered</span>
                            <strong>${mastery.mastered}</strong>
                        </div>

                    </div>
                </div>

                <div class="dashboard-panel">
                    <h3>Skills</h3>

                    ${renderSkills(
                        skills
                    )}
                </div>

            </div>

            <div class="dashboard-panel">
                <h3>Exercise Performance</h3>

                ${renderExerciseStats(
                    data.selectedVocabulary.exerciseStats
                )}
            </div>

            <div class="dashboard-panel">
                <h3>Selected Packs</h3>

                ${renderPackStats(
                    data.selectedVocabulary.packs
                )}
            </div>
        </section>
    `;
}


/* ============================================================
   SKILLS
   ============================================================ */

function renderSkills(
    skills
) {
    const byType =
        skills.byType ?? {};

    const rows =
        EXERCISE_TYPES.map(
            type => {
                const skill =
                    byType[type];

                if (!skill) {
                    return "";
                }

                return `
                    <div class="dashboard-skill-row">

                        <div class="dashboard-skill-name">
                            ${escapeHtml(
                                skill.label
                            )}
                        </div>

                        <div class="dashboard-skill-bar">
                            <div
                                class="dashboard-skill-fill"
                                style="width:${skill.scorePercent}%"
                            ></div>
                        </div>

                        <div class="dashboard-skill-value">
                            ${skill.scorePercent}%
                        </div>

                    </div>
                `;
            }
        )
        .join("");

    return `
        <div class="dashboard-overall-skill">
            <span>Overall skill</span>
            <strong>
                ${skills.overallPercent}%
            </strong>
        </div>

        <div class="dashboard-skills">
            ${rows}
        </div>
    `;
}


/* ============================================================
   EXERCISE PERFORMANCE
   ============================================================ */

function renderExerciseStats(
    exerciseStats
) {
    return `
        <div class="dashboard-exercise-list">

            ${EXERCISE_TYPES.map(
                type => {
                    const item =
                        exerciseStats[type];

                    if (!item) {
                        return "";
                    }

                    return `
                        <div
                            class="dashboard-exercise-row"
                            data-exercise-type="${escapeHtml(type)}"
                        >

                            <div>
                                <strong>
                                    ${escapeHtml(
                                        item.label ??
                                        EXERCISE_LABELS[type]
                                    )}
                                </strong>

                                <small>
                                    ${item.attempts}
                                    attempts
                                </small>
                            </div>

                            <div>
                                <strong>
                                    ${item.accuracyPercent}%
                                </strong>

                                <small>
                                    ${item.correct}
                                    correct
                                </small>
                            </div>

                        </div>
                    `;
                }
            ).join("")}

        </div>
    `;
}


/* ============================================================
   PACK PERFORMANCE
   ============================================================ */

function renderPackStats(
    packs
) {
    if (!packs.length) {
        return `
            <div class="dashboard-empty">
                No pack-specific statistics available.
            </div>
        `;
    }

    return `
        <div class="dashboard-pack-list">

            ${packs.map(
                pack => `
                    <div
                        class="dashboard-pack-row"
                        data-pack-id="${
                            escapeHtml(
                                pack.packId ?? ""
                            )
                        }"
                    >

                        <div class="dashboard-pack-info">
                            <strong>
                                ${escapeHtml(
                                    pack.name
                                )}
                            </strong>

                            <small>
                                ${pack.total} words
                                · ${pack.mastered} mastered
                                · ${pack.due} due
                            </small>
                        </div>

                        <div class="dashboard-pack-progress">
                            <div
                                class="dashboard-progress-track"
                            >
                                <div
                                    class="dashboard-progress-fill"
                                    style="width:${
                                        pack.masteryPercent
                                    }%"
                                ></div>
                            </div>
                        </div>

                        <div class="dashboard-pack-value">
                            ${pack.masteryPercent}%
                        </div>

                    </div>
                `
            ).join("")}

        </div>
    `;
}


/* ============================================================
   ALL LOADED VOCABULARY
   ============================================================ */

function renderAllLoadedSection(
    data
) {
    const source =
        data.allLoadedVocabulary;

    const stats =
        source.stats;

    const mastery =
        source.mastery;

    return `
        <section
            class="dashboard-section dashboard-all-section"
            data-dashboard-section="all"
        >
            <div class="dashboard-section-heading">
                <div>
                    <h2>All Loaded Vocabulary</h2>

                    <p>
                        Complete statistics for every vocabulary
                        item currently stored in the application.
                    </p>
                </div>
            </div>

            <div class="dashboard-stat-grid">

                ${statCard(
                    "Words",
                    stats.total
                )}

                ${statCard(
                    "Mastered",
                    stats.mastered,
                    `${stats.masteryPercent}% mastery`
                )}

                ${statCard(
                    "Due",
                    stats.due
                )}

                ${statCard(
                    "Weak",
                    stats.weak
                )}

                ${statCard(
                    "New",
                    stats.new
                )}

                ${statCard(
                    "Accuracy",
                    `${stats.accuracyPercent}%`,
                    `${stats.totalAttempts} answers`
                )}

            </div>

            <div class="dashboard-panel">
                <h3>Mastery Distribution</h3>

                <div class="dashboard-mastery-list">

                    <div>
                        <span>New</span>
                        <strong>
                            ${mastery.new}
                        </strong>
                    </div>

                    <div>
                        <span>Learning</span>
                        <strong>
                            ${mastery.learning}
                        </strong>
                    </div>

                    <div>
                        <span>Familiar</span>
                        <strong>
                            ${mastery.familiar}
                        </strong>
                    </div>

                    <div>
                        <span>Mastered</span>
                        <strong>
                            ${mastery.mastered}
                        </strong>
                    </div>

                </div>
            </div>

            <div class="dashboard-panel">
                <h3>Exercise Performance</h3>

                ${renderExerciseStats(
                    source.exerciseStats
                )}
            </div>

            <div class="dashboard-panel">
                <h3>All Packs</h3>

                ${renderPackStats(
                    source.packs
                )}
            </div>
        </section>
    `;
}


/* ============================================================
   MAIN RENDERER
   ============================================================ */

export async function renderDashboard(
    container
) {
    if (!container) {
        throw new Error(
            "renderDashboard: container is required."
        );
    }

    container.innerHTML = `
        <div class="dashboard-loading">
            Loading dashboard…
        </div>
    `;

    try {
        const data =
            await getDashboardData();

        container.innerHTML = `
            <div
                class="dashboard"
                data-dashboard="v2"
            >

                ${renderSelectedVocabularySection(
                    data
                )}

                ${renderAllLoadedSection(
                    data
                )}

            </div>
        `;

        return data;

    } catch (error) {
        console.error(
            "Dutch Trainer dashboard error:",
            error
        );

        container.innerHTML = `
            <div class="dashboard-error">
                <h2>Dashboard unavailable</h2>

                <p>
                    The dashboard could not load
                    the vocabulary statistics.
                </p>

                <button
                    type="button"
                    data-action="dashboard-retry"
                >
                    Try Again
                </button>
            </div>
        `;

        const retry =
            container.querySelector(
                '[data-action="dashboard-retry"]'
            );

        if (retry) {
            retry.addEventListener(
                "click",
                () => renderDashboard(container)
            );
        }

        throw error;
    }
}


/* ============================================================
   DASHBOARD INITIALIZATION
   ============================================================ */

export function initDashboard({
    container,
    onRefresh = null
} = {}) {
    if (!container) {
        return null;
    }

    let lastData = null;

    const refresh = async () => {
        lastData =
            await renderDashboard(
                container
            );

        if (typeof onRefresh === "function") {
            onRefresh(lastData);
        }

        return lastData;
    };

    /*
     * Expose a small controller instead of forcing app.js
     * to know anything about dashboard internals.
     */
    const controller = {
        refresh,

        getData() {
            return lastData;
        }
    };

    container.dashboardController =
        controller;

    refresh();

    return controller;
}


/* ============================================================
   PUBLIC DATA HELPERS
   ============================================================ */

export async function getSelectedVocabularyStats() {
    const data =
        await getDashboardData();

    return data.selectedVocabulary;
}

export async function getAllVocabularyStats() {
    const data =
        await getDashboardData();

    return data.allLoadedVocabulary;
}

export async function getSelectedSkills() {
    const data =
        await getDashboardData();

    return data.selectedVocabulary.skills;
}

export async function getSelectedPackStats() {
    const data =
        await getDashboardData();

    return data.selectedVocabulary.packs;
}


/* ============================================================
   QUICK DASHBOARD SUMMARY
   ============================================================

   Useful for the main app/home screen without rendering the
   entire dashboard.
   ============================================================ */

export async function getDashboardSummary() {
    const data =
        await getDashboardData();

    const selected =
        data.selectedVocabulary;

    const stats =
        selected.stats;

    return {
        total: stats.total,

        mastered: stats.mastered,
        masteryPercent:
            stats.masteryPercent,

        new: stats.new,
        weak: stats.weak,
        due: stats.due,

        accuracy:
            stats.accuracyPercent,

        skills:
            selected.skills.overallPercent,

        selectedWordCount:
            selected.words.length
    };
}


/* ============================================================
   OPTIONAL GLOBAL BRIDGE
   ============================================================

   The application is primarily ES-module based, but exposing
   the dashboard controller namespace makes integration with
   legacy HTML event handlers possible.
   ============================================================ */

if (typeof window !== "undefined") {
    window.DutchTrainerDashboard = {
        getDashboardData,
        getDashboardSummary,
        getSelectedVocabularyStats,
        getAllVocabularyStats,
        getSelectedSkills,
        getSelectedPackStats,
        renderDashboard,
        initDashboard
    };
}