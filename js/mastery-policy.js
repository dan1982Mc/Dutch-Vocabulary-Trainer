/* V2.0 mastery policy
 * Exact = +10, Not quite = +4, Not correct = 0.
 * This file intentionally sits after mastery.js and before
 * practice-mastery-bridge.js so it becomes the single practice-facing
 * answer policy without rewriting the legacy mastery engine.
 */
(function () {
    "use strict";

    const POLICY = {
        correctReward: 10,
        almostReward: 4,
        incorrectReward: 0,
        correctReviewDays: {
            new: 1,
            weak: 2,
            developing: 4,
            familiar: 7,
            strong: 14,
            mastered: 30
        },
        almostReviewDays: 1,
        incorrectReviewDays: 0
    };

    function number(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function clamp(value) {
        return Math.max(0, Math.min(100, Math.round(number(value))));
    }

    function exerciseTypeOf(options) {
        return typeof normalizeExerciseType === "function"
            ? normalizeExerciseType(options.exerciseType || "meaning")
            : String(options.exerciseType || "meaning").toLowerCase();
    }

    function ensureStats(word) {
        if (typeof ensureWordStats === "function") return ensureWordStats(word);
        word.stats = word.stats || {};
        word.stats.attempts = number(word.stats.attempts);
        word.stats.correct = number(word.stats.correct);
        word.stats.incorrect = number(word.stats.incorrect);
        word.stats.accuracy = number(word.stats.accuracy);
        word.stats.consecutiveCorrect = number(word.stats.consecutiveCorrect);
        word.stats.consecutiveIncorrect = number(word.stats.consecutiveIncorrect);
        word.stats.byExerciseType = word.stats.byExerciseType || {};
        return word.stats;
    }

    function masteryOf(word) {
        return typeof getCurrentMastery === "function"
            ? getCurrentMastery(word)
            : clamp(word.mastery ?? word.masteryScore ?? 0);
    }

    function setMastery(word, value) {
        const next = clamp(value);
        word.mastery = next;
        if (word.masteryScore !== undefined) word.masteryScore = next;
        if (word.score !== undefined) word.score = next;
        return next;
    }

    function schedule(word, outcome, mastery) {
        let days;
        if (outcome === "correct") {
            const level = typeof getMasteryLevel === "function" ? getMasteryLevel(mastery) : "new";
            days = POLICY.correctReviewDays[level] ?? 1;
        } else if (outcome === "almost") {
            days = POLICY.almostReviewDays;
        } else {
            days = POLICY.incorrectReviewDays;
        }

        const date = new Date();
        date.setDate(date.getDate() + days);
        const iso = date.toISOString();
        word.dueAt = iso;
        if (word.nextReview !== undefined) word.nextReview = iso;
        if (word.nextReviewAt !== undefined) word.nextReviewAt = iso;
        if (word.dueDate !== undefined) word.dueDate = iso;
        word.isDue = days === 0;
        return iso;
    }

    function historyEntry(word, type, data, before, after, delta, outcome) {
        return {
            timestamp: new Date().toISOString(),
            wordId: word.id ?? null,
            packId: word.packId ?? "default",
            exerciseType: type,
            correct: outcome === "correct",
            outcome,
            userAnswer: data.userAnswer ?? data.answer ?? "",
            expectedAnswer: data.expectedAnswer ?? "",
            masteryBefore: before,
            masteryAfter: after,
            masteryDelta: delta,
            source: data.source ?? "practice"
        };
    }

    async function recordAnswer(word, answerData = {}, exercise = null) {
        if (!word) throw new Error("Cannot update mastery without a word.");

        const type = typeof normalizeExerciseType === "function"
            ? normalizeExerciseType(exercise?.type ?? answerData.exerciseType ?? "meaning")
            : String(exercise?.type ?? answerData.exerciseType ?? "meaning").toLowerCase();
        const stats = ensureStats(word);
        const before = masteryOf(word);
        const correct = Boolean(answerData.correct);
        const almost = !correct && Boolean(answerData.almost);
        const outcome = correct ? "correct" : (almost ? "almost" : "incorrect");
        const delta = outcome === "correct" ? POLICY.correctReward
            : outcome === "almost" ? POLICY.almostReward
            : POLICY.incorrectReward;

        stats.attempts = number(stats.attempts) + 1;
        if (correct) {
            stats.correct = number(stats.correct) + 1;
            stats.consecutiveCorrect = number(stats.consecutiveCorrect) + 1;
            stats.consecutiveIncorrect = 0;
        } else {
            stats.incorrect = number(stats.incorrect) + 1;
            stats.consecutiveIncorrect = number(stats.consecutiveIncorrect) + 1;
            stats.consecutiveCorrect = 0;
        }
        stats.accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;

        if (!stats.byExerciseType[type]) {
            stats.byExerciseType[type] = { attempts: 0, correct: 0, incorrect: 0, accuracy: 0 };
        }
        const ex = stats.byExerciseType[type];
        ex.attempts = number(ex.attempts) + 1;
        if (correct) ex.correct = number(ex.correct) + 1;
        else ex.incorrect = number(ex.incorrect) + 1;
        ex.accuracy = ex.attempts ? Math.round((ex.correct / ex.attempts) * 100) : 0;

        const after = setMastery(word, before + delta);
        if (typeof updateNewStatus === "function") updateNewStatus(word, stats);
        if (typeof updateWeakStatus === "function") updateWeakStatus(word);
        const nextReview = schedule(word, outcome, after);

        if (!Array.isArray(word.history)) word.history = [];
        const entry = historyEntry(word, type, answerData, before, after, delta, outcome);
        word.history.push(entry);
        if (word.history.length > 500) word.history = word.history.slice(-500);

        const now = new Date().toISOString();
        word.lastPracticedAt = now;
        word.lastAnswerAt = now;
        word.updatedAt = now;
        word.lastExerciseType = type;
        word.lastAnswerCorrect = correct;
        word.lastAnswerOutcome = outcome;

        if (typeof saveWord === "function") await saveWord(word);

        return {
            word,
            correct,
            almost,
            outcome,
            exerciseType: type,
            masteryBefore: before,
            masteryAfter: after,
            masteryDelta: delta,
            nextReview,
            stats,
            historyEntry: entry
        };
    }

    window.DutchTrainerMastery = window.DutchTrainerMastery || {};
    window.DutchTrainerMastery.recordAnswer = recordAnswer;
    window.DutchTrainerMastery.updateAfterAnswer = recordAnswer;
    window.DutchTrainerMastery.policy = POLICY;

    /* Replace the legacy global practice-facing function. */
    window.updateWordAfterAnswer = recordAnswer;
})();
